// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/UsdcSwapHandler.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployUsdcHandler
 * @notice Deploys UsdcSwapHandler and seeds the treasury with 200 each of
 *         Z, NEON, JETT so swaps can be tested immediately.
 */
contract DeployUsdcHandler is Script {
    address constant Z_TOKEN    = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;
    uint256 constant SEED_AMOUNT = 200 * 10 ** 18;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;

        vm.startBroadcast(deployerPrivateKey);

        UsdcSwapHandler handler = new UsdcSwapHandler(owner);
        console.log("USDC_HANDLER=", address(handler));

        // Approve handler to pull tokens from deployer for treasury seed
        IERC20(Z_TOKEN).approve(address(handler), SEED_AMOUNT);
        IERC20(NEON_TOKEN).approve(address(handler), SEED_AMOUNT);
        IERC20(JETT_TOKEN).approve(address(handler), SEED_AMOUNT);

        handler.fundTreasury(Z_TOKEN,    SEED_AMOUNT);
        handler.fundTreasury(NEON_TOKEN, SEED_AMOUNT);
        handler.fundTreasury(JETT_TOKEN, SEED_AMOUNT);

        vm.stopBroadcast();

        console.log("Treasury seeded with 200 Z, 200 NEON, 200 JETT");
    }
}
