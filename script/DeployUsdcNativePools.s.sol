// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";

/**
 * @title DeployUsdcNativePools
 * @notice Deploy 3 AMM pools using the USDC precompile (0x3600…0000, native
 *         gas token on Arc Testnet) as tokenA. ZilarcSwap detects the
 *         precompile and handles it via msg.value / address(this).balance
 *         instead of transferFrom, so users swap native USDC 1:1 with no wrap
 *         step.
 *
 * Tokens (Arc Testnet):
 *   USDC precompile = 0x3600000000000000000000000000000000000000 (native, 18 dec)
 *   Z               = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6
 *   NEON            = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce
 *   JETT            = 0xcEe56f1CfF4D440Fac124706952a77805a728A70
 */
contract DeployUsdcNativePools is Script {
    address constant USDC_NATIVE = 0x3600000000000000000000000000000000000000;
    address constant Z_TOKEN     = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN  = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN  = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;

        vm.startBroadcast(deployerPrivateKey);

        ZilarcSwap usdcZ = new ZilarcSwap(USDC_NATIVE, Z_TOKEN, owner);
        console.log("USDC_NATIVE_Z_POOL=", address(usdcZ));

        ZilarcSwap usdcNeon = new ZilarcSwap(USDC_NATIVE, NEON_TOKEN, owner);
        console.log("USDC_NATIVE_NEON_POOL=", address(usdcNeon));

        ZilarcSwap usdcJett = new ZilarcSwap(USDC_NATIVE, JETT_TOKEN, owner);
        console.log("USDC_NATIVE_JETT_POOL=", address(usdcJett));

        vm.stopBroadcast();
    }
}
