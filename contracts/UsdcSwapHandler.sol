// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title UsdcSwapHandler
 * @notice Lets users swap native USDC (Arc Testnet gas token) for the new
 *         Z / NEON / JETT tokens, and back, using an internal ledger and
 *         a fixed 1:1 rate. USDC at 0x3600…0000 is a precompile, not an
 *         ERC-20, so it can't be used directly in an AMM.
 *
 * Flow:
 *   - User calls depositUsdc() payable to credit internal balance.
 *   - User calls swapUsdcForToken(tokenOut, usdcAmount) — handler transfers
 *     tokenOut from its treasury at 1:1 (USDC 6-dec → tokenOut 18-dec scaled).
 *   - User calls swapTokenForUsdc(tokenIn, tokenAmount) — user transferFrom
 *     tokenIn to handler, handler credits internal USDC balance.
 *   - User calls withdrawUsdc(amount) to pull USDC native back.
 *
 * Pricing is intentionally fixed 1 USDC = 1 token (with decimal scaling).
 * This matches the EXCHANGE_RATES used in the UI and is a placeholder for
 * a future oracle / AMM-routed path.
 */
contract UsdcSwapHandler is Ownable {
    // Token addresses on Arc Testnet
    address public constant Z_TOKEN    = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address public constant NEON_TOKEN = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address public constant JETT_TOKEN = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    // Internal USDC balance per user (USDC has 6 decimals)
    mapping(address => uint256) public usdcBalance;

    // Treasury tracking per token (informational — actual balances live on ERC-20)
    mapping(address => uint256) public treasury;

    event UsdcDeposited(address indexed user, uint256 amount);
    event UsdcWithdrawn(address indexed user, uint256 amount);
    event SwappedUsdcForToken(address indexed user, address indexed tokenOut, uint256 usdcAmount, uint256 tokenAmount);
    event SwappedTokenForUsdc(address indexed user, address indexed tokenIn, uint256 tokenAmount, uint256 usdcAmount);
    event TreasuryFunded(address indexed token, uint256 amount);
    event TreasuryWithdrawn(address indexed token, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    receive() external payable {
        depositUsdc();
    }

    // ── USDC deposit / withdraw ───────────────────────────────────────
    function depositUsdc() public payable {
        require(msg.value > 0, "Must send USDC");
        usdcBalance[msg.sender] += msg.value;
        emit UsdcDeposited(msg.sender, msg.value);
    }

    function withdrawUsdc(uint256 amount) external {
        require(usdcBalance[msg.sender] >= amount, "Insufficient USDC balance");
        require(address(this).balance >= amount, "Handler out of USDC");
        usdcBalance[msg.sender] -= amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "USDC transfer failed");
        emit UsdcWithdrawn(msg.sender, amount);
    }

    // ── Swap USDC → token (1:1, USDC 6-dec → token 18-dec) ────────────
    function swapUsdcForToken(address tokenOut, uint256 usdcAmount) external {
        require(_isSupportedToken(tokenOut), "Unsupported token");
        require(usdcBalance[msg.sender] >= usdcAmount, "Insufficient USDC balance");

        // 1 USDC (6 dec) = 1 token (18 dec), so multiply by 1e12
        uint256 tokenAmount = usdcAmount * 1e12;
        require(treasury[tokenOut] >= tokenAmount, "Insufficient treasury");

        usdcBalance[msg.sender] -= usdcAmount;
        treasury[tokenOut]      -= tokenAmount;

        require(IERC20(tokenOut).transfer(msg.sender, tokenAmount), "Token transfer failed");
        emit SwappedUsdcForToken(msg.sender, tokenOut, usdcAmount, tokenAmount);
    }

    // ── Swap token → USDC (1:1, token 18-dec → USDC 6-dec) ────────────
    function swapTokenForUsdc(address tokenIn, uint256 tokenAmount) external {
        require(_isSupportedToken(tokenIn), "Unsupported token");

        uint256 usdcAmount = tokenAmount / 1e12;
        require(usdcAmount > 0, "Amount too small");
        require(address(this).balance >= usdcAmount, "Handler out of USDC");

        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), tokenAmount), "Token transferFrom failed");
        treasury[tokenIn] += tokenAmount;
        usdcBalance[msg.sender] += usdcAmount;

        emit SwappedTokenForUsdc(msg.sender, tokenIn, tokenAmount, usdcAmount);
    }

    // ── Owner treasury management ──────────────────────────────────────
    function fundTreasury(address token, uint256 amount) external onlyOwner {
        require(_isSupportedToken(token), "Unsupported token");
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Token transferFrom failed");
        treasury[token] += amount;
        emit TreasuryFunded(token, amount);
    }

    function withdrawTreasury(address token, uint256 amount) external onlyOwner {
        require(_isSupportedToken(token), "Unsupported token");
        require(treasury[token] >= amount, "Insufficient treasury");
        treasury[token] -= amount;
        require(IERC20(token).transfer(msg.sender, amount), "Token transfer failed");
        emit TreasuryWithdrawn(token, amount);
    }

    // ── Views ──────────────────────────────────────────────────────────
    function getAmountOut(address tokenOut, uint256 usdcAmount) external view returns (uint256) {
        if (!_isSupportedToken(tokenOut)) return 0;
        return usdcAmount * 1e12;
    }

    function _isSupportedToken(address token) internal pure returns (bool) {
        return token == Z_TOKEN || token == NEON_TOKEN || token == JETT_TOKEN;
    }
}
