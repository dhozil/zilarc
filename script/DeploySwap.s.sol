// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";

contract DeployZilarcSwap is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;

        // Token addresses on Arc Testnet
        address usdc = 0x3600000000000000000000000000000000000000;
        address zToken = 0xdAca6186A7741d64C6bd7B33f918C46A52802c8A;

        vm.startBroadcast(deployerPrivateKey);

        ZilarcSwap swap = new ZilarcSwap(
            usdc, // tokenA = USDC
            zToken, // tokenB = Z Token
            owner // owner
        );

        vm.stopBroadcast();

        console.log("ZilarcSwap Pool deployed at:", address(swap));
        console.log("Token A (USDC):", usdc);
        console.log("Token B (Z):", zToken);
        console.log("Owner:", owner);
    }
}
