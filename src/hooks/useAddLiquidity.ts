"use client";

/**
 * useAddLiquidity — uniform AMM liquidity provision on Arc Testnet.
 *
 * Every supported pair (including USDC ↔ token) uses a real ZilarcSwap pool.
 * USDC native is the precompile at 0x3600…0000 — for those pools, the AMM
 * pulls native USDC via msg.value and the ERC-20 side via transferFrom.
 * For ERC-20-only pairs, both sides use approve+transferFrom.
 *
 * All amounts are 18-decimal raw units. EURC stays out of the AMM pool set
 * for now (no pool deployed); attempting to add EURC liquidity will throw.
 */

import { useState, useCallback } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import { ARC_TOKENS, SWAP_POOLS, USDC_PRECOMPILE } from "@/lib/wagmi";
import { recordPendingTx } from "@/hooks/useTxHistory";

export type LiquidityToken = "USDC" | "EURC" | "Z" | "NEON" | "JETT";

// 18 decimals across the board, except EURC which uses 6 decimals (matches
// the on-chain EURC contract). Arc native USDC reports balance in raw wei,
// so 1 USDC = 1e18 wei pairs 1:1 with 1 token = 1e18 wei.
export const LIQUIDITY_DECIMALS: Record<LiquidityToken, number> = {
  USDC: 18,
  EURC: 6,
  Z:    18,
  NEON: 18,
  JETT: 18,
};

const TOKEN_ADDRESSES: Record<LiquidityToken, `0x${string}`> = {
  USDC: ARC_TOKENS.USDC as `0x${string}`,
  EURC: ARC_TOKENS.EURC as `0x${string}`,
  Z:    ARC_TOKENS.Z    as `0x${string}`,
  NEON: ARC_TOKENS.NEON as `0x${string}`,
  JETT: ARC_TOKENS.JETT as `0x${string}`,
};

const USDC_PRECOMPILE_ADDR = USDC_PRECOMPILE.toLowerCase();

