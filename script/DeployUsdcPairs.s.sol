// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployUsdcPairs
 * @notice Deploy 3 fresh USDC-pair pools referencing the NEW Z/NEON/JETT
 *         token addresses. The previous USDC pools referenced the old
 *         Z/NEON/JETT addresses and must be replaced.
 *
 *   USDC (wrapper)    = 0xAbEedDb87978E55233a695c1AF0861Da5c0e712f (6 decimals)
 *                       NOTE: native USDC precompile 0x3600...0000 does NOT
 *                       support transferFrom — wrapper ERC-20 is required.
 *   Z                 = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6
 *   NEON              = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce
 *   JETT              = 0xcEe56f1CfF4D440Fac124706952a77805a728A70
 *
 * Pool ordering (tokenA, tokenB) — USDC is always tokenA, consistent with
 * the previous deployment so future readers don't get confused.
 */
contract DeployUsdcPairs is Script {
    address constant USDC = 0xAbEedDb87978E55233a695c1AF0861Da5c0e712f;
    address constant Z_TOKEN = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;

        vm.startBroadcast(deployerPrivateKey);

        // USDC / Z
        ZilarcSwap usdcZ = new ZilarcSwap(USDC, Z_TOKEN, owner);
        console.log("USDC_Z=", address(usdcZ));

        // USDC / NEON
        ZilarcSwap usdcNeon = new ZilarcSwap(USDC, NEON_TOKEN, owner);
        console.log("USDC_NEON=", address(usdcNeon));

        // USDC / JETT
        ZilarcSwap usdcJett = new ZilarcSwap(USDC, JETT_TOKEN, owner);
        console.log("USDC_JETT=", address(usdcJett));

        vm.stopBroadcast();
    }
}

/**
 * @title SeedUsdcPairs
 * @notice Seed initial liquidity into the 3 fresh USDC pools. Reads pool
 *         addresses from env. USDC uses 6 decimals, Z/NEON/JETT use 18.
 *         200 USDC + 200 Z (1:1 valuation assumption; tweak as needed).
 */
contract SeedUsdcPairs is Script {
    address constant USDC = 0xAbEedDb87978E55233a695c1AF0861Da5c0e712f;
    address constant Z_TOKEN = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    uint256 constant USDC_AMOUNT = 200 * 10 ** 6;  // 6 decimals
    uint256 constant TOKEN_AMOUNT = 200 * 10 ** 18; // 18 decimals

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        address usdcZPool    = vm.envAddress("USDC_Z_POOL");
        address usdcNeonPool = vm.envAddress("USDC_NEON_POOL");
        address usdcJettPool = vm.envAddress("USDC_JETT_POOL");

        vm.startBroadcast(deployerPrivateKey);

        // USDC / Z
        IERC20(USDC).approve(usdcZPool, USDC_AMOUNT);
        IERC20(Z_TOKEN).approve(usdcZPool, TOKEN_AMOUNT);
        ZilarcSwap(usdcZPool).addLiquidity(USDC_AMOUNT, TOKEN_AMOUNT);
        console.log("USDC/Z seeded");

        // USDC / NEON
        IERC20(USDC).approve(usdcNeonPool, USDC_AMOUNT);
        IERC20(NEON_TOKEN).approve(usdcNeonPool, TOKEN_AMOUNT);
        ZilarcSwap(usdcNeonPool).addLiquidity(USDC_AMOUNT, TOKEN_AMOUNT);
        console.log("USDC/NEON seeded");

        // USDC / JETT
        IERC20(USDC).approve(usdcJettPool, USDC_AMOUNT);
        IERC20(JETT_TOKEN).approve(usdcJettPool, TOKEN_AMOUNT);
        ZilarcSwap(usdcJettPool).addLiquidity(USDC_AMOUNT, TOKEN_AMOUNT);
        console.log("USDC/JETT seeded");

        vm.stopBroadcast();
    }
}
