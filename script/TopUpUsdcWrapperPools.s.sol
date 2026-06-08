// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ZilarcSwap.sol";
import "../contracts/ZilarcToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TopUpUsdcWrapperPools
 * @notice Top up the 3 USDC-wrapper AMM pools on Arc Testnet to 200:200
 *         per side, matching the size of the existing Z/NEON & Z/JETT
 *         cross-pools (200e18 each side). This prevents severe slippage
 *         on USDC <-> token swaps.
 *
 *         The wrapper USDC has 18 decimals, same as the game tokens.
 *         Internally we treat 1 wrapper USDC = 1 USDC.
 *
 * Pool addresses (deployed via DeployUsdcWrapperPools.s.sol; verified on-chain):
 *   USDC/Z    = 0x60B76C57714938aa4d978DFa473B72028b930878
 *   USDC/NEON = 0x4471fA8ff0b02b3430975D61070d332B47340b7F
 *   USDC/JETT = 0xe17232cc17e41C368803dA6265520515D5D7400f
 *
 * Current deployer wUSDC balance: ~999.4 raw units (18 dec) — enough.
 *
 * Pricing note: ZilarcSwap.addLiquidity mints
 *   liquidity = (amountA * totalSupply) / reserveA
 *             = (liquidity * amountB) / reserveB
 * Both must match the existing reserve ratio or the smaller divisor floors to
 * zero. We use the constant-product optimal formula:
 *   amountBOptimal = amountA * reserveB / reserveA
 *   amountAOptimal = amountB * reserveA / reserveB
 * and pick the smaller of (amountA, amountAOptimal) to compute amountB.
 */
contract TopUpUsdcWrapperPools is Script {
    address constant DEPLOYER      = 0x3231E907C51cd769857477BC5494Ee0C26E5104c;
    address constant USDC_WRAPPER  = 0xAbEedDb87978E55233a695c1AF0861Da5c0e712f;
    address constant Z_TOKEN       = 0x5D05355351eFc0d8346CB0af778A3A441CF099e6;
    address constant NEON_TOKEN    = 0x276B35B7d902BcAE5AAE5A96924FE9fC082866Ce;
    address constant JETT_TOKEN    = 0xcEe56f1CfF4D440Fac124706952a77805a728A70;

    address constant USDC_Z_POOL    = 0x60b76C57714938AA4d978DFA473b72028B930878;
    address constant USDC_NEON_POOL = 0x4471Fa8fF0b02b3430975D61070D332b47340b7f;
    address constant USDC_JETT_POOL = 0xE17232cc17E41C368803dA6265520515d5d7400f;

    // Target reserves per side: 200 wUSDC : 200 token
    uint256 constant TARGET_WUSDC  = 200 ether; // 200 raw units in 18-dec space
    uint256 constant TARGET_TOKEN  = 200 ether;

    function topUp(
        address pool,
        address token,
        string memory label
    ) internal {
        (uint256 rA, uint256 rB) = ZilarcSwap(pool).getReserves();
        address tA = ZilarcSwap(pool).tokenA();
        bool wusdcIsA = tA == USDC_WRAPPER;

        // Normalize so wUSDC side = curW, token side = curT
        uint256 curWusdc = wusdcIsA ? rA : rB;
        uint256 curToken = wusdcIsA ? rB : rA;

        console.log(string.concat(label, "  curW="), curWusdc, " curT=", curToken);

        if (curWusdc >= TARGET_WUSDC && curToken >= TARGET_TOKEN) {
            console.log(string.concat(label, "  already at/above target, skipping"));
            return;
        }

        // Compute add amounts. Cap by TARGET. Use ratio of current reserves.
        uint256 addW;
        uint256 addT;
        if (curWusdc == 0 || curToken == 0) {
            // Empty pool, just seed with target
            addW = TARGET_WUSDC;
            addT = TARGET_TOKEN;
        } else {
            // Push both toward target ratio. If we add deltaW wUSDC, we need
            // deltaT = deltaW * curT / curW. But we also can't exceed TARGET.
            // We need to find the largest addW such that:
            //   curW + addW  <= TARGET_WUSDC
            //   curT + addW*curT/curW <= TARGET_TOKEN
            // Solve for the binding constraint.
            uint256 addW_byW = TARGET_WUSDC - curWusdc;
            uint256 addW_byT = (TARGET_TOKEN - curToken) * curWusdc / curToken;
            addW = addW_byW < addW_byT ? addW_byW : addW_byT;
            addT = addW * curToken / curWusdc;
        }

        console.log(string.concat(label, "  addW="), addW, " addT=", addT);
        require(addW > 0 && addT > 0, "Computed zero add");

        // addLiquidity(amountA, amountB) where A=tokenA, B=tokenB
        uint256 amountA;
        uint256 amountB;
        if (wusdcIsA) {
            amountA = addW;
            amountB = addT;
        } else {
            amountA = addT;
            amountB = addW;
        }

        IERC20(USDC_WRAPPER).approve(pool, addW);
        IERC20(token).approve(pool, addT);
        ZilarcSwap(pool).addLiquidity(amountA, amountB);

        (uint256 rA2, uint256 rB2) = ZilarcSwap(pool).getReserves();
        console.log(string.concat(label, "  newW="), wusdcIsA ? rA2 : rB2, " newT=", wusdcIsA ? rB2 : rA2);
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Mint extra wUSDC to deployer to cover top-up.
        // 3 pools * 200e18 = 600e18. Deployer already has ~999e18, but mint
        // a buffer in case any were spent elsewhere.
        ZilarcToken(USDC_WRAPPER).mint(DEPLOYER, 600 ether);
        console.log("Minted 600 wUSDC to deployer");

        topUp(USDC_Z_POOL,    Z_TOKEN,    "USDC/Z    ");
        topUp(USDC_NEON_POOL, NEON_TOKEN, "USDC/NEON ");
        topUp(USDC_JETT_POOL, JETT_TOKEN, "USDC/JETT ");

        vm.stopBroadcast();
    }
}
