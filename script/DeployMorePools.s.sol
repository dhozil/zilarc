// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployMorePools
 * @dev Deploys Neon and Jett liquidity pools with initial liquidity
 *
 * Prerequisites:
 * 1. Deploy Neon token:    forge script script/DeployNeon.s.sol --rpc-url $ARC_TESTNET_RPC_URL --private-key $PRIVATE_KEY --broadcast
 * 2. Deploy Jett token:    forge script script/DeployJett.s.sol --rpc-url $ARC_TESTNET_RPC_URL --private-key $PRIVATE_KEY --broadcast
 * 3. Get USDC from faucet:  https://faucet.circle.com
 * 4. Update NEON_TOKEN and JETT_TOKEN addresses below
 * 5. Run this script
 */
contract DeployMorePools is Script {
    // TODO: Update these addresses after deploying Neon and Jett tokens
    address constant NEON_TOKEN = 0x3713467C2a5E0ab12876f93DbcA7Cfc6b6B40909;
    address constant JETT_TOKEN = 0x404d8405753987E4f26e0E858fE5F5A1649ba35a;

    // USDC on Arc Testnet
    address constant USDC = 0x3600000000000000000000000000000000000000;

    // Initial liquidity amounts (USDC has 6 decimals, tokens have 18)
    uint256 constant INITIAL_USDC = 200 * 10 ** 6;     // 200 USDC
    uint256 constant INITIAL_TOKEN = 200 * 10 ** 18;   // 200 tokens

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;

        vm.startBroadcast(deployerPrivateKey);

        // 1. Approve and add liquidity to Neon pool
        console.log("=== Deploying Neon Pool ===");

        // Deploy Neon pool (USDC as tokenA, NEON as tokenB)
        ZilarcSwap neonPool = new ZilarcSwap(USDC, NEON_TOKEN, owner);
        console.log("Neon Pool deployed at:", address(neonPool));

        // Approve tokens for liquidity
        IERC20(USDC).approve(address(neonPool), INITIAL_USDC);
        IERC20(NEON_TOKEN).approve(address(neonPool), INITIAL_TOKEN);
        console.log("Approved USDC and NEON for Neon pool");

        // Add initial liquidity
        neonPool.addLiquidity(INITIAL_USDC, INITIAL_TOKEN);
        console.log("Added initial liquidity to Neon pool");
        console.log("  USDC:", INITIAL_USDC);
        console.log("  NEON:", INITIAL_TOKEN);

        // 2. Approve and add liquidity to Jett pool
        console.log("");
        console.log("=== Deploying Jett Pool ===");

        // Deploy Jett pool (USDC as tokenA, JETT as tokenB)
        ZilarcSwap jettPool = new ZilarcSwap(USDC, JETT_TOKEN, owner);
        console.log("Jett Pool deployed at:", address(jettPool));

        // Approve tokens for liquidity
        IERC20(USDC).approve(address(jettPool), INITIAL_USDC);
        IERC20(JETT_TOKEN).approve(address(jettPool), INITIAL_TOKEN);
        console.log("Approved USDC and JETT for Jett pool");

        // Add initial liquidity
        jettPool.addLiquidity(INITIAL_USDC, INITIAL_TOKEN);
        console.log("Added initial liquidity to Jett pool");
        console.log("  USDC:", INITIAL_USDC);
        console.log("  JETT:", INITIAL_TOKEN);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Summary ===");
        console.log("NEON Pool:   ", address(neonPool));
        console.log("JETT Pool:   ", address(jettPool));
        console.log("");
        console.log("After deployment, update your frontend with these addresses!");
    }
}