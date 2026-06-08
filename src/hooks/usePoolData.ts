"use client";

import { useState, useEffect } from "react";
import { useChainId } from "wagmi";
import { getAddress, createPublicClient, http } from "viem";
import { arcTestnet, SWAP_POOLS } from "@/lib/wagmi";

const ARC_RPC =
  (import.meta.env.VITE_ARC_RPC_URL as string | undefined) ||
  arcTestnet.rpcUrls.default.http[0];

const POOL_ABI = [
  {
    name: "reserveA",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "reserveB",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "totalSupply",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "fee",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export interface PoolData {
  reserveA: string;
  reserveB: string;
  totalSupply: string;
  fee: string;
  liquidityUSD: string;
}

// Pool registry. All pools use 18-decimal raw units on Arc — including the
// USDC native side (eth_getBalance returns wei at 1e18 scale).
export const POOL_META: Record<
  string,
  { tokenA: string; tokenB: string; decimalsA: number; decimalsB: number }
> = {
  "USDC-Z":    { tokenA: "USDC", tokenB: "Z",    decimalsA: 18, decimalsB: 18 },
  "USDC-NEON": { tokenA: "USDC", tokenB: "NEON", decimalsA: 18, decimalsB: 18 },
  "USDC-JETT": { tokenA: "USDC", tokenB: "JETT", decimalsA: 18, decimalsB: 18 },
  "Z-NEON":    { tokenA: "Z",    tokenB: "NEON", decimalsA: 18, decimalsB: 18 },
  "Z-JETT":    { tokenA: "Z",    tokenB: "JETT", decimalsA: 18, decimalsB: 18 },
  "NEON-JETT": { tokenA: "NEON", tokenB: "JETT", decimalsA: 18, decimalsB: 18 },
};

export const POOL_ADDRESSES: Record<string, `0x${string}`> = {
  "USDC-Z":    SWAP_POOLS.USDC_Z,
  "USDC-NEON": SWAP_POOLS.USDC_NEON,
  "USDC-JETT": SWAP_POOLS.USDC_JETT,
  "Z-NEON":    SWAP_POOLS.Z_NEON,
  "Z-JETT":    SWAP_POOLS.Z_JETT,
  "NEON-JETT": SWAP_POOLS.NEON_JETT,
};

function getPoolKey(from: string, to: string): string | null {
  const key1 = `${from}-${to}`;
  const key2 = `${to}-${from}`;
  return POOL_META[key1] ? key1 : POOL_META[key2] ? key2 : null;
}

export function usePoolData(from?: string, to?: string) {
  const chainId = useChainId();
  const [data, setData] = useState<PoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const client = createPublicClient({
          chain: arcTestnet,
          transport: http(ARC_RPC),
        });

        // Resolve pool from pair, default to USDC-Z (most likely to be live).
        const poolKey =
          from && to ? getPoolKey(from, to) ?? "USDC-Z" : "USDC-Z";
        const meta = POOL_META[poolKey];
        const poolAddress = getAddress(POOL_ADDRESSES[poolKey]);

        const [reserveA, reserveB, totalSupply, fee] = await Promise.all([
          client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "reserveA" }),
          client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "reserveB" }),
          client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "totalSupply" }),
          client.readContract({ address: poolAddress, abi: POOL_ABI, functionName: "fee" }),
        ]);

        const rA = reserveA as bigint;
        const rB = reserveB as bigint;
        const supply = totalSupply as bigint;

        const amountA = Number(rA) / Math.pow(10, meta.decimalsA);
        const amountB = Number(rB) / Math.pow(10, meta.decimalsB);
        const liquidityUSD = (amountA + amountB).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

        if (cancelled) return;
        setData({
          reserveA: amountA.toFixed(4),
          reserveB: amountB.toFixed(4),
          totalSupply: (Number(supply) / 1e18).toFixed(4),
          fee: (Number(fee) / 100).toFixed(2),
          liquidityUSD,
        });
        setError(null);
      } catch (err) {
        console.error("Error fetching pool data:", err);
        if (!cancelled) setError("Failed to load pool data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [chainId, from, to]);

  return { data, loading, error };
}
