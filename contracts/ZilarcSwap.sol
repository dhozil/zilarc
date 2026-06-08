// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ZilarcSwap - Simple AMM Liquidity Pool
 * @dev Constant product AMM (x * y = k). Either tokenA or tokenB may be the
 *      USDC precompile at 0x3600…0000 (native gas token on Arc Testnet). When a
 *      side is the precompile, swaps use msg.value / address(this).balance
 *      instead of ERC-20 transferFrom. Both sides use the same decimals
 *      convention (raw 18-dec units on Arc).
 */
contract ZilarcSwap is ERC20, Ownable {
    address public constant USDC_PRECOMPILE = 0x3600000000000000000000000000000000000000;

    // Token addresses
    address public tokenA;
    address public tokenB;

    // Reserves (in raw amounts, 18-dec normalized)
    uint256 public reserveA;
    uint256 public reserveB;

    // Fee in basis points (e.g., 30 = 0.3%)
    uint256 public fee = 30;

    event Mint(address indexed sender, uint256 amountA, uint256 amountB);
    event Burn(address indexed sender, uint256 amountA, uint256 amountB);
    event Swap(address indexed sender, uint256 amountAIn, uint256 amountBIn, uint256 amountAOut, uint256 amountBOut);

    uint256 private constant MINIMUM_LIQUIDITY = 10**3;

    constructor(address _tokenA, address _tokenB, address initialOwner) ERC20("Zilarc LP Token", "ZILP") Ownable(initialOwner) {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    function getReserves() public view returns (uint256 _reserveA, uint256 _reserveB) {
        _reserveA = reserveA;
        _reserveB = reserveB;
    }

    function getReserve0() external view returns (uint256) { return reserveA; }
    function getReserve1() external view returns (uint256) { return reserveB; }

    function isPrecompileA() public view returns (bool) { return tokenA == USDC_PRECOMPILE; }
    function isPrecompileB() public view returns (bool) { return tokenB == USDC_PRECOMPILE; }

    // Pull tokens from sender. For precompile side, msg.value must match.
    function _pull(address token, uint256 amount) internal {
        if (token == USDC_PRECOMPILE) {
            require(msg.value == amount, "Bad msg.value");
        } else {
            require(msg.value == 0, "Don't send value with ERC20 side");
            require(IERC20(token).transferFrom(msg.sender, address(this), amount), "TransferFrom failed");
        }
    }

    // Send tokens to a recipient. For precompile side, send native USDC.
    function _push(address token, address to, uint256 amount) internal {
        if (token == USDC_PRECOMPILE) {
            (bool ok, ) = payable(to).call{value: amount}("");
            require(ok, "Native transfer failed");
        } else {
            require(IERC20(token).transfer(to, amount), "Transfer failed");
        }
    }

    function _update() internal {
        reserveA = (tokenA == USDC_PRECOMPILE) ? address(this).balance : IERC20(tokenA).balanceOf(address(this));
        reserveB = (tokenB == USDC_PRECOMPILE) ? address(this).balance : IERC20(tokenB).balanceOf(address(this));
    }

    // Add liquidity. For precompile side, the matching msg.value must be sent.
    // `amountA` / `amountB` represent the precompile side as raw USDC (18 dec).
    function addLiquidity(uint256 amountA, uint256 amountB) external payable returns (uint256 liquidity) {
        require(amountA > 0 && amountB > 0, "Invalid amounts");
        require(msg.value == 0 || isPrecompileA() || isPrecompileB(), "msg.value with non-precompile pool");

        // Pull precompile side from msg.value (always), then pull the other from caller.
        if (isPrecompileA()) {
            require(msg.value == amountA, "Bad msg.value for A");
            if (!isPrecompileB()) {
                require(IERC20(tokenB).transferFrom(msg.sender, address(this), amountB), "TokenB transferFrom failed");
            }
        } else if (isPrecompileB()) {
            require(msg.value == amountB, "Bad msg.value for B");
            if (!isPrecompileA()) {
                require(IERC20(tokenA).transferFrom(msg.sender, address(this), amountA), "TokenA transferFrom failed");
            }
        } else {
            // Both ERC-20: no value
            require(msg.value == 0, "No value for ERC20 pool");
            require(IERC20(tokenA).transferFrom(msg.sender, address(this), amountA), "TokenA transferFrom failed");
            require(IERC20(tokenB).transferFrom(msg.sender, address(this), amountB), "TokenB transferFrom failed");
        }

        uint256 totalSupply = totalSupply();
        if (totalSupply == 0) {
            liquidity = _sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
            _mint(address(1), MINIMUM_LIQUIDITY);
        } else {
            liquidity = (amountA * totalSupply) / reserveA;
            liquidity = (liquidity * amountB) / reserveB;
        }

        require(liquidity > 0, "Insufficient liquidity minted");
        _mint(msg.sender, liquidity);
        _update();
        emit Mint(msg.sender, amountA, amountB);
    }

    function removeLiquidity(uint256 liquidity) external returns (uint256 amountA, uint256 amountB) {
        require(liquidity > 0, "Invalid liquidity amount");
        uint256 totalSupply = totalSupply();
        amountA = (liquidity * reserveA) / totalSupply;
        amountB = (liquidity * reserveB) / totalSupply;
        _burn(msg.sender, liquidity);
        _push(tokenA, msg.sender, amountA);
        _push(tokenB, msg.sender, amountB);
        _update();
        emit Burn(msg.sender, amountA, amountB);
    }

    function swapAForB(uint256 amountAIn) external payable returns (uint256 amountBOut) {
        return _swap(amountAIn, 0);
    }

    function swapBForA(uint256 amountBIn) external payable returns (uint256 amountAOut) {
        return _swap(0, amountBIn);
    }

    function _swap(uint256 amountAIn, uint256 amountBIn) internal returns (uint256 amountOut) {
        require(amountAIn > 0 || amountBIn > 0, "Invalid input amount");
        require(amountAIn == 0 || amountBIn == 0, "Can only swap one direction");

        address tokenIn;
        address tokenOut;
        uint256 amountIn;

        if (amountAIn > 0) {
            amountIn = amountAIn;
            tokenIn  = tokenA;
            tokenOut = tokenB;
        } else {
            amountIn = amountBIn;
            tokenIn  = tokenB;
            tokenOut = tokenA;
        }

        // Pull input. For precompile side, require msg.value == amountIn.
        if (tokenIn == USDC_PRECOMPILE) {
            require(msg.value == amountIn, "Bad msg.value");
        } else {
            require(msg.value == 0, "Don't send value with ERC20 side");
            require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "TransferFrom failed");
        }

        // Compute output with fee
        uint256 amountInWithFee = amountIn * (10000 - fee);
        uint256 reserveIn  = (amountAIn > 0) ? reserveA : reserveB;
        uint256 reserveOut = (amountAIn > 0) ? reserveB : reserveA;
        uint256 numerator   = amountInWithFee * reserveOut;
        uint256 denominator = (10000 * reserveIn) + amountInWithFee;
        amountOut = numerator / denominator;

        require(amountOut > 0 && amountOut < reserveOut, "Invalid output amount");

        // Send output
        _push(tokenOut, msg.sender, amountOut);
        _update();
        emit Swap(msg.sender, amountAIn, amountBIn, amountAIn == 0 ? amountOut : 0, amountAIn > 0 ? amountOut : 0);
    }

    function getAmountOut(uint256 amountIn, bool isAToB) external view returns (uint256 amountOut) {
        uint256 amountInWithFee = amountIn * (10000 - fee);
        uint256 reserveIn  = isAToB ? reserveA : reserveB;
        uint256 reserveOut = isAToB ? reserveB : reserveA;
        amountOut = (amountInWithFee * reserveOut) / ((10000 * reserveIn) + amountInWithFee);
    }

    function setFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high");
        fee = newFee;
    }

    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
