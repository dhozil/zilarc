// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ZilarcSwap - Simple AMM Liquidity Pool
 * @dev Constant product AMM (x * y = k) for swapping Z token with USDC
 */
contract ZilarcSwap is ERC20, Ownable {
    // Token addresses
    address public tokenA; // USDC
    address public tokenB; // Z Token

    // Reserves (in raw amounts, not decimals)
    uint256 public reserveA;
    uint256 public reserveB;

    // Fee in basis points (e.g., 30 = 0.3%)
    uint256 public fee = 30;

    // Events
    event Mint(address indexed sender, uint256 amountA, uint256 amountB);
    event Burn(address indexed sender, uint256 amountA, uint256 amountB);
    event Swap(address indexed sender, uint256 amountAIn, uint256 amountBIn, uint256 amountAOut, uint256 amountBOut);

    // Reserve0 = reserveA, Reserve1 = reserveB (for Uniswap V2 compatibility)
    uint256 private constant MINIMUM_LIQUIDITY = 10**3;

    constructor(address _tokenA, address _tokenB, address initialOwner) ERC20("Zilarc LP Token", "ZILP") Ownable(initialOwner) {
        tokenA = _tokenA;
        tokenB = _tokenB;
    }

    // Get current reserves (sorted)
    function getReserves() public view returns (uint256 _reserveA, uint256 _reserveB) {
        _reserveA = reserveA;
        _reserveB = reserveB;
    }

    // Get reserve0 and reserve1 (Uniswap V2 style)
    function getReserve0() external view returns (uint256) {
        return reserveA;
    }

    function getReserve1() external view returns (uint256) {
        return reserveB;
    }

    // Add liquidity
    function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 liquidity) {
        require(amountA > 0 && amountB > 0, "Invalid amounts");

        // Transfer tokens from sender
        IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);

        // Calculate liquidity
        uint256 totalSupply = totalSupply();
        if (totalSupply == 0) {
            liquidity = sqrt(amountA * amountB) - MINIMUM_LIQUIDITY;
            _mint(address(1), MINIMUM_LIQUIDITY); // Permanent lock
        } else {
            liquidity = (amountA * totalSupply) / reserveA;
            liquidity = (liquidity * amountB) / reserveB;
        }

        require(liquidity > 0, "Insufficient liquidity minted");

        _mint(msg.sender, liquidity);
        _update();
        emit Mint(msg.sender, amountA, amountB);
    }

    // Remove liquidity
    function removeLiquidity(uint256 liquidity) external returns (uint256 amountA, uint256 amountB) {
        require(liquidity > 0, "Invalid liquidity amount");

        uint256 totalSupply = totalSupply();
        amountA = (liquidity * reserveA) / totalSupply;
        amountB = (liquidity * reserveB) / totalSupply;

        _burn(msg.sender, liquidity);
        _update();

        IERC20(tokenA).transfer(msg.sender, amountA);
        IERC20(tokenB).transfer(msg.sender, amountB);

        emit Burn(msg.sender, amountA, amountB);
    }

    // Swap tokenA for tokenB
    function swapAForB(uint256 amountAIn) external returns (uint256 amountBOut) {
        return _swap(amountAIn, 0);
    }

    // Swap tokenB for tokenA
    function swapBForA(uint256 amountBIn) external returns (uint256 amountAOut) {
        return _swap(0, amountBIn);
    }

    // Core swap function
    function _swap(uint256 amountAIn, uint256 amountBIn) internal returns (uint256 amountOut) {
        require(amountAIn > 0 || amountBIn > 0, "Invalid input amount");
        require(amountAIn == 0 || amountBIn == 0, "Can only swap one direction");

        uint256 amountIn;
        address tokenIn;
        address tokenOut;

        if (amountAIn > 0) {
            amountIn = amountAIn;
            tokenIn = tokenA;
            tokenOut = tokenB;
        } else {
            amountIn = amountBIn;
            tokenIn = tokenB;
            tokenOut = tokenA;
        }

        // Calculate output with fee
        uint256 amountInWithFee = amountIn * (10000 - fee);
        uint256 numerator = amountInWithFee * (tokenOut == tokenB ? reserveB : reserveA);
        uint256 denominator = (10000 * (tokenOut == tokenB ? reserveA : reserveB)) + amountInWithFee;
        amountOut = numerator / denominator;

        require(amountOut > 0 && amountOut < (tokenOut == tokenB ? reserveB : reserveA), "Invalid output amount");

        // Transfer input token from sender
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // Transfer output token to sender
        if (tokenOut == tokenB) {
            IERC20(tokenOut).transfer(msg.sender, amountOut);
            _update();
            emit Swap(msg.sender, amountIn, 0, 0, amountOut);
        } else {
            IERC20(tokenOut).transfer(msg.sender, amountOut);
            _update();
            emit Swap(msg.sender, 0, amountIn, amountOut, 0);
        }
    }

    // Update reserves
    function _update() internal {
        reserveA = IERC20(tokenA).balanceOf(address(this));
        reserveB = IERC20(tokenB).balanceOf(address(this));
    }

    // Calculate output amount (view function)
    function getAmountOut(uint256 amountIn, bool isAToB) external view returns (uint256 amountOut) {
        uint256 amountInWithFee = amountIn * (10000 - fee);
        uint256 reserveIn = isAToB ? reserveA : reserveB;
        uint256 reserveOut = isAToB ? reserveB : reserveA;

        amountOut = (amountInWithFee * reserveOut) / ((10000 * reserveIn) + amountInWithFee);
    }

    // Set fee
    function setFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee too high"); // Max 10%
        fee = newFee;
    }

    // Square root helper
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}