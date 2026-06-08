// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ReseedUsdcNativePools
 * @notice Burn deployer's existing LP in the 3 USDC-native pools and reseed
 *         them at a correct, balanced ratio. The earlier seed used 3.5e6 raw
 *         wei of native USDC paired with 3.5e18 wei of Z/NEON/JETT, which is
 *         a 12-orders-of-magnitude price skew (1 USDC ≈ 1e-12 token), causing
 *         router quotes to be effectively zero.
 *
 *         Arc native USDC is reported by `eth_getBalance` in raw wei (1e18
 *         scale). To pair 1:1 with an 18-decimal ERC-20, we seed equal raw
 *         wei amounts on both sides (e.g. 1e18 wei native USDC ↔ 1e18 wei
 *         token). One human USDC ≈ 1 human Z/NEON/JETT.
 *
 * Defaults: 1 native USDC + 1 token per pool. Override at runtime with
 *   forge script ... --sig 'run(uint256)' <wei_per_side>
 *
 * Total native USDC required = 3 × seedAmount. Make sure the deployer has
 * enough native USDC (gas) before running.
 */
contract ReseedUsdcNativePools is Script {
    address constant Z_TOKEN    = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    address constant USDC_Z_POOL    = 0xF620b9c807bF7Dc18B9Cc50f7833c90abD630187;
    address constant USDC_NEON_POOL = 0xeDdbCd15aa35885fd078c93Ca2d9916D9A295305;
    address constant USDC_JETT_POOL = 0x52CBe4119D29167a2bc57b4A7C618798928AF212;

    function _reseed(
        address pool,
        address token,
        address deployer,
        uint256 seedAmount,
        string memory label
    ) internal {
        // Burn existing LP first (if any). removeLiquidity returns both sides
        // including native USDC; balance returns to the deployer's account.
        uint256 lp = ZilarcSwap(pool).balanceOf(deployer);
        if (lp > 0) {
            ZilarcSwap(pool).removeLiquidity(lp);
            console.log(string.concat(label, ": burned existing LP=", vm.toString(lp)));
        }

        // Approve token side; native USDC side rides msg.value.
        IERC20(token).approve(pool, seedAmount);
        ZilarcSwap(pool).addLiquidity{value: seedAmount}(seedAmount, seedAmount);
        console.log(string.concat(label, ": reseeded ", vm.toString(seedAmount), " each side"));
    }

    function run() external {
        run(1 ether); // default: 1e18 wei (≈ 1 USDC) per side per pool
    }

    function run(uint256 seedAmount) public {
        require(seedAmount > 0, "seedAmount=0");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("Seed amount per side:", seedAmount);
        console.log("Total native USDC required:", seedAmount * 3);

        vm.startBroadcast(deployerPrivateKey);

        _reseed(USDC_Z_POOL,    Z_TOKEN,    deployer, seedAmount, "USDC/Z");
        _reseed(USDC_NEON_POOL, NEON_TOKEN, deployer, seedAmount, "USDC/NEON");
        _reseed(USDC_JETT_POOL, JETT_TOKEN, deployer, seedAmount, "USDC/JETT");

        vm.stopBroadcast();
    }
}
