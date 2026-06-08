// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SeedUsdcNativePools
 * @notice Seed initial liquidity into 3 AMM pools that use the USDC precompile
 *         (native gas token) as tokenA. addLiquidity requires msg.value == amountA
 *         when tokenA is the precompile, so we send native USDC alongside the
 *         ERC-20 tokenB transfer.
 *
 * Pool addresses (deployed 2026-06-03 via DeployUsdcNativePools):
 *   USDC/Z    = 0xf620b9c807bf7dc18b9cc50f7833c90abd630187
 *   USDC/NEON = 0xeddbcd15aa35885fd078c93ca2d9916d9a295305
 *   USDC/JETT = 0x52cbe4119d29167a2bc57b4a7c618798928af212
 *
 * Seed: 3.5 USDC native (3.5e6 raw, 6 dec) + 3.5e18 Z/NEON/JETT per side per pool.
 * Total native USDC needed: 10.5 USDC (deployer holds ~11.7). Leaves buffer for
 * gas + test swaps.
 */
contract SeedUsdcNativePools is Script {
    address constant Z_TOKEN    = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    address constant USDC_Z_POOL    = 0xF620b9c807bF7Dc18B9Cc50f7833c90abD630187;
    address constant USDC_NEON_POOL = 0xeDdbCd15aa35885fd078c93Ca2d9916D9A295305;
    address constant USDC_JETT_POOL = 0x52CBe4119D29167a2bc57b4A7C618798928AF212;

    uint256 constant USDC_AMOUNT  = 35 * 10 ** 5;   // 3.5 USDC native (6 dec, raw = 3.5e6)
    uint256 constant TOKEN_AMOUNT = 35 * 10 ** 17;  // 3.5 of Z/NEON/JETT (18 dec)

    function _reseed(address pool, address token, address deployer, string memory label) internal {
        // Burn existing deployer LP (from prior mis-seeded run with 3.5e18 raw USDC).
        uint256 lp = ZilarcSwap(pool).balanceOf(deployer);
        if (lp > 0) {
            ZilarcSwap(pool).removeLiquidity(lp);
            console.log(string.concat(label, ": removed ", vm.toString(lp), " LP"));
        }

        // Approve token side (USDC side sent as msg.value).
        IERC20(token).approve(pool, TOKEN_AMOUNT);

        // Seed with correct 6-dec USDC + 18-dec token.
        ZilarcSwap(pool).addLiquidity{value: USDC_AMOUNT}(USDC_AMOUNT, TOKEN_AMOUNT);
        console.log(string.concat(label, ": reseeded 3.5 USDC + 3.5 token"));
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        _reseed(USDC_Z_POOL,    Z_TOKEN,    deployer, "USDC/Z");
        _reseed(USDC_NEON_POOL, NEON_TOKEN, deployer, "USDC/NEON");
        _reseed(USDC_JETT_POOL, JETT_TOKEN, deployer, "USDC/JETT");

        vm.stopBroadcast();
    }
}
