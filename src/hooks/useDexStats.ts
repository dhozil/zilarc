"use client";

/**
 * useDexStats — live aggregated DEX metrics for the home and pool pages.
 *
 * Fetches reserves + recent Swap events from every registered ZilarcSwap
 * pool and rolls them into headline numbers + a per-pool breakdown.
 *
 * The implementation favours resilience over throughput: instead of one
 * multicall (which returns a single failure code and zeros every pool
 * when any RPC quirk hits), we issue per-pool reads in parallel and let
 * each pool succeed or fail independently. A noisy console.warn fires
 * for each failure so you can diagnose stuck rows from devtools.
 */

import { useEffect, useState } from "react";
import {
  createPublicClient,
  http,
  parseAbiItem,
  formatUnits,
  type PublicClient,
} from "viem";
import { arcTestnet, ARC_TOKENS, SWAP_POOLS } from "@/lib/wagmi";

const ARC_RPC =
  (import.meta.env.VITE_ARC_RPC_URL as string | undefined) ||
  arcTestnet.rpcUrls.default.http[0];

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// USD-equivalent prices for stat display. Pools are seeded near 1:1, so
// the AMM math is internally consistent even if real-market prices drift.
// Update these once a price oracle is available on Arc Testnet.
const TOKEN_PRICE: Record<string, { decimals: number; price: number; sym: string }> = {
  [ARC_TOKENS.USDC.toLowerCase()]: { decimals: 18, price: 1.0,  sym: "USDC" },
  [ARC_TOKENS.EURC.toLowerCase()]: { decimals: 6,  price: 1.08, sym: "EURC" },
  [ARC_TOKENS.Z.toLowerCase()]:    { decimals: 18, price: 1.0,  sym: "Z"    },
  [ARC_TOKENS.NEON.toLowerCase()]: { decimals: 18, price: 1.0,  sym: "NEON" },
  [ARC_TOKENS.JETT.toLowerCase()]: { decimals: 18, price: 1.0,  sym: "JETT" },
};

