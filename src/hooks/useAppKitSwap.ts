"use client";

/**
 * useAppKitSwap — App Kit (LiFi aggregator) swap hook for Arc Testnet.
 *
 * Purpose: swap USDC ↔ mainstream tokens (USDT, DAI, WETH, etc.) that
 * useSwap.ts does not handle. useSwap.ts is reserved for Zilarc-native
 * routes (Z/NEON/JETT/USDC via AMM pools and 1:1 handler).
 *
 * Server-side execution: App Kit swap() requires a kit key, which is
 * server-side only. This hook calls /api/swap (api/swap.ts) which holds
 * the kit key, builds the Viem adapter from PRIVATE_KEY, and returns
 * the tx hash + amountOut. The client never sees the kit key.
 *
 * USDC precompile caveat: USDC on Arc is the native gas token (precompile
 * at 0x3600…0000). The App Kit "approve" allowance strategy would fail
 * if applied to USDC. We rely on App Kit's aggregator to handle this, but
 * if the user explicitly selects USDC as tokenIn we recommend not using
 * App Kit — use useSwap.ts (UsdcSwapHandler) instead.
 */

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { ARC_TOKENS } from "@/lib/wagmi";

/**
 * App Kit accepts either an alias ("USDC", "USDT") or a 0x address.
 * Aliases for Zilarc tokens are not built into App Kit, so we resolve
 * them locally to the deployed ERC-20 addresses from wagmi.ts.
 */
export type AppKitTokenSym =
  | "USDC" | "EURC" | "USDT" | "DAI" | "USDE" | "WETH" | "WBTC"
  | "Z" | "NEON" | "JETT"
  | string;

export const APPKIT_TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  EURC: 6,
  USDT: 6,
  DAI:  18,
  USDE: 18,
  WETH: 18,
  WBTC: 8,
  Z:    18,
  NEON: 18,
  JETT: 18,
};

const ZILARC_SYMBOL_TO_ADDRESS: Record<string, `0x${string}`> = {
  Z:    ARC_TOKENS.Z    as `0x${string}`,
  NEON: ARC_TOKENS.NEON as `0x${string}`,
  JETT: ARC_TOKENS.JETT as `0x${string}`,
};

export interface AppKitSwapEstimate {
  amountIn: string;
  estimatedOutput: string;
  fees: Array<{ type: string; amount: string; token: string }>;
}

export interface AppKitSwapResult {
  amountIn: string;
  amountOut: string;
  chain: string;
  txHash: string;
  explorerUrl?: string;
  fromAddress: string;
  toAddress: string;
  fees?: Array<{ type: string; amount: string; token: string }>;
}

export function useAppKitSwap() {
  const { address } = useAccount();

  const [isEstimating, setIsEstimating] = useState(false);
  const [isSwapping,   setIsSwapping]   = useState(false);
  const [isSwapDone,   setIsSwapDone]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  /**
   * Resolve a token input to either an App Kit alias or a 0x address string.
   * - Z/NEON/JETT → mapped to their deployed ERC-20 addresses
   * - USDC/USDT/DAI/etc. → passed through as App Kit alias
   * - 0x address → passed through
   */
  const resolveTokenArg = useCallback((t: AppKitTokenSym): string => {
    if (typeof t !== "string") throw new Error("Token must be a symbol or address");
    if (t.startsWith("0x") && isAddress(t)) return t;
    if (ZILARC_SYMBOL_TO_ADDRESS[t]) return ZILARC_SYMBOL_TO_ADDRESS[t];
    return t; // alias like "USDC", "USDT"
  }, []);

  /**
   * Estimate swap output via App Kit. Calls /api/quote (server-side) so the
   * kit key never reaches the browser.
   */
  const estimateSwap = useCallback(
    async (
      amountIn: string,
      from: AppKitTokenSym,
      to: AppKitTokenSym
    ): Promise<AppKitSwapEstimate> => {
      if (!amountIn || parseFloat(amountIn) === 0) {
        return { amountIn, estimatedOutput: "0", fees: [] };
      }

      setIsEstimating(true);
      setError(null);
      try {
        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chain: "Arc_Testnet",
            tokenIn: resolveTokenArg(from),
            tokenOut: resolveTokenArg(to),
            amountIn,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Quote failed: ${res.status} ${txt}`);
        }
        const data = (await res.json()) as AppKitSwapEstimate;
        return data;
      } catch (err: any) {
        const msg = err?.message ?? "Estimate failed";
        setError(msg);
        throw err instanceof Error ? err : new Error(msg);
      } finally {
        setIsEstimating(false);
      }
    },
    [resolveTokenArg]
  );

  /**
   * Execute a swap. Sends tx to /api/swap which builds the Viem adapter
   * server-side and calls kit.swap(). Returns the App Kit result.
   */
  const executeSwap = useCallback(
    async (
      amountIn: string,
      from: AppKitTokenSym,
      to: AppKitTokenSym,
      opts?: { slippageBps?: number; stopLimit?: string }
    ): Promise<AppKitSwapResult> => {
      if (!address) throw new Error("Wallet not connected");
      if (from === to) throw new Error("Cannot swap same token");

      setIsSwapDone(false);
      setError(null);
      setIsSwapping(true);

      try {
        const res = await fetch("/api/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chain: "Arc_Testnet",
            tokenIn: resolveTokenArg(from),
            tokenOut: resolveTokenArg(to),
            amountIn,
            fromAddress: address,
            slippageBps: opts?.slippageBps,
            stopLimit: opts?.stopLimit,
          }),
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Swap failed: ${res.status} ${txt}`);
        }
        const result = (await res.json()) as AppKitSwapResult;
        setIsSwapDone(true);
        return result;
      } catch (err: any) {
        const msg = err?.message ?? "Swap failed";
        setError(msg);
        throw err instanceof Error ? err : new Error(msg);
      } finally {
        setIsSwapping(false);
      }
    },
    [address, resolveTokenArg]
  );

  return {
    isEstimating,
    isSwapping,
    isSwapSuccess: isSwapDone,
    error,
    estimateSwap,
    executeSwap,
  };
}
