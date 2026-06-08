// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";

/**
 * @title DeployUsdcWrapperPools
 * @notice Deploy AMM pools using the USDC ERC-20 wrapper (0xabeed…712f)
 *         as tokenA. The earlier DeployUsdcPairs used the USDC precompile
 *         (0x3600…0000), which has no transferFrom, so those pools can't
 *         actually swap. The wrapper is a real ERC-20 with 18 decimals.
 *
 * Token addresses (Arc Testnet):
 *   USDC wrapper = 0xAbEedDb87978E55233a695c1AF0861Da5c0e712f (18 decimals)
 *   Z            = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6 (18 decimals)
 *   NEON         = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce (18 decimals)
 *   JETT         = 0xcEe56f1CfF4D440Fac124706952a77805a728A70 (18 decimals)
 *
 * Pool convention: tokenA = USDC wrapper, tokenB = Z/NEON/JETT.
 */
contract DeployUsdcWrapperPools is Script {
    address constant USDC_WRAPPER = 0xAbEedDb87978E55233a695c1AF0861Da5c0e712f;
    address constant Z_TOKEN      = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN   = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN   = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;

        vm.startBroadcast(deployerPrivateKey);

        ZilarcSwap usdcZ = new ZilarcSwap(USDC_WRAPPER, Z_TOKEN, owner);
        console.log("USDC_WRAPPER_Z_POOL=", address(usdcZ));

        ZilarcSwap usdcNeon = new ZilarcSwap(USDC_WRAPPER, NEON_TOKEN, owner);
        console.log("USDC_WRAPPER_NEON_POOL=", address(usdcNeon));

        ZilarcSwap usdcJett = new ZilarcSwap(USDC_WRAPPER, JETT_TOKEN, owner);
        console.log("USDC_WRAPPER_JETT_POOL=", address(usdcJett));

        vm.stopBroadcast();
    }
}
