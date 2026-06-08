// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ZilarcRouter
 * @notice Single-call swap entrypoint over ZilarcSwap AMM pools. Mirrors the
 *         UX of UniswapV2Router: user calls one function, router pulls the
 *         input, executes the swap on the underlying constant-product pool,
 *         and forwards the output to the recipient.
 *
 *         Native USDC (0x3600…0000 precompile) is treated as a normal asset
 *         on the router: when used as tokenIn, the user sends msg.value;
 *         when used as tokenOut, the router forwards native USDC to the
 *         recipient. ERC-20 tokens follow the standard transferFrom +
 *         approve pattern.
 *
 *         The router owns no liquidity. Slippage is enforced via
 *         `amountOutMin` and execution windows via `deadline`, matching
 *         what users expect from any modern DEX.
 *
 *         Pool registry is owner-managed. Each (tokenA, tokenB) pair maps
 *         to a single pool; order-independent (a→b and b→a resolve the
 *         same pool).
 */
interface IZilarcPool {
    function tokenA() external view returns (address);
    function tokenB() external view returns (address);
    function reserveA() external view returns (uint256);
    function reserveB() external view returns (uint256);
    function fee() external view returns (uint256);
    function getAmountOut(uint256 amountIn, bool isAToB) external view returns (uint256);
    function swapAForB(uint256 amountAIn) external payable returns (uint256 amountBOut);
    function swapBForA(uint256 amountBIn) external payable returns (uint256 amountAOut);
}

