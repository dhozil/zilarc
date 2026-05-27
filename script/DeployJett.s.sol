// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcToken.sol";

contract DeployJett is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address recipient = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;
        uint256 initialMint = 1_000_000 * 10 ** 18; // 1 juta JETT

        vm.startBroadcast(deployerPrivateKey);

        ZilarcToken token = new ZilarcToken(recipient, recipient, initialMint);

        vm.stopBroadcast();

        console.log("Jett Token deployed at:", address(token));
        console.log("Initial mint to:", recipient);
        console.log("Amount:", initialMint);
    }
}
