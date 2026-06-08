// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcToken.sol";

/**
 * @title DeployUsdcWrapper
 * @notice Deploy a wrapper USDC ERC-20 using ZilarcToken. The native USDC
 *         precompile on Arc Testnet (0x3600...0000) does not support
 *         `transferFrom` — it is gas-token only — so AMM pools that need
 *         `IERC20.transferFrom` cannot reference it directly.
 *
 *         Solution: deploy a wrapper ERC-20 with 6 decimals and 1,000,000
 *         initial mint. Frontend wires USDC swaps/liquidity to this address
 *         instead of the precompile.
 */
contract DeployUsdcWrapper is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address recipient = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;
        uint256 initialMint = 1_000_000 * 10 ** 6; // 1 juta USDC, 6 decimals

        vm.startBroadcast(deployerPrivateKey);

        ZilarcToken usdc = new ZilarcToken(
            "USD Coin (wrapper)", // tokenName
            "USDC",               // tokenSymbol
            recipient,            // initialOwner
            recipient,            // recipient
            initialMint           // initialMintAmount
        );

        vm.stopBroadcast();

        console.log("USDC wrapper deployed at:", address(usdc));
        console.log("Initial mint to:", recipient);
        console.log("Amount:", initialMint);
    }
}
