"use client";

import { useState, useCallback } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseUnits, formatUnits, http, createPublicClient } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { ARC_TOKENS, SWAP_POOLS, arcTestnet } from "@/lib/wagmi";

export type TokenSym = "USDC" | "EURC" | "Z" | "NEON" | "JETT";

export const TOKEN_DECIMALS: Record<TokenSym, number> = {
  USDC: 6,
  EURC: 6,
  Z:    18,
  NEON: 18,
  JETT: 18,
};

const SWAP_ABI = [
  {
    name: "swapAForB",
    type: "function",
    inputs: [{ name: "amountAIn", type: "uint256" }],
    outputs: [{ name: "amountBOut", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "swapBForA",
    type: "function",
    inputs: [{ name: "amountBIn", type: "uint256" }],
    outputs: [{ name: "amountAOut", type: "uint256" }],
    stateMutability: "nonpayable",
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

const TOKEN_ADDRESSES: Record<TokenSym, `0x${string}`> = {
  USDC:  ARC_TOKENS.USDC  as `0x${string}`,
  EURC:  ARC_TOKENS.EURC  as `0x${string}`,
  Z:     ARC_TOKENS.Z     as `0x${string}`,
  NEON:  ARC_TOKENS.NEON  as `0x${string}`,
  JETT:  ARC_TOKENS.JETT  as `0x${string}`,
};

// Pool keys are sorted alphabetically (USDC < NEON < Z)
const POOL_REGISTRY: Record<string, `0x${string}`> = {
  "NEON-USDC": SWAP_POOLS.USDC_NEON,
  "JETT-USDC": SWAP_POOLS.USDC_JETT,
  "Z-USDC":    SWAP_POOLS.USDC_Z,
  "NEON-Z":    SWAP_POOLS.Z_NEON,
  "JETT-Z":    SWAP_POOLS.Z_JETT,
  "JETT-NEON": SWAP_POOLS.NEON_JETT,
};

function getPoolAddress(from: TokenSym, to: TokenSym): `0x${string}` | null {
  if (from === to) return null;
  const key = [from, to].sort().join("-") as string;
  return POOL_REGISTRY[key] ?? null;
}

function getArcClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http("https://rpc.blockdaemon.testnet.arc.network"),
  });
}

async function confirmTx(hash: `0x${string}`, label: string, timeoutMs = 90_000): Promise<"confirmed" | "reverted" | "timeout"> {
  const client = getArcClient();
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  console.log(`[confirmTx][${label}] tx=${hash} polling started...`);

  while (Date.now() < deadline) {
    attempt++;
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      console.log(`[confirmTx][${label}] tx=${hash} status=${receipt.status} (block=${receipt.blockNumber})`);
      return receipt.status === "reverted" ? "reverted" : "confirmed";
    } catch (err: any) {
      // Extract inner error if viem wraps it
      const innerErr = err?.cause ?? err;
      const msg      = (err?.message ?? innerErr?.message ?? "").toLowerCase();
      const shortMsg = (err?.shortMessage ?? innerErr?.shortMessage ?? msg).toLowerCase();
      const code     = err?.code ?? innerErr?.code;
      const details  = err?.details?.toLowerCase() ?? "";

      // All of these are retryable Arc RPC indexing delays
      const isWaitable =
        code === -32000 ||
        code === -32603 ||
        code === -32602 ||
        msg.includes("not found") ||
        msg.includes("notfound") ||
        msg.includes("unknown hash") ||
        msg.includes("unknown tx") ||
        msg.includes("already known") ||
        msg.includes("unknown block") ||
        shortMsg.includes("not found") ||
        shortMsg.includes("unknown hash") ||
        shortMsg.includes("transaction not found") ||
        shortMsg.includes("receipt not found") ||
        details.includes("not found") ||
        err?.message?.includes("Transaction receipt");

      if (isWaitable) {
        const delay = Math.min(4000 + attempt * 500, 12000);
        console.log(`[confirmTx][${label}] tx=${hash} attempt=${attempt} not indexed (${shortMsg}), retry in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Non-retryable — treat as timeout so caller can decide
      console.warn(`[confirmTx][${label}] tx=${hash} non-retryable (${shortMsg}), returning timeout`);
      return "timeout";
    }
  }

  console.warn(`[confirmTx][${label}] tx=${hash} timed out after ${timeoutMs}ms`);
  return "timeout";
}

export function useSwap() {
  const { address } = useAccount();

  const [isApproving,  setIsApproving]  = useState(false);
  const [isSwapping,   setIsSwapping]    = useState(false);
  const [isSwapDone,   setIsSwapDone]   = useState(false);
  const [error,        setError]         = useState<string | null>(null);

  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeSwap }    = useWriteContract();

  // ── Live output amount ──────────────────────────────────────────────
  const getOutputAmount = useCallback(
    async (amountIn: string, from: TokenSym, to: TokenSym): Promise<string> => {
      if (!amountIn || parseFloat(amountIn) === 0) return "0";

      const poolAddr = getPoolAddress(from, to);
      if (!poolAddr) return "0";

      try {
        const client   = getArcClient();
        const decimals = TOKEN_DECIMALS[from];
        const amount   = parseUnits(amountIn, decimals);

        const tokenA: `0x${string}` = await client.readContract({
          address: poolAddr, abi: SWAP_ABI, functionName: "tokenA",
        });
        const tokenIn = TOKEN_ADDRESSES[from];
        const isAToB  = tokenA.toLowerCase() === tokenIn.toLowerCase();

        const amountOut = await client.readContract({
          address: poolAddr, abi: SWAP_ABI, functionName: "getAmountOut",
          args: [amount, isAToB],
        });

        return formatUnits(amountOut as bigint, TOKEN_DECIMALS[to] ?? 18);
      } catch (err) {
        console.error("[useSwap] getAmountOut error:", err);
        return "0";
      }
    },
    []
  );

  // ── Execute swap ──────────────────────────────────────────────────
  const executeSwap = useCallback(
    async (amountIn: string, from: TokenSym, to: TokenSym) => {
      if (!address) throw new Error("Wallet not connected");
      if (from === to) throw new Error("Cannot swap same token");

      setError(null);
      setIsSwapDone(false);

      try {
        const poolAddr = getPoolAddress(from, to);
        if (!poolAddr) throw new Error(`No pool found for ${from} / ${to}`);

        const client = getArcClient();

        // Resolve token ordering from contract — not hardcoded
        const tokenA: `0x${string}` = await client.readContract({
          address: poolAddr, abi: SWAP_ABI, functionName: "tokenA",
        });
        const tokenIn = TOKEN_ADDRESSES[from];
        const isAToB  = tokenA.toLowerCase() === tokenIn.toLowerCase();

        console.log(
          `[useSwap] ${from}→${to}  pool=${poolAddr}  ` +
          `tokenA=${tokenA}  tokenIn=${tokenIn}  isAToB=${isAToB}`
        );

        const decimals  = TOKEN_DECIMALS[from];
        const amountWei = parseUnits(amountIn, decimals);

        // ── Allowance check ──────────────────────────────────────────
        const allowance = await client.readContract({
          address: tokenIn, abi: ERC20_ABI, functionName: "allowance",
          args: [address, poolAddr],
        });

        if ((allowance as bigint) < amountWei) {
          setIsApproving(true);

          const MAX_UINT256 =
            BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

          console.log(`[useSwap] Sending approval for ${from}...`);
          const hash = await writeApprove({
            address: tokenIn, abi: ERC20_ABI, functionName: "approve",
            args: [poolAddr, MAX_UINT256],
          });

          console.log(`[useSwap] Approval tx: ${hash}`);
          let apprResult: "confirmed" | "reverted" | "timeout" = "timeout";
          try {
            apprResult = await confirmTx(hash, "APPROVE");
          } catch (err) {
            console.error(`[useSwap] Approval confirm error:`, err);
            apprResult = "timeout";
          } finally {
            setIsApproving(false); // always unblock UI
          }

          if (apprResult === "reverted") throw new Error("Approval transaction reverted on-chain");
          if (apprResult === "timeout") {
            const allowanceAfter = await client.readContract({
              address: tokenIn, abi: ERC20_ABI, functionName: "allowance",
              args: [address, poolAddr],
            });
            if ((allowanceAfter as bigint) < amountWei) {
              throw new Error("Approval timed out — please try again");
            }
            console.warn(`[useSwap] Approval timed out but allowance sufficient — proceeding.`);
          } else {
            console.log(`[useSwap] Approval confirmed.`);
          }
        }

        // ── Swap ────────────────────────────────────────────────────
        setIsApproving(false);
        setIsSwapping(true);

        console.log(`[useSwap] Sending swap: ${amountIn} ${from} → ${to}...`);
        const hash = await writeSwap({
          address: poolAddr,
          abi: SWAP_ABI,
          functionName: isAToB ? "swapAForB" : "swapBForA",
          args: [amountWei],
        });

        console.log(`[useSwap] Swap tx: ${hash}`);
        const swapResult = await confirmTx(hash, "SWAP");
        if (swapResult === "reverted") throw new Error("Swap transaction reverted on-chain");
        if (swapResult === "timeout") throw new Error("Swap transaction timed out — please try again");
        console.log(`[useSwap] Swap confirmed!`);

        setIsSwapDone(true);
        return true;
      } catch (err: any) {
        const msg = err?.reason ?? err?.message ?? "Swap failed";
        setError(msg);
        throw err instanceof Error ? err : new Error(msg);
      } finally {
        setIsApproving(false);
        setIsSwapping(false);
      }
    },
    [address, writeApprove, writeSwap]
  );

  return {
    isApproving:   isApproving,
    isSwapping:    isSwapping,
    isSwapSuccess:  isSwapDone,
    error,
    getOutputAmount,
    executeSwap,
  };
}