contract ZilarcRouter is Ownable, ReentrancyGuard {
    address public constant USDC_PRECOMPILE = 0x3600000000000000000000000000000000000000;

    /// @dev keccak256(abi.encode(min, max)) → pool address
    mapping(bytes32 => address) private _pools;

    /// @dev Ordered list of all (a, b, pool) triples for off-chain discovery.
    address[] public allPools;

    event PoolRegistered(address indexed tokenA, address indexed tokenB, address indexed pool);
    event PoolUnregistered(address indexed tokenA, address indexed tokenB, address indexed pool);

    event Swap(
        address indexed sender,
        address indexed recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address pool
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Accept native USDC change from pools (`_push` to router) or
    ///         from accidental sends. Withdrawable by owner via `rescue`.
    receive() external payable {}

    // ─────────────────────────────────────────────────────────────────
    // Pool registry
    // ─────────────────────────────────────────────────────────────────

    function _pairKey(address a, address b) internal pure returns (bytes32) {
        return a < b
            ? keccak256(abi.encode(a, b))
            : keccak256(abi.encode(b, a));
    }

    function poolFor(address tokenA, address tokenB) public view returns (address) {
        return _pools[_pairKey(tokenA, tokenB)];
    }

    function registerPool(address tokenA, address tokenB, address pool) external onlyOwner {
        require(tokenA != address(0) && tokenB != address(0), "Zero token");
        require(tokenA != tokenB, "Same token");
        require(pool != address(0), "Zero pool");

        // Sanity-check that the pool actually backs this pair.
        address pa = IZilarcPool(pool).tokenA();
        address pb = IZilarcPool(pool).tokenB();
        require(
            (pa == tokenA && pb == tokenB) || (pa == tokenB && pb == tokenA),
            "Pool tokens mismatch"
        );

        bytes32 key = _pairKey(tokenA, tokenB);
        require(_pools[key] == address(0), "Already registered");

        _pools[key] = pool;
        allPools.push(pool);
        emit PoolRegistered(tokenA, tokenB, pool);
    }

    function unregisterPool(address tokenA, address tokenB) external onlyOwner {
        bytes32 key = _pairKey(tokenA, tokenB);
        address pool = _pools[key];
        require(pool != address(0), "Not registered");
        delete _pools[key];

        // Remove from allPools (swap-and-pop).
        uint256 n = allPools.length;
        for (uint256 i = 0; i < n; i++) {
            if (allPools[i] == pool) {
                allPools[i] = allPools[n - 1];
                allPools.pop();
                break;
            }
        }

        emit PoolUnregistered(tokenA, tokenB, pool);
    }

    function poolCount() external view returns (uint256) {
        return allPools.length;
    }

    // ─────────────────────────────────────────────────────────────────
    // Quote (read-only)
    // ─────────────────────────────────────────────────────────────────

    /**
     * @notice Quote the expected output for a swap. View-only; respects the
     *         pool fee. Reverts if no pool exists for the pair.
     */
    function getAmountOut(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut, address pool) {
        require(tokenIn != tokenOut, "Same token");
        require(amountIn > 0, "amountIn=0");

        pool = poolFor(tokenIn, tokenOut);
        require(pool != address(0), "No pool");

        bool isAToB = IZilarcPool(pool).tokenA() == tokenIn;
        amountOut = IZilarcPool(pool).getAmountOut(amountIn, isAToB);
    }

    // ─────────────────────────────────────────────────────────────────
    // Swap
    // ─────────────────────────────────────────────────────────────────

    /**
     * @notice Swap `amountIn` of `tokenIn` for at least `amountOutMin` of
     *         `tokenOut`, sending the output to `recipient` (or msg.sender
     *         if zero). Reverts if `block.timestamp > deadline`.
     *
     *         For native USDC input, send msg.value == amountIn.
     *         For ERC-20 input, the caller must have pre-approved the router.
     *
     *         Emits a single Swap event suitable for explorer display.
     */
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient,
        uint256 deadline
    ) external payable nonReentrant returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Expired");
        require(tokenIn != tokenOut, "Same token");
        require(amountIn > 0, "amountIn=0");

        address pool = poolFor(tokenIn, tokenOut);
        require(pool != address(0), "No pool");

        address rcpt = recipient == address(0) ? msg.sender : recipient;

        // ── 1. Pull tokenIn into router ──────────────────────────────
        if (tokenIn == USDC_PRECOMPILE) {
            require(msg.value == amountIn, "Bad msg.value");
        } else {
            require(msg.value == 0, "Unexpected msg.value");
            require(
                IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
                "transferFrom failed"
            );
            // Reset-then-set is unnecessary for our standard OZ ERC20s, but
            // we set exactly amountIn so any leftover is zero post-swap.
            require(IERC20(tokenIn).approve(pool, amountIn), "approve failed");
        }

        // ── 2. Execute swap on pool. Pool sends output to msg.sender
        //       (i.e. the router). ─────────────────────────────────────
        bool isAToB = IZilarcPool(pool).tokenA() == tokenIn;
        uint256 valueToPool = tokenIn == USDC_PRECOMPILE ? amountIn : 0;

        if (isAToB) {
            amountOut = IZilarcPool(pool).swapAForB{value: valueToPool}(amountIn);
        } else {
            amountOut = IZilarcPool(pool).swapBForA{value: valueToPool}(amountIn);
        }

        require(amountOut >= amountOutMin, "Slippage too high");

        // ── 3. Forward tokenOut to recipient ─────────────────────────
        if (tokenOut == USDC_PRECOMPILE) {
            (bool ok, ) = payable(rcpt).call{value: amountOut}("");
            require(ok, "Native send failed");
        } else {
            require(IERC20(tokenOut).transfer(rcpt, amountOut), "transfer failed");
        }

        emit Swap(msg.sender, rcpt, tokenIn, tokenOut, amountIn, amountOut, pool);
    }

    // ─────────────────────────────────────────────────────────────────
    // Owner rescue (no liquidity is held during normal operation, but
    // dust or accidentally-sent tokens can accumulate from rounding).
    // ─────────────────────────────────────────────────────────────────

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(to, amount), "rescue failed");
    }

    function rescueNative(address to, uint256 amount) external onlyOwner {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "rescue native failed");
    }
}
