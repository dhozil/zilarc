"use client";

/**
 * useSwap — single-entrypoint AMM swap hook for Zilarc on Arc Testnet.
 *
 * All swaps route through ZilarcRouter, which sits in front of every
 * ZilarcSwap pool. Native USDC moves via msg.value, ERC-20 tokens via
 * approve+transferFrom, in a single user transaction. The result is one
 * "Swap" log on the explorer instead of a deposit→swap→withdraw chain.
 *
 * If `ZILARC_ROUTER` is unset (zero address), the hook falls back to
 * calling pools directly — useful for staging environments where the
 * router has not been deployed yet. The user-visible flow is identical
 * (one tx for native USDC input, two txs for ERC-20 input: approve + swap).
 */

import { useState, useCallback } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits, formatUnits, http, createPublicClient } from "viem";
import {
  ARC_TOKENS,
  SWAP_POOLS,
  USDC_PRECOMPILE,
  ZILARC_ROUTER,
  arcTestnet,
} from "@/lib/wagmi";
import { recordPendingTx } from "@/hooks/useTxHistory";

const ARC_RPC_URL =
  (import.meta.env.VITE_ARC_RPC_URL as string | undefined) ||
  arcTestnet.rpcUrls.default.http[0];

export type TokenSym = "USDC" | "EURC" | "Z" | "NEON" | "JETT";

// All AMM amounts on Arc are 18-decimal raw units, except EURC which uses
// 6 decimals (matches the on-chain EURC contract). The pool's constant-
// product math treats raw units symmetrically, so 1 EURC (1e6) ↔ 1 token
// (1e18) is exactly the same liquidity ratio as 1:1 in human terms after
// formatting at the call boundary.
export const TOKEN_DECIMALS: Record<TokenSym, number> = {
  USDC: 18,
  EURC: 6,
  Z:    18,
  NEON: 18,
  JETT: 18,
};

const TOKEN_ADDRESSES: Record<TokenSym, `0x${string}`> = {
  USDC: ARC_TOKENS.USDC as `0x${string}`,
  EURC: ARC_TOKENS.EURC as `0x${string}`,
  Z:    ARC_TOKENS.Z    as `0x${string}`,
  NEON: ARC_TOKENS.NEON as `0x${string}`,
  JETT: ARC_TOKENS.JETT as `0x${string}`,
};

const USDC_PRECOMPILE_ADDR = USDC_PRECOMPILE.toLowerCase() as `0x${string}`;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// Pool registry mirrors the on-chain router. Used only by the direct-pool
// fallback path (when ZILARC_ROUTER is unset). Order-independent lookup.
// Entries with the zero address (e.g. EURC pools before they're deployed)
// are filtered out — `getPoolAddress` returns null so the UI marks the pair
// as untradable instead of routing to a phantom pool.
const POOL_REGISTRY: Record<string, `0x${string}`> = {
  "USDC-Z":    SWAP_POOLS.USDC_Z,
  "USDC-NEON": SWAP_POOLS.USDC_NEON,
  "USDC-JETT": SWAP_POOLS.USDC_JETT,
  "USDC-EURC": SWAP_POOLS.USDC_EURC,
  "EURC-Z":    SWAP_POOLS.EURC_Z,
  "EURC-NEON": SWAP_POOLS.EURC_NEON,
  "EURC-JETT": SWAP_POOLS.EURC_JETT,
  "NEON-Z":    SWAP_POOLS.Z_NEON,
  "JETT-Z":    SWAP_POOLS.Z_JETT,
  "JETT-NEON": SWAP_POOLS.NEON_JETT,
};

function getPoolAddress(from: TokenSym, to: TokenSym): `0x${string}` | null {
  if (from === to) return null;
  // Try both orderings — registry keys are written as "USDC-X", "EURC-X",
  // etc. with a fixed natural order, not alphabetical, so a single sort()
  // would miss e.g. "USDC-NEON" when looking up (NEON, USDC).
  const addr = POOL_REGISTRY[`${from}-${to}`] ?? POOL_REGISTRY[`${to}-${from}`];
  if (!addr || addr.toLowerCase() === ZERO_ADDR) return null;
  return addr;
}

/**
 * Returns true if both tokens are part of an AMM pool that has been
 * deployed (non-zero pool address). Used by the UI to enable/disable the
 * swap action for EURC pairs before EURC pools are seeded.
 */
export function isPairTradable(from: TokenSym, to: TokenSym): boolean {
  if (from === to) return false;
  return getPoolAddress(from, to) !== null;
}

