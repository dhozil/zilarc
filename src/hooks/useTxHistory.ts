"use client";

/**
 * useTxHistory — on-chain activity feed for the connected wallet.
 *
 * Fetches three event types in a single sweep:
 *   - Router `Swap`       (every swap routed through ZilarcRouter)
 *   - Pool   `Mint`       (add liquidity into any ZilarcSwap pool)
 *   - Pool   `Burn`       (remove liquidity from any ZilarcSwap pool)
 *
 * Filtering is done at the RPC layer via the `sender` indexed topic, so
 * we only ever pay for blocks that actually involve the user.
 *
 * Default window is the last 7 days (~1.8M blocks at Arc's ~3 bps).
 * The window is walked in 50 000-block chunks so we stay under typical
 * public-RPC `eth_getLogs` range caps.
 *
 * Pending transactions submitted from the UI (via `recordPendingTx`)
 * are merged in optimistically. They get a `pending` status until the
 * receipt indexes — at which point the on-chain log replaces them.
 */

import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import {
  createPublicClient,
  http,
  formatUnits,
  parseAbiItem,
  type PublicClient,
  type Log,
} from "viem";
import {
  arcTestnet,
  ARC_TOKENS,
  SWAP_POOLS,
  ZILARC_ROUTER,
} from "@/lib/wagmi";

const ARC_RPC =
  (import.meta.env.VITE_ARC_RPC_URL as string | undefined) ||
  arcTestnet.rpcUrls.default.http[0];

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// Same defaults as useDexStats. ~3 bps × 86400 s × 7 = 1 814 400 blocks.
const BLOCKS_PER_SEC = 3;
const WINDOW_7D_BLOCKS = 7 * 24 * 60 * 60 * BLOCKS_PER_SEC; // 1 814 400
const MAX_LOG_RANGE = 50_000;

const ROUTER_SWAP_EVENT = parseAbiItem(
  "event Swap(address indexed sender, address indexed recipient, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, address pool)",
);

const POOL_MINT_EVENT = parseAbiItem(
  "event Mint(address indexed sender, uint256 amountA, uint256 amountB)",
);
const POOL_BURN_EVENT = parseAbiItem(
  "event Burn(address indexed sender, uint256 amountA, uint256 amountB)",
);

// Address-keyed token metadata for log decoding.
type TokenMeta = { sym: string; decimals: number };
const TOKEN_META: Record<string, TokenMeta> = {
  [ARC_TOKENS.USDC.toLowerCase()]: { sym: "USDC", decimals: 18 },
  [ARC_TOKENS.EURC.toLowerCase()]: { sym: "EURC", decimals: 6  },
  [ARC_TOKENS.Z.toLowerCase()]:    { sym: "Z",    decimals: 18 },
  [ARC_TOKENS.NEON.toLowerCase()]: { sym: "NEON", decimals: 18 },
  [ARC_TOKENS.JETT.toLowerCase()]: { sym: "JETT", decimals: 18 },
};

// For pool events (Mint/Burn) we don't get token addresses in the log —
// we resolve them from the pool address. Map pool → (tokenA, tokenB).
const POOL_TOKENS: Record<string, [TokenMeta, TokenMeta]> = {
  [SWAP_POOLS.USDC_Z.toLowerCase()]:    [TOKEN_META[ARC_TOKENS.USDC.toLowerCase()], TOKEN_META[ARC_TOKENS.Z.toLowerCase()]],
  [SWAP_POOLS.USDC_NEON.toLowerCase()]: [TOKEN_META[ARC_TOKENS.USDC.toLowerCase()], TOKEN_META[ARC_TOKENS.NEON.toLowerCase()]],
  [SWAP_POOLS.USDC_JETT.toLowerCase()]: [TOKEN_META[ARC_TOKENS.USDC.toLowerCase()], TOKEN_META[ARC_TOKENS.JETT.toLowerCase()]],
  [SWAP_POOLS.USDC_EURC.toLowerCase()]: [TOKEN_META[ARC_TOKENS.USDC.toLowerCase()], TOKEN_META[ARC_TOKENS.EURC.toLowerCase()]],
  [SWAP_POOLS.EURC_Z.toLowerCase()]:    [TOKEN_META[ARC_TOKENS.EURC.toLowerCase()], TOKEN_META[ARC_TOKENS.Z.toLowerCase()]],
  [SWAP_POOLS.EURC_NEON.toLowerCase()]: [TOKEN_META[ARC_TOKENS.EURC.toLowerCase()], TOKEN_META[ARC_TOKENS.NEON.toLowerCase()]],
  [SWAP_POOLS.EURC_JETT.toLowerCase()]: [TOKEN_META[ARC_TOKENS.EURC.toLowerCase()], TOKEN_META[ARC_TOKENS.JETT.toLowerCase()]],
  [SWAP_POOLS.Z_NEON.toLowerCase()]:    [TOKEN_META[ARC_TOKENS.Z.toLowerCase()],    TOKEN_META[ARC_TOKENS.NEON.toLowerCase()]],
  [SWAP_POOLS.Z_JETT.toLowerCase()]:    [TOKEN_META[ARC_TOKENS.Z.toLowerCase()],    TOKEN_META[ARC_TOKENS.JETT.toLowerCase()]],
  [SWAP_POOLS.NEON_JETT.toLowerCase()]: [TOKEN_META[ARC_TOKENS.NEON.toLowerCase()], TOKEN_META[ARC_TOKENS.JETT.toLowerCase()]],
};

