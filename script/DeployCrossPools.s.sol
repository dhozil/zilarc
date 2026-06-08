// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployCrossPools
 * @notice Deploy 3 cross-pools for the new Z, NEON, JETT tokens on Arc Testnet.
 *
 * Token addresses (Arc Testnet):
 *   Z    = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6
 *   NEON = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce
 *   JETT = 0xcEe56f1CfF4D440Fac124706952a77805a728A70
 *
 * Pool ordering convention (tokenA, tokenB) — kept consistent to avoid
 * (A,B) vs (B,A) duplicate-pair deploys:
 *   - Z_NEON_POOL:     (Z, NEON)
 *   - Z_JETT_POOL:     (Z, JETT)
 *   - NEON_JETT_POOL:  (NEON, JETT)
 */
contract DeployCrossPools is Script {
    address constant Z_TOKEN = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;

        vm.startBroadcast(deployerPrivateKey);

        // Z/NEON pool
        ZilarcSwap zNeon = new ZilarcSwap(Z_TOKEN, NEON_TOKEN, owner);
        console.log("Z_NEON_POOL=", address(zNeon));

        // Z/JETT pool
        ZilarcSwap zJett = new ZilarcSwap(Z_TOKEN, JETT_TOKEN, owner);
        console.log("Z_JETT_POOL=", address(zJett));

        // NEON/JETT pool
        ZilarcSwap neonJett = new ZilarcSwap(NEON_TOKEN, JETT_TOKEN, owner);
        console.log("NEON_JETT_POOL=", address(neonJett));

        vm.stopBroadcast();
    }
}

/**
 * @title AddCrossLiquidity
 * @notice Seed initial liquidity into the 3 cross-pools.
 *
 * Reads pool addresses from env (set these AFTER running DeployCrossPools):
 *   export Z_NEON_POOL=0x...
 *   export Z_JETT_POOL=0x...
 *   export NEON_JETT_POOL=0x...
 *
 * Seeds 200 of each side (18 decimals) per pool. The previous version of
 * this script forgot to call `approve()` and would have reverted at
 * `transferFrom`; this version approves both sides before each addLiquidity.
 */
contract AddCrossLiquidity is Script {
    address constant Z_TOKEN = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    uint256 constant INITIAL_AMOUNT = 200 * 10 ** 18;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        address zNeonPool = vm.envAddress("Z_NEON_POOL");
        address zJettPool = vm.envAddress("Z_JETT_POOL");
        address neonJettPool = vm.envAddress("NEON_JETT_POOL");

        vm.startBroadcast(deployerPrivateKey);

        // Z/NEON
        IERC20(Z_TOKEN).approve(zNeonPool, INITIAL_AMOUNT);
        IERC20(NEON_TOKEN).approve(zNeonPool, INITIAL_AMOUNT);
        ZilarcSwap(zNeonPool).addLiquidity(INITIAL_AMOUNT, INITIAL_AMOUNT);
        console.log("Z/NEON liquidity seeded");

        // Z/JETT
        IERC20(Z_TOKEN).approve(zJettPool, INITIAL_AMOUNT);
        IERC20(JETT_TOKEN).approve(zJettPool, INITIAL_AMOUNT);
        ZilarcSwap(zJettPool).addLiquidity(INITIAL_AMOUNT, INITIAL_AMOUNT);
        console.log("Z/JETT liquidity seeded");

        // NEON/JETT
        IERC20(NEON_TOKEN).approve(neonJettPool, INITIAL_AMOUNT);
        IERC20(JETT_TOKEN).approve(neonJettPool, INITIAL_AMOUNT);
        ZilarcSwap(neonJettPool).addLiquidity(INITIAL_AMOUNT, INITIAL_AMOUNT);
        console.log("NEON/JETT liquidity seeded");

        vm.stopBroadcast();
    }
}
