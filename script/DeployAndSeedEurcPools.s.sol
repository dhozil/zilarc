// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";
import "../contracts/ZilarcRouter.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployAndSeedEurcPools
 * @notice One-shot script that brings EURC into the Zilarc AMM:
 *          1. Deploys 4 new ZilarcSwap pools paired with EURC.
 *          2. Registers each pool in the existing ZilarcRouter.
 *          3. Approves and seeds initial liquidity into all 4 pools.
 *
 *         Run this ONCE after the deployer EOA has acquired EURC inventory
 *         on Arc Testnet (via Circle faucet or out-of-band mint). The
 *         seeded ratio is 1:1 in human terms, which the AMM math handles
 *         correctly even though EURC uses 6 decimals and USDC/Z/NEON/JETT
 *         use 18.
 *
 *         Pre-flight checklist (deployer EOA balances, in human units):
 *           EURC native (6 dec)   ≥ 4 × seedUnits
 *           USDC native (18 dec)  ≥ 1 × seedUnits   (for USDC/EURC pool)
 *           Z, NEON, JETT (18)    ≥ 1 × seedUnits each
 *
 * Usage:
 *   forge script script/DeployAndSeedEurcPools.s.sol:DeployAndSeedEurcPools \
 *     --sig "run(uint256)" 5 \
 *     --rpc-url $ARCTEST_RPC_URL --broadcast --legacy --slow
 *
 *   "5" = 5 human units per side per pool. Total EURC required = 20.
 */
contract DeployAndSeedEurcPools is Script {
    address constant ROUTER      = 0x72F8C8e1b027aca6d4e2474E58fc4FdFB1D193b9;

    address constant USDC_NATIVE = 0x3600000000000000000000000000000000000000;
    address constant EURC_TOKEN  = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;
    address constant Z_TOKEN     = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN  = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN  = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    // Decimals (raw scale per 1 human unit):
    uint256 constant SCALE_18 = 1e18;
    uint256 constant SCALE_6  = 1e6;

    function run() external {
        run(5); // default: 5 human units per side per pool
    }

    function run(uint256 seedUnits) public {
        require(seedUnits > 0, "seedUnits=0");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        uint256 usdcRaw = seedUnits * SCALE_18;   // USDC native: 18 dec
        uint256 eurcRaw = seedUnits * SCALE_6;    // EURC: 6 dec
        uint256 tokenRaw = seedUnits * SCALE_18;  // Z/NEON/JETT: 18 dec

        // Sanity: deployer must hold enough EURC up-front (4 pools × seedUnits)
        uint256 eurcBal = IERC20(EURC_TOKEN).balanceOf(deployer);
        uint256 eurcNeeded = 4 * eurcRaw;
        require(eurcBal >= eurcNeeded, "Deployer EURC balance too low");

        console.log("Deployer:", deployer);
        console.log("Seed units per side per pool:", seedUnits);
        console.log("EURC raw needed (4 pools):", eurcNeeded);
        console.log("USDC native raw needed:", usdcRaw);
        console.log("Z/NEON/JETT raw each:", tokenRaw);

        vm.startBroadcast(deployerPrivateKey);

        // ── 1. Deploy 4 pools ──────────────────────────────────────
        // Pool tokenA/tokenB ordering is (USDC|EURC|EURC|EURC) first
        // so the precompile / EURC always sits on tokenA. The router
        // sanity-checks pair membership, not order, so this is just a
        // convention.
        ZilarcSwap usdcEurc = new ZilarcSwap(USDC_NATIVE, EURC_TOKEN, deployer);
        console.log("USDC_EURC_POOL=", address(usdcEurc));

        ZilarcSwap eurcZ    = new ZilarcSwap(EURC_TOKEN, Z_TOKEN,    deployer);
        console.log("EURC_Z_POOL=", address(eurcZ));

        ZilarcSwap eurcNeon = new ZilarcSwap(EURC_TOKEN, NEON_TOKEN, deployer);
        console.log("EURC_NEON_POOL=", address(eurcNeon));

        ZilarcSwap eurcJett = new ZilarcSwap(EURC_TOKEN, JETT_TOKEN, deployer);
        console.log("EURC_JETT_POOL=", address(eurcJett));

        // ── 2. Register pools in router ────────────────────────────
        ZilarcRouter router = ZilarcRouter(payable(ROUTER));
        router.registerPool(USDC_NATIVE, EURC_TOKEN,  address(usdcEurc));
        router.registerPool(EURC_TOKEN,  Z_TOKEN,     address(eurcZ));
        router.registerPool(EURC_TOKEN,  NEON_TOKEN,  address(eurcNeon));
        router.registerPool(EURC_TOKEN,  JETT_TOKEN,  address(eurcJett));
        console.log("Registered 4 EURC pools. Router pool count:", router.poolCount());

        // ── 3. Approve + seed liquidity ────────────────────────────
        // USDC/EURC: USDC native via msg.value, EURC via transferFrom
        IERC20(EURC_TOKEN).approve(address(usdcEurc), eurcRaw);
        usdcEurc.addLiquidity{value: usdcRaw}(usdcRaw, eurcRaw);
        console.log("USDC/EURC seeded.");

        // EURC/Z
        IERC20(EURC_TOKEN).approve(address(eurcZ), eurcRaw);
        IERC20(Z_TOKEN).approve(address(eurcZ), tokenRaw);
        eurcZ.addLiquidity(eurcRaw, tokenRaw);
        console.log("EURC/Z seeded.");

        // EURC/NEON
        IERC20(EURC_TOKEN).approve(address(eurcNeon), eurcRaw);
        IERC20(NEON_TOKEN).approve(address(eurcNeon), tokenRaw);
        eurcNeon.addLiquidity(eurcRaw, tokenRaw);
        console.log("EURC/NEON seeded.");

        // EURC/JETT
        IERC20(EURC_TOKEN).approve(address(eurcJett), eurcRaw);
        IERC20(JETT_TOKEN).approve(address(eurcJett), tokenRaw);
        eurcJett.addLiquidity(eurcRaw, tokenRaw);
        console.log("EURC/JETT seeded.");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Update src/lib/wagmi.ts SWAP_POOLS with: ===");
        console.log("  USDC_EURC:", address(usdcEurc));
        console.log("  EURC_Z:   ", address(eurcZ));
        console.log("  EURC_NEON:", address(eurcNeon));
        console.log("  EURC_JETT:", address(eurcJett));
    }
}