export type TxKind = "swap" | "addLiquidity" | "removeLiquidity" | "bridge";
export type TxStatus = "pending" | "success" | "reverted";

export interface TxRecord {
  /** Stable identifier — either tx hash + log index, or "pending:<hash>" */
  id: string;
  kind: TxKind;
  status: TxStatus;
  txHash: `0x${string}`;
  blockNumber: bigint;
  /** Unix seconds */
  timestamp: number;
  /** Pretty title shown in tables. */
  title: string;
  /** Short subtitle (pair, amount, etc.) */
  subtitle: string;
  /** Optional pool address for deep-linking */
  pool?: `0x${string}`;
  /** Optional sym pair for icon rendering */
  symA?: string;
  symB?: string;
  /** Used for sorting newest first when block numbers tie. */
  logIndex?: number;
  /** Source chain ID. Bridges live on the source chain (e.g. Sepolia),
   *  on-chain swap/LP rows default to Arc Testnet. Used to build the
   *  correct explorer URL. */
  chainId?: number;
}

// ── localStorage tx storage ───────────────────────────────────────────
//
// Two separate buckets:
//   - PENDING_KEY:    entries waiting for chain confirmation. The hook
//                     verifies these via getTransactionReceipt on every
//                     refresh and clears them once confirmed.
//   - COMPLETED_KEY:  entries the app already knows are done at the time
//                     of recording. Used for cross-chain bridges, which
//                     finish on a different chain than Arc — `useTxHistory`
//                     can't walk those logs, so we cache the canonical
//                     record locally and merge it in.

const PENDING_KEY   = "zilarc.pendingTx.v1";
const COMPLETED_KEY = "zilarc.completedTx.v1";

/** Keep records for a week so /history's window matches the UI default. */
const COMPLETED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface PendingTxEntry {
  txHash: `0x${string}`;
  kind: TxKind;
  title: string;
  subtitle: string;
  pool?: `0x${string}`;
  symA?: string;
  symB?: string;
  user: string;
  submittedAt: number;
  /** Optional: chain ID where the tx was submitted. For Arc-side actions
   *  this is Arc Testnet; for bridges it's the source chain. Used only
   *  for explorer URL resolution in the UI. */
  chainId?: number;
}

interface CompletedTxEntry extends PendingTxEntry {
  /** Block number on the source chain, if known. */
  blockNumber?: number;
}

function loadPending(): PendingTxEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingTxEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePending(entries: PendingTxEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode — ignore */
  }
}

function loadCompleted(): CompletedTxEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPLETED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompletedTxEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCompleted(entries: CompletedTxEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPLETED_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode — ignore */
  }
}

/**
 * Record a transaction as "pending" so it shows up in history immediately,
 * before the chain has indexed the receipt. Should be called right after
 * the wallet returns a tx hash from `writeContract`.
 *
 * The hook reconciles pending entries on every refresh: once an on-chain
 * log with the same tx hash is seen, the pending entry is dropped.
 *
 * Entries older than 1 hour are also dropped automatically — if a tx
 * sits pending that long, it's almost certainly stuck/dropped from the
 * mempool and should be re-submitted.
 */
