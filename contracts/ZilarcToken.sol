// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Zilarc Token
 * @dev ERC-20 token factory for Zilarc DEX on Arc Network
 *      Name and symbol are passed in at deploy time so the same
 *      contract can be used for Zilarc (Z), Neon (NEON), Jett (JETT), etc.
 */
contract ZilarcToken is ERC20, Ownable {
    constructor(
        string memory tokenName,
        string memory tokenSymbol,
        address initialOwner,
        address recipient,
        uint256 initialMintAmount
    ) ERC20(tokenName, tokenSymbol) Ownable(initialOwner) {
        _mint(recipient, initialMintAmount);
    }

    /**
     * @dev Mint new tokens (only owner)
     * @param to Address to receive tokens
     * @param amount Amount to mint (in wei, 18 decimals)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /**
     * @dev Burn tokens from caller
     * @param amount Amount to burn (in wei, 18 decimals)
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
