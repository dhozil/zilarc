// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";
import "../contracts/ZilarcToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SeedUsdcWrapperPools
 * @notice Seed initial liquidity into the 3 new USDC-wrapper AMM pools on Arc Testnet.
 *         The deployer EOA owns the USDC wrapper and the Z/NEON/JETT tokens, so
 *         it mints fresh wrapper supply if needed before seeding.
 *
 * Pool addresses (deployed via DeployUsdcWrapperPools.s.sol; verified on-chain):
 *   USDC/Z    = 0x60B76C57714938aa4d978DFa473B72028b930878
 *   USDC/NEON = 0x4471fA8ff0b02b3430975D61070d332B47340b7F
 *   USDC/JETT = 0xe17232cc17e41C368803dA6265520515D5D7400f
 *
 * Seed: 5 USDC wrapper (raw) + 5 of Z/NEON/JETT (raw) per side. ZilarcToken
 * decimals default to 18 in the contract (no override), so all amounts are
 * 18-decimal raw units. 5 raw units per side is a small but valid seed that
 * fits the deployer's small wrapper balance.
 */
contract SeedUsdcWrapperPools is Script {
    address constant DEPLOYER      = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;
    address constant USDC_WRAPPER  = 0xAbEedDb87978E55233a695c1AF0861Da5c0e712f;
    address constant Z_TOKEN       = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN    = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN    = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    address constant USDC_Z_POOL    = 0x60b76C57714938AA4d978DFA473b72028B930878;
    address constant USDC_NEON_POOL = 0x4471Fa8fF0b02b3430975D61070D332b47340b7f;
    address constant USDC_JETT_POOL = 0xE17232cc17E41C368803dA6265520515d5d7400f;

    uint256 constant USDC_AMOUNT  = 5;            // 5 raw units (18 dec)
    uint256 constant TOKEN_AMOUNT = 5 * 10 ** 18; // 5 of Z/NEON/JETT (18 dec)

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Mint enough wrapper USDC to cover 3 pools (deployer is owner)
        uint256 mintAmount = USDC_AMOUNT * 3;
        ZilarcToken(USDC_WRAPPER).mint(DEPLOYER, mintAmount);
        console.log("Minted", mintAmount, "raw USDC wrapper to deployer");

        // USDC / Z
        IERC20(USDC_WRAPPER).approve(USDC_Z_POOL, USDC_AMOUNT);
        IERC20(Z_TOKEN).approve(USDC_Z_POOL, TOKEN_AMOUNT);
        ZilarcSwap(USDC_Z_POOL).addLiquidity(USDC_AMOUNT, TOKEN_AMOUNT);
        console.log("USDC/Z liquidity seeded");

        // USDC / NEON
        IERC20(USDC_WRAPPER).approve(USDC_NEON_POOL, USDC_AMOUNT);
        IERC20(NEON_TOKEN).approve(USDC_NEON_POOL, TOKEN_AMOUNT);
        ZilarcSwap(USDC_NEON_POOL).addLiquidity(USDC_AMOUNT, TOKEN_AMOUNT);
        console.log("USDC/NEON liquidity seeded");

        // USDC / JETT
        IERC20(USDC_WRAPPER).approve(USDC_JETT_POOL, USDC_AMOUNT);
        IERC20(JETT_TOKEN).approve(USDC_JETT_POOL, TOKEN_AMOUNT);
        ZilarcSwap(USDC_JETT_POOL).addLiquidity(USDC_AMOUNT, TOKEN_AMOUNT);
        console.log("USDC/JETT liquidity seeded");

        vm.stopBroadcast();
    }
}