export function recordPendingTx(entry: Omit<PendingTxEntry, "submittedAt">) {
  const now = Date.now();
  const cur = loadPending();
  const next = cur
    .filter((e) => now - e.submittedAt < 3_600_000)
    .filter((e) => e.txHash.toLowerCase() !== entry.txHash.toLowerCase());
  next.push({ ...entry, submittedAt: now });
  savePending(next);
}

/**
 * Record a transaction the app already knows is final (e.g. CCTP bridges,
 * which finish on a different chain than the one the hook can walk logs
 * on). Stored separately from pending so it is rendered as "success"
 * straight away and never gets stuck on a receipt poll.
 */
export function recordCompletedTx(entry: Omit<CompletedTxEntry, "submittedAt">) {
  const now = Date.now();
  const cur = loadCompleted();
  // Drop expired and duplicate entries, then append.
  const next = cur
    .filter((e) => now - e.submittedAt < COMPLETED_TTL_MS)
    .filter((e) => e.txHash.toLowerCase() !== entry.txHash.toLowerCase());
  next.push({ ...entry, submittedAt: now });
  saveCompleted(next);

  // Clear any pending entry for the same hash — bridge starts as "pending"
  // earlier in the flow, then transitions to completed once mint lands.
  const stillPending = loadPending().filter(
    (p) => p.txHash.toLowerCase() !== entry.txHash.toLowerCase(),
  );
  savePending(stillPending);
}

// ── Hook ──────────────────────────────────────────────────────────────

export interface UseTxHistoryResult {
  loading: boolean;
  records: TxRecord[];
  error: string | null;
  refresh: () => void;
  refreshedAt: number;
}