const ROUTER_ABI = [
  {
    name: "swap",
    type: "function",
    inputs: [
      { name: "tokenIn",      type: "address" },
      { name: "tokenOut",     type: "address" },
      { name: "amountIn",     type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "recipient",    type: "address" },
      { name: "deadline",     type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    name: "getAmountOut",
    type: "function",
    inputs: [
      { name: "tokenIn",  type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "pool",      type: "address" },
    ],
    stateMutability: "view",
  },
] as const;

const POOL_ABI = [
  {
    name: "tokenA",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    name: "getAmountOut",
    type: "function",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "isAToB",   type: "bool" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "swapAForB",
    type: "function",
    inputs: [{ name: "amountAIn", type: "uint256" }],
    outputs: [{ name: "amountBOut", type: "uint256" }],
    stateMutability: "payable",
  },
  {
    name: "swapBForA",
    type: "function",
    inputs: [{ name: "amountBIn", type: "uint256" }],
    outputs: [{ name: "amountAOut", type: "uint256" }],
    stateMutability: "payable",
  },
] as const;

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
);

function hasRouter(): boolean {
  return ZILARC_ROUTER.toLowerCase() !== ZERO_ADDRESS;
}

function getArcClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });
}

async function confirmTx(
  hash: `0x${string}`,
  label: string,
  timeoutMs = 90_000,
): Promise<"confirmed" | "reverted" | "timeout"> {
  const client = getArcClient();
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      console.log(`[useSwap][${label}] ${hash} status=${receipt.status}`);
      return receipt.status === "reverted" ? "reverted" : "confirmed";
    } catch (err: any) {
      const msg = (err?.message ?? err?.shortMessage ?? "").toLowerCase();
      const code = err?.code ?? err?.cause?.code;
      const retryable =
        code === -32000 ||
        code === -32603 ||
        code === -32602 ||
        msg.includes("not found") ||
        msg.includes("notfound") ||
        msg.includes("unknown hash") ||
        msg.includes("unknown tx") ||
        msg.includes("already known") ||
        msg.includes("unknown block") ||
        msg.includes("transaction receipt") ||
        msg.includes("receipt not found");
      if (!retryable) {
        console.warn(`[useSwap][${label}] ${hash} non-retryable: ${msg}`);
        return "timeout";
      }
      const delay = Math.min(4000 + attempt * 500, 12000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return "timeout";
}

/**
 * Apply slippage to a quoted output amount. `bps` is basis points (e.g. 50 =
 * 0.5%). Returns the minimum acceptable output as a bigint with the same
 * scale as the quote.
 */
function applySlippage(quoteOut: bigint, bps: number): bigint {
  const safeBps = BigInt(Math.max(0, Math.min(10_000, Math.floor(bps))));
  return (quoteOut * (10_000n - safeBps)) / 10_000n;
}

export function useSwap() {
  const { address } = useAccount();

  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping,  setIsSwapping]  = useState(false);
  const [isSwapDone,  setIsSwapDone]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeSwap }    = useWriteContract();

  // ── Quote ───────────────────────────────────────────────────────────
  const getOutputAmount = useCallback(
    async (amountIn: string, from: TokenSym, to: TokenSym): Promise<string> => {
      if (!amountIn || parseFloat(amountIn) === 0) return "0";
      if (from === to) return amountIn;

      const decimalsIn  = TOKEN_DECIMALS[from];
      const decimalsOut = TOKEN_DECIMALS[to];

      let amountWei: bigint;
      try {
        amountWei = parseUnits(amountIn, decimalsIn);
      } catch {
        return "0";
      }
      if (amountWei === 0n) return "0";

      const client = getArcClient();

      // Prefer router quote — it knows the registered pool and applies fee
      // identically to execution.
      if (hasRouter()) {
        try {
          const result = (await client.readContract({
            address: ZILARC_ROUTER,
            abi: ROUTER_ABI,
            functionName: "getAmountOut",
            args: [TOKEN_ADDRESSES[from], TOKEN_ADDRESSES[to], amountWei],
          })) as readonly [bigint, `0x${string}`];
          return formatUnits(result[0], decimalsOut);
        } catch (err) {
          console.warn("[useSwap] router quote failed, falling back to pool:", err);
        }
      }

      // Direct-pool fallback
      const poolAddr = getPoolAddress(from, to);
      if (!poolAddr) return "0";

      try {
        const tokenA = (await client.readContract({
          address: poolAddr, abi: POOL_ABI, functionName: "tokenA",
        })) as `0x${string}`;
        const isAToB =
          tokenA.toLowerCase() === TOKEN_ADDRESSES[from].toLowerCase();

        const out = (await client.readContract({
          address: poolAddr,
          abi: POOL_ABI,
          functionName: "getAmountOut",
          args: [amountWei, isAToB],
        })) as bigint;

        return formatUnits(out, decimalsOut);
      } catch (err) {
        console.error("[useSwap] pool quote error:", err);
        return "0";
      }
    },
    [],
  );

  // ── Execute swap ────────────────────────────────────────────────────
  const executeSwap = useCallback(
    async (
      amountIn: string,
      from: TokenSym,
      to: TokenSym,
      opts?: { slippageBps?: number; deadlineSeconds?: number; recipient?: `0x${string}` },
    ) => {
      if (!address) throw new Error("Wallet not connected");
      if (from === to) throw new Error("Cannot swap same token");

      const slippageBps = opts?.slippageBps ?? 50; // 0.5% default
      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + (opts?.deadlineSeconds ?? 1200), // 20 min
      );
      const recipient = (opts?.recipient ?? address) as `0x${string}`;

      const decimalsIn = TOKEN_DECIMALS[from];
      const amountWei = parseUnits(amountIn, decimalsIn);
      if (amountWei === 0n) throw new Error("Amount must be > 0");

      setError(null);
      setIsSwapDone(false);

      const tokenIn  = TOKEN_ADDRESSES[from];
      const tokenOut = TOKEN_ADDRESSES[to];
      const isNativeIn = tokenIn.toLowerCase() === USDC_PRECOMPILE_ADDR;

      const client = getArcClient();

      try {
        // ── Quote + slippage (router-preferred) ───────────────────────
        let quoteOut = 0n;
        if (hasRouter()) {
          try {
            const r = (await client.readContract({
              address: ZILARC_ROUTER,
              abi: ROUTER_ABI,
              functionName: "getAmountOut",
              args: [tokenIn, tokenOut, amountWei],
            })) as readonly [bigint, `0x${string}`];
            quoteOut = r[0];
          } catch (err) {
            console.warn("[useSwap] router quote failed:", err);
          }
        }
        if (quoteOut === 0n) {
          const poolAddr = getPoolAddress(from, to);
          if (!poolAddr) throw new Error(`No pool for ${from}/${to}`);
          const tokenA = (await client.readContract({
            address: poolAddr, abi: POOL_ABI, functionName: "tokenA",
          })) as `0x${string}`;
          const isAToB = tokenA.toLowerCase() === tokenIn.toLowerCase();
          quoteOut = (await client.readContract({
            address: poolAddr,
            abi: POOL_ABI,
            functionName: "getAmountOut",
            args: [amountWei, isAToB],
          })) as bigint;
        }
        if (quoteOut === 0n) throw new Error("Pool has no liquidity for this pair");

        const amountOutMin = applySlippage(quoteOut, slippageBps);

        // ── Path A: router available ──────────────────────────────────
        if (hasRouter()) {
          // Approve router for ERC-20 input
          if (!isNativeIn) {
            const allowance = (await client.readContract({
              address: tokenIn, abi: ERC20_ABI, functionName: "allowance",
              args: [address, ZILARC_ROUTER],
            })) as bigint;

            if (allowance < amountWei) {
              setIsApproving(true);
              try {
                const apprHash = await writeApprove({
                  address: tokenIn, abi: ERC20_ABI, functionName: "approve",
                  args: [ZILARC_ROUTER, MAX_UINT256],
                });
                console.log(`[useSwap] approve tx: ${apprHash}`);
                const apprRes = await confirmTx(apprHash, "ROUTER_APPROVE");
                if (apprRes === "reverted") throw new Error("Approval reverted");
                if (apprRes === "timeout") {
                  const after = (await client.readContract({
                    address: tokenIn, abi: ERC20_ABI, functionName: "allowance",
                    args: [address, ZILARC_ROUTER],
                  })) as bigint;
                  if (after < amountWei) throw new Error("Approval timed out");
                }
              } finally {
                setIsApproving(false);
              }
            }
          }

          setIsSwapping(true);
          const swapHash = await writeSwap({
            address: ZILARC_ROUTER,
            abi: ROUTER_ABI,
            functionName: "swap",
            args: [tokenIn, tokenOut, amountWei, amountOutMin, recipient, deadline],
            ...({ value: isNativeIn ? amountWei : 0n } as { value: bigint }),
          } as unknown as Parameters<typeof writeSwap>[0]);
          console.log(`[useSwap] router.swap tx: ${swapHash}`);

          // Optimistic history entry — visible in /history and the swap
          // sidebar widget immediately, before the on-chain log indexes.
          // Cleared automatically once the receipt is picked up.
          recordPendingTx({
            txHash: swapHash,
            kind: "swap",
            title: "Swap",
            subtitle: `${amountIn} ${from} → ${formatUnits(quoteOut, TOKEN_DECIMALS[to])} ${to}`,
            symA: from,
            symB: to,
            user: address,
          });

          const swapRes = await confirmTx(swapHash, "ROUTER_SWAP");
          if (swapRes === "reverted") throw new Error("Swap reverted");
          if (swapRes === "timeout") throw new Error("Swap not yet indexed");

          setIsSwapDone(true);
          return { txHash: swapHash, amountOut: formatUnits(quoteOut, TOKEN_DECIMALS[to]) };
        }

        // ── Path B: direct pool fallback ──────────────────────────────
        const poolAddr = getPoolAddress(from, to);
        if (!poolAddr) throw new Error(`No pool for ${from}/${to}`);

        const tokenA = (await client.readContract({
          address: poolAddr, abi: POOL_ABI, functionName: "tokenA",
        })) as `0x${string}`;
        const isAToB = tokenA.toLowerCase() === tokenIn.toLowerCase();

        if (!isNativeIn) {
          const allowance = (await client.readContract({
            address: tokenIn, abi: ERC20_ABI, functionName: "allowance",
            args: [address, poolAddr],
          })) as bigint;

          if (allowance < amountWei) {
            setIsApproving(true);
            try {
              const apprHash = await writeApprove({
                address: tokenIn, abi: ERC20_ABI, functionName: "approve",
                args: [poolAddr, MAX_UINT256],
              });
              const apprRes = await confirmTx(apprHash, "POOL_APPROVE");
              if (apprRes === "reverted") throw new Error("Approval reverted");
              if (apprRes === "timeout") {
                const after = (await client.readContract({
                  address: tokenIn, abi: ERC20_ABI, functionName: "allowance",
                  args: [address, poolAddr],
                })) as bigint;
                if (after < amountWei) throw new Error("Approval timed out");
              }
            } finally {
              setIsApproving(false);
            }
          }
        }

        setIsSwapping(true);
        const swapHash = await writeSwap({
          address: poolAddr,
          abi: POOL_ABI,
          functionName: isAToB ? "swapAForB" : "swapBForA",
          args: [amountWei],
          ...({ value: isNativeIn ? amountWei : 0n } as { value: bigint }),
        } as unknown as Parameters<typeof writeSwap>[0]);
        console.log(`[useSwap] pool swap tx: ${swapHash}`);

        // Optimistic history entry for the direct-pool path too. The pool's
        // Swap event has the user as `sender` (we call swapAForB/swapBForA
        // directly), so the on-chain log will show up in /history once
        // indexed and the pending entry will be cleared.
        recordPendingTx({
          txHash: swapHash,
          kind: "swap",
          title: "Swap",
          subtitle: `${amountIn} ${from} → ${formatUnits(quoteOut, TOKEN_DECIMALS[to])} ${to}`,
          symA: from,
          symB: to,
          user: address,
        });

        const swapRes = await confirmTx(swapHash, "POOL_SWAP");
        if (swapRes === "reverted") throw new Error("Swap reverted");
        if (swapRes === "timeout") throw new Error("Swap not yet indexed");

        // Pool path doesn't enforce amountOutMin on-chain; verify output
        // post-hoc by comparing the final reserves quote against minimum.
        // (The pool itself reverts on underflow, so we accept the tx as
        // confirmed; slippage protection is best-effort here. Use the
        // router for guaranteed enforcement.)
        if (quoteOut < amountOutMin) {
          console.warn("[useSwap] direct pool path: slippage not enforced on-chain");
        }

        setIsSwapDone(true);
        return { txHash: swapHash, amountOut: formatUnits(quoteOut, TOKEN_DECIMALS[to]) };
      } catch (err: any) {
        const msg = err?.shortMessage ?? err?.reason ?? err?.message ?? "Swap failed";
        setError(msg);
        throw err instanceof Error ? err : new Error(msg);
      } finally {
        setIsApproving(false);
        setIsSwapping(false);
      }
    },
    [address, writeApprove, writeSwap],
  );

  return {
    isApproving,
    isSwapping,
    isSwapSuccess: isSwapDone,
    error,
    getOutputAmount,
    executeSwap,
    routerEnabled: hasRouter(),
  };
}