const POOL_ABI = [
  { name: "reserveA",    type: "function", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { name: "reserveB",    type: "function", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { name: "tokenA",      type: "function", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { name: "tokenB",      type: "function", inputs: [], outputs: [{ name: "", type: "address" }], stateMutability: "view" },
  { name: "totalSupply", type: "function", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
  { name: "fee",         type: "function", inputs: [], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
] as const;

const SWAP_EVENT = parseAbiItem(
  "event Swap(address indexed sender, uint256 amountAIn, uint256 amountBIn, uint256 amountAOut, uint256 amountBOut)",
);

// ~3 bps × 86 400 s = 259 200 blocks for a 24 h window. Public RPCs commonly
// limit getLogs to 10k–50k blocks, so we walk in chunks.
const BLOCKS_PER_SEC = 3;
const WINDOW_24H_BLOCKS = 24 * 60 * 60 * BLOCKS_PER_SEC;
const MAX_LOG_RANGE = 50_000;

export interface PoolStats {
  pair: string;
  pool: `0x${string}`;
  symA: string;
  symB: string;
  reserveA: number;
  reserveB: number;
  tvlUSD: number;
  feeBps: number;
  trades24h: number;
  volume24hUSD: number;
}

export interface DexStats {
  loading: boolean;
  totalTvlUSD: number;
  totalVolume24hUSD: number;
  totalTrades24h: number;
  activePairs: number;
  pools: PoolStats[];
  refreshedAt: number;
}

const initialState: DexStats = {
  loading: true,
  totalTvlUSD: 0,
  totalVolume24hUSD: 0,
  totalTrades24h: 0,
  activePairs: 0,
  pools: [],
  refreshedAt: 0,
};

function toFloat(raw: bigint, decimals: number): number {
  return parseFloat(formatUnits(raw, decimals));
}

/**
 * Read all six view fields off a single pool. Resilient to per-call
 * failures (returns null) so one bad pool doesn't take the whole
 * dashboard with it.
 */
async function readPool(
  client: PublicClient,
  pool: `0x${string}`,
): Promise<null | {
  pool: `0x${string}`;
  tokenA: string;
  tokenB: string;
  reserveA: bigint;
  reserveB: bigint;
  totalSupply: bigint;
  feeBps: number;
}> {
  try {
    const [reserveA, reserveB, tokenA, tokenB, totalSupply, fee] = await Promise.all([
      client.readContract({ address: pool, abi: POOL_ABI, functionName: "reserveA" })    as Promise<bigint>,
      client.readContract({ address: pool, abi: POOL_ABI, functionName: "reserveB" })    as Promise<bigint>,
      client.readContract({ address: pool, abi: POOL_ABI, functionName: "tokenA" })      as Promise<string>,
      client.readContract({ address: pool, abi: POOL_ABI, functionName: "tokenB" })      as Promise<string>,
      client.readContract({ address: pool, abi: POOL_ABI, functionName: "totalSupply" }) as Promise<bigint>,
      client.readContract({ address: pool, abi: POOL_ABI, functionName: "fee" })         as Promise<bigint>,
    ]);
    return {
      pool,
      reserveA,
      reserveB,
      tokenA: tokenA.toLowerCase(),
      tokenB: tokenB.toLowerCase(),
      totalSupply,
      feeBps: Number(fee),
    };
  } catch (err) {
    console.warn(`[useDexStats] read failed for pool ${pool}:`, err);
    return null;
  }
}

export function useDexStats(refreshIntervalMs = 30_000): DexStats {
  const [state, setState] = useState<DexStats>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      const client: PublicClient = createPublicClient({
        chain: arcTestnet,
        transport: http(ARC_RPC),
      });

      const poolAddrs = (Object.values(SWAP_POOLS) as string[])
        .filter((a) => a.toLowerCase() !== ZERO_ADDR) as `0x${string}`[];

      if (poolAddrs.length === 0) {
        if (!cancelled) {
          setState({ ...initialState, loading: false, refreshedAt: Date.now() });
        }
        return;
      }

      try {
        // ── 1. Per-pool reads (robust to individual failures) ────────
        const raw = (await Promise.all(poolAddrs.map((p) => readPool(client, p))))
          .filter((r): r is NonNullable<typeof r> => r != null);

        if (raw.length === 0) {
          console.warn("[useDexStats] all pool reads failed");
          if (!cancelled) {
            setState({ ...initialState, loading: false, refreshedAt: Date.now() });
          }
          return;
        }

        // ── 2. Per-pool TVL ───────────────────────────────────────
        const stats: PoolStats[] = raw.map((p) => {
          const a = TOKEN_PRICE[p.tokenA] ?? { decimals: 18, price: 0, sym: p.tokenA.slice(0, 6) };
          const b = TOKEN_PRICE[p.tokenB] ?? { decimals: 18, price: 0, sym: p.tokenB.slice(0, 6) };
          const aH = toFloat(p.reserveA, a.decimals);
          const bH = toFloat(p.reserveB, b.decimals);
          return {
            pair: `${a.sym}/${b.sym}`,
            pool: p.pool,
            symA: a.sym,
            symB: b.sym,
            reserveA: aH,
            reserveB: bH,
            tvlUSD: aH * a.price + bH * b.price,
            feeBps: p.feeBps,
            trades24h: 0,
            volume24hUSD: 0,
          };
        });

        // ── 3. Walk Swap logs in the 24h window, in chunks ───────
        const head = await client.getBlockNumber();
        const desiredFrom = head > BigInt(WINDOW_24H_BLOCKS)
          ? head - BigInt(WINDOW_24H_BLOCKS)
          : 0n;

        const tradesByPool: Record<string, number> = {};
        const volumeByPool: Record<string, number> = {};
        let cursor = head;

        while (cursor > desiredFrom) {
          let from = cursor > BigInt(MAX_LOG_RANGE - 1)
            ? cursor - BigInt(MAX_LOG_RANGE - 1)
            : 0n;
          if (from < desiredFrom) from = desiredFrom;
          let logs: Array<{ address: string; args: { amountAIn?: bigint; amountBIn?: bigint } }> = [];
          try {
            logs = (await client.getLogs({
              address: poolAddrs,
              event: SWAP_EVENT,
              fromBlock: from,
              toBlock: cursor,
            })) as typeof logs;
          } catch (err) {
            console.warn("[useDexStats] getLogs chunk failed:", err);
            break;
          }

          for (const log of logs) {
            const poolKey = log.address.toLowerCase();
            const meta = raw.find((r) => r.pool.toLowerCase() === poolKey);
            if (!meta) continue;
            const a = TOKEN_PRICE[meta.tokenA];
            const b = TOKEN_PRICE[meta.tokenB];
            const aIn = log.args.amountAIn ?? 0n;
            const bIn = log.args.amountBIn ?? 0n;

            let volume = 0;
            if (a && aIn > 0n) volume += toFloat(aIn, a.decimals) * a.price;
            if (b && bIn > 0n) volume += toFloat(bIn, b.decimals) * b.price;

            tradesByPool[poolKey] = (tradesByPool[poolKey] ?? 0) + 1;
            volumeByPool[poolKey] = (volumeByPool[poolKey] ?? 0) + volume;
          }

          if (from === 0n) break;
          cursor = from - 1n;
        }

        for (const s of stats) {
          const key = s.pool.toLowerCase();
          s.trades24h    = tradesByPool[key] ?? 0;
          s.volume24hUSD = volumeByPool[key] ?? 0;
        }

        stats.sort((x, y) => y.tvlUSD - x.tvlUSD);

        const totalTvlUSD       = stats.reduce((acc, p) => acc + p.tvlUSD,       0);
        const totalVolume24hUSD = stats.reduce((acc, p) => acc + p.volume24hUSD, 0);
        const totalTrades24h    = stats.reduce((acc, p) => acc + p.trades24h,    0);
        const activePairs       = stats.filter((p) => p.tvlUSD > 0).length;

        if (!cancelled) {
          setState({
            loading: false,
            totalTvlUSD,
            totalVolume24hUSD,
            totalTrades24h,
            activePairs,
            pools: stats,
            refreshedAt: Date.now(),
          });
        }
      } catch (err) {
        console.error("[useDexStats] fetch failed:", err);
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false }));
        }
      }
    }

    fetchAll();
    const interval = setInterval(fetchAll, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [refreshIntervalMs]);

  return state;
}

/**
 * Format a USD number compactly (e.g. $1.2K, $4.5M). Falls back to
 * "$0.00" when the value is exactly 0.
 */
export function fmtUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "$0.00";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

export function fmtCount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toString();
}