export function useTxHistory(refreshIntervalMs = 30_000): UseTxHistoryResult {
  const { address } = useAccount();
  const [records, setRecords] = useState<TxRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshedAt, setRefreshedAt] = useState(0);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    if (!address) {
      setRecords([]);
      setLoading(false);
      return;
    }

    async function fetchAll() {
      setLoading(true);
      const client: PublicClient = createPublicClient({
        chain: arcTestnet,
        transport: http(ARC_RPC),
      });

      try {
        const head = await client.getBlockNumber();
        const desiredFrom = head > BigInt(WINDOW_7D_BLOCKS)
          ? head - BigInt(WINDOW_7D_BLOCKS)
          : 0n;

        const userAddr = address!.toLowerCase() as `0x${string}`;
        const poolAddrs = Object.values(SWAP_POOLS)
          .filter((a) => a.toLowerCase() !== ZERO_ADDR) as `0x${string}`[];
        const routerAddr = ZILARC_ROUTER.toLowerCase() === ZERO_ADDR
          ? null
          : (ZILARC_ROUTER as `0x${string}`);

        // Walk in chunks. For each chunk, request:
        //   - Router Swap with sender=user
        //   - Pool Mint   with sender=user (across all pools)
        //   - Pool Burn   with sender=user (across all pools)
        const swapLogs:  Log[] = [];
        const mintLogs:  Log[] = [];
        const burnLogs:  Log[] = [];

        let cursor = head;
        while (cursor > desiredFrom) {
          let from = cursor > BigInt(MAX_LOG_RANGE - 1)
            ? cursor - BigInt(MAX_LOG_RANGE - 1)
            : 0n;
          if (from < desiredFrom) from = desiredFrom;

          const requests: Array<Promise<Log[]>> = [];
          if (routerAddr) {
            requests.push(client.getLogs({
              address: routerAddr,
              event: ROUTER_SWAP_EVENT,
              args: { sender: userAddr },
              fromBlock: from,
              toBlock: cursor,
            }) as unknown as Promise<Log[]>);
          }
          requests.push(client.getLogs({
            address: poolAddrs,
            event: POOL_MINT_EVENT,
            args: { sender: userAddr },
            fromBlock: from,
            toBlock: cursor,
          }) as unknown as Promise<Log[]>);
          requests.push(client.getLogs({
            address: poolAddrs,
            event: POOL_BURN_EVENT,
            args: { sender: userAddr },
            fromBlock: from,
            toBlock: cursor,
          }) as unknown as Promise<Log[]>);

          try {
            const results = await Promise.all(requests);
            if (routerAddr) {
              swapLogs.push(...results[0]);
              mintLogs.push(...results[1]);
              burnLogs.push(...results[2]);
            } else {
              mintLogs.push(...results[0]);
              burnLogs.push(...results[1]);
            }
          } catch (err) {
            console.warn("[useTxHistory] getLogs chunk failed:", err);
            // Keep going with what we have rather than blanking the UI.
            break;
          }

          if (from === 0n) break;
          cursor = from - 1n;
        }

        // Pull block timestamps in batch via multicall on a small block helper.
        // We instead just read each unique block once with getBlock (cheap on
        // Arc testnet, and avoids needing a multicall against the chain).
        const allLogs = [...swapLogs, ...mintLogs, ...burnLogs];
        const uniqBlocks = Array.from(
          new Set(allLogs.map((l) => l.blockNumber!.toString())),
        );
        const blockTs: Record<string, number> = {};
        await Promise.all(
          uniqBlocks.map(async (bn) => {
            try {
              const b = await client.getBlock({ blockNumber: BigInt(bn) });
              blockTs[bn] = Number(b.timestamp);
            } catch {
              blockTs[bn] = 0;
            }
          }),
        );

        const out: TxRecord[] = [];

        for (const log of swapLogs as any[]) {
          const a = log.args.tokenIn?.toLowerCase()  ?? "";
          const b = log.args.tokenOut?.toLowerCase() ?? "";
          const tA = TOKEN_META[a] ?? { sym: a.slice(0, 6), decimals: 18 };
          const tB = TOKEN_META[b] ?? { sym: b.slice(0, 6), decimals: 18 };
          const amtIn  = log.args.amountIn  ?? 0n;
          const amtOut = log.args.amountOut ?? 0n;
          out.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            kind: "swap",
            status: "success",
            txHash: log.transactionHash,
            blockNumber: log.blockNumber!,
            timestamp: blockTs[log.blockNumber!.toString()] ?? 0,
            title: "Swap",
            subtitle: `${formatAmount(amtIn, tA.decimals)} ${tA.sym} → ${formatAmount(amtOut, tB.decimals)} ${tB.sym}`,
            symA: tA.sym,
            symB: tB.sym,
            pool: log.args.pool,
            logIndex: Number(log.logIndex),
          });
        }

        for (const log of mintLogs as any[]) {
          const tokens = POOL_TOKENS[log.address.toLowerCase()];
          if (!tokens) continue;
          const [tA, tB] = tokens;
          out.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            kind: "addLiquidity",
            status: "success",
            txHash: log.transactionHash,
            blockNumber: log.blockNumber!,
            timestamp: blockTs[log.blockNumber!.toString()] ?? 0,
            title: "Add liquidity",
            subtitle: `+${formatAmount(log.args.amountA ?? 0n, tA.decimals)} ${tA.sym} · +${formatAmount(log.args.amountB ?? 0n, tB.decimals)} ${tB.sym}`,
            symA: tA.sym,
            symB: tB.sym,
            pool: log.address as `0x${string}`,
            logIndex: Number(log.logIndex),
          });
        }

        for (const log of burnLogs as any[]) {
          const tokens = POOL_TOKENS[log.address.toLowerCase()];
          if (!tokens) continue;
          const [tA, tB] = tokens;
          out.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            kind: "removeLiquidity",
            status: "success",
            txHash: log.transactionHash,
            blockNumber: log.blockNumber!,
            timestamp: blockTs[log.blockNumber!.toString()] ?? 0,
            title: "Remove liquidity",
            subtitle: `-${formatAmount(log.args.amountA ?? 0n, tA.decimals)} ${tA.sym} · -${formatAmount(log.args.amountB ?? 0n, tB.decimals)} ${tB.sym}`,
            symA: tA.sym,
            symB: tB.sym,
            pool: log.address as `0x${string}`,
            logIndex: Number(log.logIndex),
          });
        }

        // ── 4. Reconcile pending entries ──────────────────────────
        //
        // Don't trust on-chain log walking alone — getLogs chunks can
        // fail silently. For each pending entry whose hash isn't in
        // the indexed set, hit getTransactionReceipt directly. If we
        // get back a "success" receipt, treat it as confirmed and
        // drop the pending entry (the on-chain log will pick it up
        // on the next tick anyway). If we get back "reverted", flip
        // its status. If we can't fetch (RPC error), leave as pending.
        const indexedHashes = new Set(out.map((r) => r.txHash.toLowerCase()));
        const allPending = loadPending().filter(
          (p) => p.user.toLowerCase() === userAddr,
        );

        const stillPending: PendingTxEntry[] = [];
        for (const p of allPending) {
          // Drop entries older than 1h regardless — they're almost
          // certainly stuck or dropped from the mempool.
          if (Date.now() - p.submittedAt >= 3_600_000) continue;

          const lc = p.txHash.toLowerCase();

          // Already confirmed via on-chain log walk.
          if (indexedHashes.has(lc)) continue;

          // For bridge entries, the tx lives on a different chain — we
          // can't query it from the Arc public client. Migrate them to
          // the completed bucket (CCTP bridges only fire `recordPendingTx`
          // in older versions of the app; the new flow uses
          // `recordCompletedTx` directly). Either way, the entry is
          // treated as success here so it doesn't get stuck in pending.
          if (p.kind === "bridge") {
            recordCompletedTx({
              txHash: p.txHash,
              kind: p.kind,
              title: p.title,
              subtitle: p.subtitle,
              pool: p.pool,
              symA: p.symA,
              symB: p.symB,
              user: p.user,
              chainId: p.chainId,
            });
            out.push({
              id: `bridge-completed:${p.txHash}`,
              kind: p.kind,
              status: "success",
              txHash: p.txHash,
              blockNumber: 0n,
              timestamp: Math.floor(p.submittedAt / 1000),
              title: p.title,
              subtitle: p.subtitle,
              pool: p.pool,
              symA: p.symA,
              symB: p.symB,
              logIndex: 0,
              chainId: p.chainId,
            });
            continue;
          }

          // Direct receipt verification for Arc-side tx.
          try {
            const receipt = await client.getTransactionReceipt({
              hash: p.txHash,
            });
            if (receipt.status === "success") {
              // Confirmed. Persist to the completed bucket so the entry
              // survives the next refresh even if the on-chain log walk
              // later fails (public RPC chunked getLogs throttles after
              // a burst of calls). Once the actual log is found, log
              // walking dedupes against `seenHashes` and the completed
              // entry is skipped — so we never end up with duplicates.
              recordCompletedTx({
                txHash: p.txHash,
                kind: p.kind,
                title: p.title,
                subtitle: p.subtitle,
                pool: p.pool,
                symA: p.symA,
                symB: p.symB,
                user: p.user,
                chainId: p.chainId,
                blockNumber: Number(receipt.blockNumber),
              });
              out.push({
                id: `confirmed-pending:${p.txHash}`,
                kind: p.kind,
                status: "success",
                txHash: p.txHash,
                blockNumber: receipt.blockNumber,
                timestamp: Math.floor(p.submittedAt / 1000),
                title: p.title,
                subtitle: p.subtitle,
                pool: p.pool,
                symA: p.symA,
                symB: p.symB,
                logIndex: 0,
                chainId: p.chainId,
              });
              continue;
            }
            if (receipt.status === "reverted") {
              // Reverted — also persist (user wants to see the failure
              // history) but with reverted status. We piggy-back on
              // recordCompletedTx so the "reverted" row survives across
              // refreshes the same way successful ones do.
              recordCompletedTx({
                txHash: p.txHash,
                kind: p.kind,
                title: p.title,
                subtitle: `${p.subtitle} (reverted)`,
                pool: p.pool,
                symA: p.symA,
                symB: p.symB,
                user: p.user,
                chainId: p.chainId,
                blockNumber: Number(receipt.blockNumber),
              });
              out.push({
                id: `reverted:${p.txHash}`,
                kind: p.kind,
                status: "reverted",
                txHash: p.txHash,
                blockNumber: receipt.blockNumber,
                timestamp: Math.floor(p.submittedAt / 1000),
                title: p.title,
                subtitle: p.subtitle,
                pool: p.pool,
                symA: p.symA,
                symB: p.symB,
                logIndex: 0,
                chainId: p.chainId,
              });
              continue;
            }
          } catch {
            // RPC didn't know about the tx yet — keep as pending.
          }

          // Truly still pending: keep the entry and emit a pending row.
          stillPending.push(p);
          out.push({
            id: `pending:${p.txHash}`,
            kind: p.kind,
            status: "pending",
            txHash: p.txHash,
            blockNumber: 0n,
            timestamp: Math.floor(p.submittedAt / 1000),
            title: p.title,
            subtitle: p.subtitle,
            pool: p.pool,
            symA: p.symA,
            symB: p.symB,
            logIndex: -1,
            chainId: p.chainId,
          });
        }

        // Persist the trimmed pending list.
        if (stillPending.length !== loadPending().length) {
          savePending(stillPending);
        }

        // ── 5. Merge in completed entries (off-chain tx like bridges) ─
        //
        // Completed entries are recorded by the UI once it knows the tx
        // is final and won't be picked up by the on-chain log walk
        // (e.g. CCTP bridges that finish on a different chain). Skip
        // entries that are too old or whose hash already appears in
        // either the on-chain logs or the receipt-verified pendings.
        const seenHashes = new Set([
          ...indexedHashes,
          ...out.map((r) => r.txHash.toLowerCase()),
        ]);
        const completed = loadCompleted().filter(
          (c) => c.user.toLowerCase() === userAddr,
        );
        const stillCompleted: CompletedTxEntry[] = [];
        for (const c of completed) {
          if (Date.now() - c.submittedAt >= COMPLETED_TTL_MS) continue;
          stillCompleted.push(c);
          if (seenHashes.has(c.txHash.toLowerCase())) continue;
          out.push({
            id: `completed:${c.txHash}`,
            kind: c.kind,
            status: "success",
            txHash: c.txHash,
            blockNumber: BigInt(c.blockNumber ?? 0),
            timestamp: Math.floor(c.submittedAt / 1000),
            title: c.title,
            subtitle: c.subtitle,
            pool: c.pool,
            symA: c.symA,
            symB: c.symB,
            logIndex: 0,
            chainId: c.chainId,
          });
        }
        if (stillCompleted.length !== loadCompleted().length) {
          saveCompleted(stillCompleted);
        }

        // Sort: pending first (timestamp from local clock), then newest-confirmed.
        out.sort((a, b) => {
          if (a.status === "pending" && b.status !== "pending") return -1;
          if (b.status === "pending" && a.status !== "pending") return 1;
          if (b.blockNumber !== a.blockNumber) {
            return Number(b.blockNumber - a.blockNumber);
          }
          return (b.logIndex ?? 0) - (a.logIndex ?? 0);
        });

        if (!cancelled) {
          setRecords(out);
          setError(null);
          setRefreshedAt(Date.now());
        }
      } catch (err: any) {
        console.error("[useTxHistory] fetch failed:", err);
        if (!cancelled) {
          setError(err?.message ?? "Failed to load history");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    const interval = setInterval(fetchAll, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [address, tick, refreshIntervalMs]);

  return { loading, records, error, refresh, refreshedAt };
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatAmount(raw: bigint, decimals: number): string {
  const human = parseFloat(formatUnits(raw, decimals));
  if (!Number.isFinite(human)) return "0";
  if (human === 0) return "0";
  if (human >= 1000) return human.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (human >= 1)    return human.toFixed(4);
  return human.toFixed(6);
}

export function shortHash(hash: string): string {
  if (!hash) return "";
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function formatRelativeTime(unixSec: number): string {
  if (!unixSec) return "—";
  const now = Math.floor(Date.now() / 1000);
  const delta = Math.max(0, now - unixSec);
  if (delta < 60)        return `${delta}s ago`;
  if (delta < 3600)      return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400)     return `${Math.floor(delta / 3600)}h ago`;
  if (delta < 86400 * 7) return `${Math.floor(delta / 86400)}d ago`;
  const date = new Date(unixSec * 1000);
  return date.toLocaleDateString();
}

// Per-chain explorer base URLs. Bridge tx are submitted on the source
// chain (e.g. Sepolia, Base Sepolia), so we can't always use ArcScan —
// the user would land on a "tx not found" page. Default to ArcScan for
// unknown / undefined chain IDs since most actions in this app are
// Arc-side.
const EXPLORER_BY_CHAIN: Record<number, string> = {
  5042002:    "https://testnet.arcscan.app",                      // Arc Testnet
  11155111:   "https://sepolia.etherscan.io",                     // Ethereum Sepolia
  421614:     "https://sepolia.arbiscan.io",                      // Arbitrum Sepolia
  84532:      "https://sepolia.basescan.org",                     // Base Sepolia
  11155420:   "https://sepolia-optimism.etherscan.io",            // OP Sepolia
  80002:      "https://amoy.polygonscan.com",                     // Polygon Amoy
  43113:      "https://testnet.snowtrace.io",                     // Avalanche Fuji
  59141:      "https://sepolia.lineascan.build",                  // Linea Sepolia
};

export function explorerTxUrl(hash: string, chainId?: number): string {
  const base = (chainId != null && EXPLORER_BY_CHAIN[chainId]) || EXPLORER_BY_CHAIN[5042002];
  return `${base}/tx/${hash}`;
}
