// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcRouter.sol";

/**
 * @title DeployRouter
 * @notice Deploy ZilarcRouter and register all 6 existing AMM pools so a
 *         single tx (router.swap) can route any supported pair on Arc.
 *
 * After running this script:
 *   1. Note the printed `ZILARC_ROUTER` address.
 *   2. Update `ZILARC_ROUTER` in `src/lib/wagmi.ts`.
 *   3. Reseed USDC native pools with correct ratios via `ReseedUsdcNativePools`
 *      if the existing reserves are skewed.
 *
 * Pool addresses below mirror the constants in src/lib/wagmi.ts:
 *   USDC native ↔ Z / NEON / JETT      (precompile-side pools)
 *   Z ↔ NEON, Z ↔ JETT, NEON ↔ JETT    (ERC-20 cross-pools)
 */
contract DeployRouter is Script {
    address constant USDC_NATIVE = 0x3600000000000000000000000000000000000000;
    address constant Z_TOKEN     = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN  = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN  = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    // USDC native pools (deployed via DeployUsdcNativePools, seeded via SeedUsdcNativePools).
    address constant USDC_Z_POOL    = 0xF620b9c807bF7Dc18B9Cc50f7833c90abD630187;
    address constant USDC_NEON_POOL = 0xeDdbCd15aa35885fd078c93Ca2d9916D9A295305;
    address constant USDC_JETT_POOL = 0x52CBe4119D29167a2bc57b4A7C618798928AF212;

    // Cross-token AMM pools (deployed via DeployCrossPools).
    address constant Z_NEON_POOL    = 0xb57449127d3B158aFcB23C81780789F1e169b224;
    address constant Z_JETT_POOL    = 0xEEbBB08A86AA26cDAA50E12E7630b84D550b9042;
    address constant NEON_JETT_POOL = 0xc411557A60Ce64B700Fe02fFbD4EeaEFE2af3F51;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        ZilarcRouter router = new ZilarcRouter(owner);
        console.log("ZILARC_ROUTER=", address(router));

        // Register USDC native pools
        router.registerPool(USDC_NATIVE, Z_TOKEN,    USDC_Z_POOL);
        router.registerPool(USDC_NATIVE, NEON_TOKEN, USDC_NEON_POOL);
        router.registerPool(USDC_NATIVE, JETT_TOKEN, USDC_JETT_POOL);

        // Register cross-token pools
        router.registerPool(Z_TOKEN,    NEON_TOKEN, Z_NEON_POOL);
        router.registerPool(Z_TOKEN,    JETT_TOKEN, Z_JETT_POOL);
        router.registerPool(NEON_TOKEN, JETT_TOKEN, NEON_JETT_POOL);

        console.log("Registered 6 pools");
        console.log("Pool count:", router.poolCount());

        vm.stopBroadcast();
    }
}
