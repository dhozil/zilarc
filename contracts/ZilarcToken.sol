// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Zilarc Token (Z)
 * @dev ERC-20 token for Zilarc DEX on Arc Network
 *
 * Token Details:
 * - Name: Zilarc
 * - Symbol: Z
 * - Decimals: 18
 * - Total Supply: 100,000,000 Z
 */
contract ZilarcToken is ERC20, Ownable {
    constructor(
        address initialOwner,
        address recipient,
        uint256 initialMintAmount
    ) ERC20("Zilarc", "Z") Ownable(initialOwner) {
        // Mint initial amount to recipient
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
