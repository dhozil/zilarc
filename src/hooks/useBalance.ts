"use client";

import { useState, useEffect, useCallback } from "react";
import { createPublicClient, http, erc20Abi, formatUnits, getAddress, type Address } from "viem";
import { sepolia, arbitrum, base, optimism, polygon, avalanche, linea } from "viem/chains";

// Chain configs untuk baca balance dari berbagai chain
const ARC_RPC = "https://rpc.blockdaemon.testnet.arc.network";

// Chain configs untuk baca balance dari berbagai chain
const CHAIN_CLIENTS: Record<string, { client: any; usdcAddress: `0x${string}`; decimals: number }> = {
  eth: {
    client: createPublicClient({
      chain: sepolia,
      transport: http("https://ethereum-sepolia-rpc.publicnode.com"),
    }),
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    decimals: 6,
  },
  arc: {
    client: createPublicClient({
      chain: {
        id: 5042002,
        name: "Arc Testnet",
        rpcUrls: { default: { http: [ARC_RPC] } },
      },
      transport: http(ARC_RPC),
    }),
    usdcAddress: "0x3600000000000000000000000000000000000000",
    decimals: 6,
  },
  arb: {
    client: createPublicClient({
      chain: arbitrum,
      transport: http("https://arbitrum-sepolia-rpc.publicnode.com"),
    }),
    usdcAddress: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    decimals: 6,
  },
  base: {
    client: createPublicClient({
      chain: base,
      transport: http("https://base-sepolia-rpc.publicnode.com"),
    }),
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6,
  },
  op: {
    client: createPublicClient({
      chain: optimism,
      transport: http("https://optimism-sepolia-rpc.publicnode.com"),
    }),
    usdcAddress: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
    decimals: 6,
  },
  polygon: {
    client: createPublicClient({
      chain: polygon,
      transport: http("https://rpc-amoy.polygon.technology"),
    }),
    usdcAddress: "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
    decimals: 6,
  },
  avax: {
    client: createPublicClient({
      chain: avalanche,
      transport: http("https://avalanche-fuji-c-chain-rpc.publicnode.com"),
    }),
    usdcAddress: "0x5425890298aed601595a70AB815c96711a31Bc65",
    decimals: 6,
  },
  linea: {
    client: createPublicClient({
      chain: linea,
      transport: http("https://linea-sepolia-rpc.publicnode.com"),
    }),
    usdcAddress: "0x4A8D3a662E0fD6a8BD39262Dc5A2E3F1f4373bF7",
    decimals: 6,
  },
};

/**
 * Hook untuk baca USDC balance dari chain tertentu
 */
export function useChainUsdcBalance(address: string | null | undefined, chainId: string) {
  const [balance, setBalance] = useState<string>("0.00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!address) {
      console.log(`[Balance] No address for ${chainId}, skipping`);
      setBalance("0.00");
      return;
    }

    const chainConfig = CHAIN_CLIENTS[chainId];
    if (!chainConfig) {
      console.warn(`Chain config not found for: ${chainId}`);
      setBalance("0.00");
      return;
    }

    console.log(`[Balance] Fetching ${chainId} balance for`, address);
    setLoading(true);
    try {
      const rawBalance = await chainConfig.client.readContract({
        address: getAddress(chainConfig.usdcAddress),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as Address],
      });

      const formatted = formatUnits(rawBalance as bigint, chainConfig.decimals);
      console.log(`[Balance] ${chainId}:`, formatted);
      setBalance(formatted);
      setError(null);
    } catch (err) {
      console.error(`[Balance] Failed to fetch balance from ${chainId}:`, err);
      setError(`Failed to fetch ${chainId} balance`);
      setBalance("0.00");
    } finally {
      setLoading(false);
    }
  }, [address, chainId]);

  useEffect(() => {
    // Reset balance when chainId changes and fetch new one
    setBalance("0.00");
    fetchBalance();

    // Poll every 15 seconds
    const intervalId = setInterval(fetchBalance, 15_000);
    return () => clearInterval(intervalId);
  }, [fetchBalance]);

  return {
    balance,
    formattedBalance: `${parseFloat(balance).toFixed(4)} USDC`,
    loading,
    error,
    refresh: fetchBalance,
  };
}

/**
 * Hook untuk baca USDC balance dari Arc Testnet
 */
export function useArcUsdcBalance(address: string | null | undefined) {
  return useChainUsdcBalance(address, "arc");
}

/**
 * Hook untuk baca balance token ERC20 arbitrary di Arc
 */
export function useTokenBalance(
  address: string | null | undefined,
  tokenAddress: `0x${string}`,
  decimals: number = 18
) {
  const [balance, setBalance] = useState<string>("0.00");
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!address) {
      setBalance("0.00");
      return;
    }

    const arcClient = CHAIN_CLIENTS.arc.client;

    setLoading(true);
    try {
      const rawBalance = await arcClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });

      const formatted = formatUnits(rawBalance as bigint, decimals);
      setBalance(formatted);
    } catch (err) {
      console.error("Failed to fetch token balance:", err);
    } finally {
      setLoading(false);
    }
  }, [address, tokenAddress, decimals]);

  useEffect(() => {
    fetchBalance();
    const intervalId = setInterval(fetchBalance, 15_000);
    return () => clearInterval(intervalId);
  }, [fetchBalance]);

  return {
    balance,
    formattedBalance: `${parseFloat(balance).toFixed(4)}`,
    loading,
    refresh: fetchBalance,
  };
}

/**
 * Hook untuk baca native balance (USDC gas) di Arc
 */
export function useNativeBalance(address: string | null | undefined) {
  const [balance, setBalance] = useState<string>("0.00");
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!address) {
      setBalance("0.00");
      return;
    }

    const arcClient = CHAIN_CLIENTS.arc.client;

    setLoading(true);
    try {
      const rawBalance = await arcClient.getBalance({
        address: address as `0x${string}`,
      });

      const formatted = formatUnits(rawBalance, 6);
      setBalance(formatted);
    } catch (err) {
      console.error("Failed to fetch native balance:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchBalance();
    const intervalId = setInterval(fetchBalance, 15_000);
    return () => clearInterval(intervalId);
  }, [fetchBalance]);

  return {
    balance,
    formattedBalance: `${parseFloat(balance).toFixed(4)} USDC`,
    loading,
    refresh: fetchBalance,
  };
}