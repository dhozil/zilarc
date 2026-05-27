// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";

/**
 * @title DeployAllPairs
 * @dev Deploy ALL cross-pairs pools for Z, NEON, JETT, USDC
 *
 * Pairs:
 * 1. Z/NEON (existing Z pool already has USDC/Z)
 * 2. Z/JETT
 * 3. NEON/JETT
 */
contract DeployAllPairs is Script {
    // Token addresses
    address constant Z_TOKEN = 0xdAca6186A7741d64C6bd7B33f918C46A52802c8A;
    address constant NEON_TOKEN = 0x3713467C2a5E0ab12876f93DbcA7Cfc6b6B40909;
    address constant JETT_TOKEN = 0x404d8405753987E4f26e0E858fE5F5A1649ba35a;
    address constant USDC = 0x3600000000000000000000000000000000000000;

    // 200 of each token (18 decimals)
    uint256 constant INITIAL_TOKEN_A = 200 * 10 ** 18;
    uint256 constant INITIAL_TOKEN_B = 200 * 10 ** 18;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;

        vm.startBroadcast(deployerPrivateKey);

        // 1. Z/NEON Pool
        console.log("=== Z/NEON Pool ===");
        ZilarcSwap zNeon = new ZilarcSwap(Z_TOKEN, NEON_TOKEN, owner);
        console.log("Z/NEON Pool:", address(zNeon));

        // 2. Z/JETT Pool
        console.log("=== Z/JETT Pool ===");
        ZilarcSwap zJett = new ZilarcSwap(Z_TOKEN, JETT_TOKEN, owner);
        console.log("Z/JETT Pool:", address(zJett));

        // 3. NEON/JETT Pool
        console.log("=== NEON/JETT Pool ===");
        ZilarcSwap neonJett = new ZilarcSwap(NEON_TOKEN, JETT_TOKEN, owner);
        console.log("NEON/JETT Pool:", address(neonJett));

        vm.stopBroadcast();
        console.log("");
        console.log("All cross-pairs deployed!");
    }
}

/**
 * @title AddCrossPairLiquidity
 * @dev Add liquidity to cross-pairs pools
 */
contract AddCrossPairLiquidity is Script {
    address constant Z_TOKEN = 0xdAca6186A7741d64C6bd7B33f918C46A52802c8A;
    address constant NEON_TOKEN = 0x3713467C2a5E0ab12876f93DbcA7Cfc6b6B40909;
    address constant JETT_TOKEN = 0x404d8405753987E4f26e0E858fE5F5A1649ba35a;

    // UPDATE after deploying pools
    address constant Z_NEON_POOL = 0x9aa9c6d1E6a39e56E408B7b7d1644bD4c94A504f;
    address constant Z_JETT_POOL = 0xe450fbb9935480e217D118639Ec6071e128dd2d2;
    address constant NEON_JETT_POOL = 0x62cf458a17F023fC2Ff6A8b088339E8a1ADfeE8d;

    uint256 constant INITIAL_A = 200 * 10 ** 18;
    uint256 constant INITIAL_B = 200 * 10 ** 18;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Z/NEON
        console.log("Adding Z/NEON liquidity...");
        ZilarcSwap(Z_NEON_POOL).addLiquidity(INITIAL_A, INITIAL_B);

        // Z/JETT
        console.log("Adding Z/JETT liquidity...");
        ZilarcSwap(Z_JETT_POOL).addLiquidity(INITIAL_A, INITIAL_B);

        // NEON/JETT
        console.log("Adding NEON/JETT liquidity...");
        ZilarcSwap(NEON_JETT_POOL).addLiquidity(INITIAL_A, INITIAL_B);

        vm.stopBroadcast();
        console.log("Done!");
    }
}
