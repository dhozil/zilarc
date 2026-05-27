// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";

contract DeployCrossPools is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;

        address Z_TOKEN = 0xdAca6186A7741d64C6bd7B33f918C46A52802c8A;
        address NEON_TOKEN = 0x3713467C2a5E0ab12876f93DbcA7Cfc6b6B40909;
        address JETT_TOKEN = 0x404d8405753987E4f26e0E858fE5F5A1649ba35a;

        uint256 INITIAL_AMOUNT = 200 * 10 ** 18;

        vm.startBroadcast(deployerPrivateKey);

        // Z/NEON Pool
        console.log("Deploying Z/NEON pool...");
        ZilarcSwap zNeonPool = new ZilarcSwap(Z_TOKEN, NEON_TOKEN, owner);
        console.log("Z/NEON Pool:", address(zNeonPool));

        // Z/JETT Pool
        console.log("Deploying Z/JETT pool...");
        ZilarcSwap zJettPool = new ZilarcSwap(Z_TOKEN, JETT_TOKEN, owner);
        console.log("Z/JETT Pool:", address(zJettPool));

        // NEON/JETT Pool
        console.log("Deploying NEON/JETT pool...");
        ZilarcSwap neonJettPool = new ZilarcSwap(NEON_TOKEN, JETT_TOKEN, owner);
        console.log("NEON/JETT Pool:", address(neonJettPool));

        vm.stopBroadcast();
    }
}

contract AddCrossLiquidity is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;

        address Z_TOKEN = 0xdAca6186A7741d64C6bd7B33f918C46A52802c8A;
        address NEON_TOKEN = 0x3713467C2a5E0ab12876f93DbcA7Cfc6b6B40909;
        address JETT_TOKEN = 0x404d8405753987E4f26e0E858fE5F5A1649ba35a;

        address Z_NEON_POOL = 0xa046978A1B6E616282b179375cedB0d913ab6126;
        address Z_JETT_POOL = 0x68C78596b153443D99516455391d9BCD4824711B;
        address NEON_JETT_POOL = 0x7C91DbcD4d65587F9b10FCB2bc780aA646cFD6a9;

        uint256 INITIAL_AMOUNT = 200 * 10 ** 18;

        vm.startBroadcast(deployerPrivateKey);

        // Add Z/NEON liquidity
        console.log("Adding Z/NEON liquidity...");
        ZilarcSwap(Z_NEON_POOL).addLiquidity(INITIAL_AMOUNT, INITIAL_AMOUNT);

        // Add Z/JETT liquidity
        console.log("Adding Z/JETT liquidity...");
        ZilarcSwap(Z_JETT_POOL).addLiquidity(INITIAL_AMOUNT, INITIAL_AMOUNT);

        // Add NEON/JETT liquidity
        console.log("Adding NEON/JETT liquidity...");
        ZilarcSwap(NEON_JETT_POOL).addLiquidity(INITIAL_AMOUNT, INITIAL_AMOUNT);

        console.log("All cross-pool liquidity added!");
        vm.stopBroadcast();
    }
}
