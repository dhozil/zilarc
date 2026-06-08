"use client";

import { useState, useEffect, useCallback } from "react";
import { createPublicClient, http, erc20Abi, formatUnits, getAddress, type Address } from "viem";
import { sepolia, arbitrum, base, optimism, polygon, avalanche, linea } from "viem/chains";

// Chain configs untuk baca balance dari berbagai chain
const ARC_RPC = (import.meta.env.VITE_ARC_RPC_URL as string | undefined) || "https://rpc.testnet.arc.network";

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
  // Arc Testnet: USDC is the native gas token (precompile at 0x3600…0000).
  // It's NOT an ERC-20 contract — it has no `balanceOf`. To read USDC balance
  // for a wallet, use `getBalance({address})`. The RPC returns raw wei
  // (1e18 scale), but the USDC token's `decimals()` returns 6 — so we have
  // to divide the wei value by 10^18, NOT 10^6, to get a human USDC number.
  // (For display we use 18 to match the on-chain wei unit; users see 11.755
  // for 11.755000913148748 raw USDC.)
  arc: {
    client: createPublicClient({
      chain: {
        id: 5042002,
        name: "Arc Testnet",
        nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
        rpcUrls: { default: { http: [ARC_RPC] } },
      },
      transport: http(ARC_RPC),
    }),
    usdcAddress: "0x3600000000000000000000000000000000000000",
    decimals: 18,
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
      let rawBalance: bigint;

      if (chainId === "arc") {
        // Arc: USDC is the gas token (precompile 0x3600…0000). It has no
        // ERC-20 `balanceOf`. Read native balance instead. The RPC returns
        // raw wei (1e18 scale); we divide by 10^18 to get USDC.
        rawBalance = await chainConfig.client.getBalance({
          address: address as `0x${string}`,
        });
      } else {
        rawBalance = (await chainConfig.client.readContract({
          address: getAddress(chainConfig.usdcAddress),
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as Address],
        })) as bigint;
      }

      const formatted = formatUnits(rawBalance, chainConfig.decimals);
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

      // Arc native currency = USDC, but the RPC returns raw wei (1e18 scale).
      // USDC's `decimals()` returns 6, but `eth_getBalance` is still wei, so
      // we format with 18 to land on the human USDC value the user expects.
      const formatted = formatUnits(rawBalance, 18);
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