const POOL_ABI = [
  {
    name: "addLiquidity",
    type: "function",
    inputs: [
      { name: "amountA", type: "uint256" },
      { name: "amountB", type: "uint256" },
    ],
    outputs: [{ name: "liquidity", type: "uint256" }],
    stateMutability: "payable",
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

const MAX_UINT256 = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
);

type PoolMeta = {
  tokenA: LiquidityToken;
  tokenB: LiquidityToken;
  pool: `0x${string}`;
};

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// Pool registry. Order-independent lookup. Entries with a zero address (e.g.
// EURC pools before they're deployed) are filtered out by `getPoolForPair`,
// which matches the swap UI's pair-tradability check.
const POOL_REGISTRY: Record<string, PoolMeta> = {
  "USDC-Z":    { tokenA: "USDC", tokenB: "Z",    pool: SWAP_POOLS.USDC_Z },
  "USDC-NEON": { tokenA: "USDC", tokenB: "NEON", pool: SWAP_POOLS.USDC_NEON },
  "USDC-JETT": { tokenA: "USDC", tokenB: "JETT", pool: SWAP_POOLS.USDC_JETT },
  "USDC-EURC": { tokenA: "USDC", tokenB: "EURC", pool: SWAP_POOLS.USDC_EURC },
  "EURC-Z":    { tokenA: "EURC", tokenB: "Z",    pool: SWAP_POOLS.EURC_Z },
  "EURC-NEON": { tokenA: "EURC", tokenB: "NEON", pool: SWAP_POOLS.EURC_NEON },
  "EURC-JETT": { tokenA: "EURC", tokenB: "JETT", pool: SWAP_POOLS.EURC_JETT },
  "Z-NEON":    { tokenA: "Z",    tokenB: "NEON", pool: SWAP_POOLS.Z_NEON },
  "Z-JETT":    { tokenA: "Z",    tokenB: "JETT", pool: SWAP_POOLS.Z_JETT },
  "NEON-JETT": { tokenA: "NEON", tokenB: "JETT", pool: SWAP_POOLS.NEON_JETT },
};

function getPoolForPair(a: LiquidityToken, b: LiquidityToken): PoolMeta | null {
  const meta = POOL_REGISTRY[`${a}-${b}`] ?? POOL_REGISTRY[`${b}-${a}`] ?? null;
  if (!meta) return null;
  if (meta.pool.toLowerCase() === ZERO_ADDR) return null;
  return meta;
}

export function isLiquidityPairSupported(a: LiquidityToken, b: LiquidityToken): boolean {
  if (a === b) return false;
  return getPoolForPair(a, b) !== null;
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
      amountAStr: string,
      amountBStr: string,
      tokenASym: LiquidityToken,
      tokenBSym: LiquidityToken,
    ) => {
      if (!address) throw new Error("Wallet not connected");
      if (!publicClient) throw new Error("Public client unavailable");
      if (tokenASym === tokenBSym) throw new Error("Cannot add liquidity for the same token");

      const meta = getPoolForPair(tokenASym, tokenBSym);
      if (!meta) {
        throw new Error(`No pool deployed for ${tokenASym}/${tokenBSym}`);
      }

      // The pool fixes the (tokenA, tokenB) order at deploy time. Reorder
      // user inputs to match so amountA always pairs with the pool's tokenA.
      const [tokenIn0, amountIn0Str] =
        tokenASym === meta.tokenA
          ? [tokenASym, amountAStr]
          : [tokenBSym, amountBStr];
      const [tokenIn1, amountIn1Str] =
        tokenASym === meta.tokenA
          ? [tokenBSym, amountBStr]
          : [tokenASym, amountAStr];

      const amountIn0 = parseUnits(amountIn0Str, LIQUIDITY_DECIMALS[tokenIn0]);
      const amountIn1 = parseUnits(amountIn1Str, LIQUIDITY_DECIMALS[tokenIn1]);
      if (amountIn0 === 0n || amountIn1 === 0n) {
        throw new Error("Amounts must be greater than 0");
      }

      const addr0 = TOKEN_ADDRESSES[tokenIn0];
      const addr1 = TOKEN_ADDRESSES[tokenIn1];
      const isNative0 = addr0.toLowerCase() === USDC_PRECOMPILE_ADDR;
      const isNative1 = addr1.toLowerCase() === USDC_PRECOMPILE_ADDR;

      // ZilarcSwap accepts at most one precompile side per pool. The native
      // side rides msg.value; the other (ERC-20) side needs approve.
      const nativeValue = isNative0
        ? amountIn0
        : isNative1
        ? amountIn1
        : 0n;

      setError(null);
      setIsAddingLiquidity(true);

      try {
        // Approve any ERC-20 sides
        const erc20Sides: Array<{ token: `0x${string}`; amount: bigint }> = [];
        if (!isNative0) erc20Sides.push({ token: addr0, amount: amountIn0 });
        if (!isNative1) erc20Sides.push({ token: addr1, amount: amountIn1 });

        for (const side of erc20Sides) {
          const allowance = (await publicClient.readContract({
            address: side.token,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [address, meta.pool],
          })) as bigint;

          if (allowance < side.amount) {
            setIsApproving(true);
            try {
              const apprHash: `0x${string}` = await writeApprove({
                address: side.token,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [meta.pool, MAX_UINT256],
              });
              // Wait for inclusion (Arc RPC indexes within a few seconds).
              const start = Date.now();
              while (Date.now() - start < 60_000) {
                try {
                  const receipt = await publicClient.getTransactionReceipt({
                    hash: apprHash,
                  });
                  if (receipt.status === "reverted") {
                    throw new Error("Approval reverted");
                  }
                  break;
                } catch {
                  await new Promise((r) => setTimeout(r, 1500));
                }
              }
            } finally {
              setIsApproving(false);
            }
          }
        }

        const txHash = await writeAddLiquidity({
          address: meta.pool,
          abi: POOL_ABI,
          functionName: "addLiquidity",
          args: [amountIn0, amountIn1],
          ...({ value: nativeValue } as { value: bigint }),
        } as unknown as Parameters<typeof writeAddLiquidity>[0]);

        console.log(
          `[useAddLiquidity] ${tokenIn0}+${tokenIn1} pool=${meta.pool} tx=${txHash}`,
        );

        // Optimistic history entry. The pool's Mint event has the user as
        // `sender`, so the on-chain log will show up in /history once
        // indexed and the pending entry will be cleared.
        recordPendingTx({
          txHash,
          kind: "addLiquidity",
          title: "Add liquidity",
          subtitle: `+${amountIn0Str} ${tokenIn0} · +${amountIn1Str} ${tokenIn1}`,
          symA: tokenIn0,
          symB: tokenIn1,
          pool: meta.pool,
          user: address,
        });

        return txHash;
      } catch (err: any) {
        const msg =
          err?.shortMessage ?? err?.reason ?? err?.message ?? "Add liquidity failed";
        setError(msg);
        throw err instanceof Error ? err : new Error(msg);
      } finally {
        setIsAddingLiquidity(false);
        setIsApproving(false);
      }
    },
    [address, publicClient, writeApprove, writeAddLiquidity],
  );

  return {
    isApproving,
    isAddingLiquidity,
    error,
    addLiquidity,
    getPoolForPair,
  };
}
