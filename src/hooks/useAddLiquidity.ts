"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, usePublicClient, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits, getAddress } from "viem";
import { ARC_TOKENS, SWAP_POOLS } from "@/lib/wagmi";

export type LiquidityToken = "USDC" | "EURC" | "Z" | "NEON" | "JETT";

export const LIQUIDITY_DECIMALS: Record<LiquidityToken, number> = {
  USDC: 6,
  EURC: 6,
  Z: 18,
  NEON: 18,
  JETT: 18,
};

const POOL_ABI = [
  {
    name: "addLiquidity",
    type: "function",
    inputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
    ],
    outputs: [{ name: "liquidity", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "removeLiquidity",
    type: "function",
    inputs: [{ name: "liquidity", type: "uint256" }],
    outputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
  {
    name: "tokenA",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    name: "tokenB",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    name: "totalSupply",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

type PoolMeta = {
  tokenA: LiquidityToken;
  tokenB: LiquidityToken;
  pool: `0x${string}`;
};

const POOL_REGISTRY: Record<string, PoolMeta> = {
  "USDC-Z":    { tokenA: "USDC", tokenB: "Z",    pool: SWAP_POOLS.USDC_Z },
  "USDC-NEON": { tokenA: "USDC", tokenB: "NEON", pool: SWAP_POOLS.USDC_NEON },
  "USDC-JETT": { tokenA: "USDC", tokenB: "JETT", pool: SWAP_POOLS.USDC_JETT },
  "Z-NEON":    { tokenA: "Z",    tokenB: "NEON", pool: SWAP_POOLS.Z_NEON },
  "Z-JETT":    { tokenA: "Z",    tokenB: "JETT", pool: SWAP_POOLS.Z_JETT },
  "NEON-JETT": { tokenA: "NEON", tokenB: "JETT", pool: SWAP_POOLS.NEON_JETT },
};

const TOKEN_ADDRESSES: Record<LiquidityToken, `0x${string}`> = {
  USDC: ARC_TOKENS.USDC as `0x${string}`,
  EURC: ARC_TOKENS.EURC as `0x${string}`,
  Z:    ARC_TOKENS.Z    as `0x${string}`,
  NEON: ARC_TOKENS.NEON as `0x${string}`,
  JETT: ARC_TOKENS.JETT as `0x${string}`,
};

function getPoolForPair(tokenA: LiquidityToken, tokenB: LiquidityToken): PoolMeta | null {
  const key1 = `${tokenA}-${tokenB}`;
  const key2 = `${tokenB}-${tokenA}`;
  return POOL_REGISTRY[key1] ?? POOL_REGISTRY[key2] ?? null;
}

export function useAddLiquidity() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [isApproving, setIsApproving] = useState(false);
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeAddLiquidity } = useWriteContract();

  const addLiquidity = useCallback(
    async (
      amountA: string,
      amountB: string,
      tokenA: LiquidityToken,
      tokenB: LiquidityToken
    ) => {
      if (!address) throw new Error("Wallet not connected");
      if (tokenA === tokenB) throw new Error("Cannot add liquidity for same token");

      const pool = getPoolForPair(tokenA, tokenB);
      if (!pool) throw new Error(`No pool found for ${tokenA}/${tokenB}`);

      const decimalsA = LIQUIDITY_DECIMALS[tokenA];
      const decimalsB = LIQUIDITY_DECIMALS[tokenB];
      const amountAWei = parseUnits(amountA, decimalsA);
      const amountBWei = parseUnits(amountB, decimalsB);

      setIsAddingLiquidity(true);
      setError(null);

      try {
        const tokenAAddress = TOKEN_ADDRESSES[tokenA];
        const tokenBAddress = TOKEN_ADDRESSES[tokenB];
        const poolAddress = pool.pool;

        // Check and approve token A
        const allowanceA = await publicClient?.readContract({
          address: tokenAAddress,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, poolAddress],
        });

        if ((allowanceA as bigint) < amountAWei) {
          setIsApproving(true);
          const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

          const approvalHash: `0x${string}` = await writeApprove({
            address: tokenAAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [poolAddress, MAX_UINT256],
          });

          // Poll for confirmation
          const start = Date.now();
          while (Date.now() - start < 60000) {
            try {
              const confirmed = await publicClient?.getTransactionReceipt({ hash: approvalHash });
              if (confirmed) break;
            } catch (_) {}
            await new Promise((r) => setTimeout(r, 1000));
          }
        }

        // Check and approve token B
        const allowanceB = await publicClient?.readContract({
          address: tokenBAddress,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, poolAddress],
        });

        if ((allowanceB as bigint) < amountBWei) {
          setIsApproving(true);
          const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

          const approvalHash: `0x${string}` = await writeApprove({
            address: tokenBAddress,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [poolAddress, MAX_UINT256],
          });

          // Poll for confirmation
          const start = Date.now();
          while (Date.now() - start < 60000) {
            try {
              const confirmed = await publicClient?.getTransactionReceipt({ hash: approvalHash });
              if (confirmed) break;
            } catch (_) {}
            await new Promise((r) => setTimeout(r, 1000));
          }
        }

        setIsApproving(false);

        // Send addLiquidity transaction
        const txHash = await writeAddLiquidity({
          address: poolAddress,
          abi: POOL_ABI,
          functionName: "addLiquidity",
          args: [amountAWei, amountBWei],
        });

        console.log("Add liquidity tx sent:", txHash);
        return txHash;
      } catch (err: any) {
        setError(err.message || "Add liquidity failed");
        throw err;
      } finally {
        setIsAddingLiquidity(false);
        setIsApproving(false);
      }
    },
    [address, publicClient, writeApprove, writeAddLiquidity]
  );

  return {
    isApproving,
    isAddingLiquidity,
    error,
    addLiquidity,
    getPoolForPair,
  };
}