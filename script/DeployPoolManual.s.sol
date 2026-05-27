// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployPoolManual
 * @dev Deploy pools dengan approve terpisah untuk avoid USDC proxy issues
 */
contract DeployPoolManual is Script {
    // Token addresses
    address constant NEON_TOKEN = 0x3713467C2a5E0ab12876f93DbcA7Cfc6b6B40909;
    address constant JETT_TOKEN = 0x404d8405753987E4f26e0E858fE5F5A1649ba35a;
    address constant USDC = 0x3600000000000000000000000000000000000000;

    // 200 USDC (6 decimals) + 200 tokens (18 decimals)
    uint256 constant INITIAL_USDC = 200 * 10 ** 6;
    uint256 constant INITIAL_TOKEN = 200 * 10 ** 18;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;

        vm.startBroadcast(deployerPrivateKey);

        // === Deploy NEON Pool ===
        console.log("=== Deploying NEON Pool ===");
        ZilarcSwap neonPool = new ZilarcSwap(USDC, NEON_TOKEN, owner);
        console.log("Neon Pool:", address(neonPool));

        // === Deploy JETT Pool ===
        console.log("=== Deploying JETT Pool ===");
        ZilarcSwap jettPool = new ZilarcSwap(USDC, JETT_TOKEN, owner);
        console.log("Jett Pool:", address(jettPool));

        vm.stopBroadcast();
        console.log("");
        console.log("Pools deployed! Now run addLiquidity manually.");
    }
}

/**
 * @title AddLiquidityManual
 * @dev Add liquidity ke pools yang sudah deployed
 */
contract AddLiquidityManual is Script {
    address constant NEON_TOKEN = 0x3713467C2a5E0ab12876f93DbcA7Cfc6b6B40909;
    address constant JETT_TOKEN = 0x404d8405753987E4f26e0E858fE5F5A1649ba35a;
    address constant NEON_POOL = 0x26Cb48F4C8e014604c4f890e88aB76ad9DDC64b8;
    address constant JETT_POOL = 0x65aEBaD4E6FAE62ab67526131E66A903D5C025f7;
    address constant USDC = 0x3600000000000000000000000000000000000000;

    uint256 constant INITIAL_USDC = 200 * 10 ** 6;
    uint256 constant INITIAL_TOKEN = 200 * 10 ** 18;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Add liquidity to Neon pool
        console.log("Adding liquidity to Neon pool...");
        ZilarcSwap(NEON_POOL).addLiquidity(INITIAL_USDC, INITIAL_TOKEN);

        // Add liquidity to Jett pool
        console.log("Adding liquidity to Jett pool...");
        ZilarcSwap(JETT_POOL).addLiquidity(INITIAL_USDC, INITIAL_TOKEN);

        vm.stopBroadcast();
        console.log("Done!");
    }
}
