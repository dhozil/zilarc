import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useWallet } from "@/hooks/useWallet";
import { TokenLogo, type TokenSym } from "@/components/ChainLogos";
import {
  useTxHistory,
  shortHash,
  formatRelativeTime,
  explorerTxUrl,
  type TxKind,
  type TxRecord,
} from "@/hooks/useTxHistory";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Activity — Zilarc" },
      {
        name: "description",
        content: "Your swap and liquidity activity on Zilarc, sourced directly from Arc Testnet logs.",
      },
    ],
  }),
  component: HistoryPage,
});

const FILTERS: Array<{ key: TxKind | "all"; label: string }> = [
  { key: "all",             label: "All" },
  { key: "swap",            label: "Swaps" },
  { key: "addLiquidity",    label: "Add LP" },
  { key: "removeLiquidity", label: "Remove LP" },
  { key: "bridge",          label: "Bridge" },
];

const PAGE_SIZE = 20;

function KindBadge({ kind, status }: { kind: TxKind; status: TxRecord["status"] }) {
  const palette: Record<TxKind, string> = {
    swap:            "bg-primary/15 text-primary",
    addLiquidity:    "bg-green-500/15 text-green-500",
    removeLiquidity: "bg-orange-500/15 text-orange-500",
    bridge:          "bg-blue-500/15 text-blue-400",
  };
  const label: Record<TxKind, string> = {
    swap:            "Swap",
    addLiquidity:    "Add LP",
    removeLiquidity: "Remove LP",
    bridge:          "Bridge",
  };
  return (
    <div className="flex items-center gap-2">
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${palette[kind]}`}>
        {label[kind]}
      </span>
      {status === "pending" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning">
          <span className="size-1.5 animate-pulse rounded-full bg-warning" />
          Pending
        </span>
      )}
      {status === "reverted" && (
        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">
          Reverted
        </span>
      )}
    </div>
  );
}

function HistoryPage() {
  const { address, connect } = useWallet();
  const { loading, records, error, refresh, refreshedAt } = useTxHistory(30_000);

  const [filter, setFilter] = useState<TxKind | "all">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (filter === "all") return records;
    return records.filter((r) => r.kind === filter);
  }, [records, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage  = Math.min(page, pageCount);
  const pageRows  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const counts = useMemo(() => ({
    all:             records.length,
    swap:            records.filter((r) => r.kind === "swap").length,
    addLiquidity:    records.filter((r) => r.kind === "addLiquidity").length,
    removeLiquidity: records.filter((r) => r.kind === "removeLiquidity").length,
    bridge:          records.filter((r) => r.kind === "bridge").length,
  }), [records]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold md:text-5xl">
            <span className="text-gradient">Activity</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Swap and liquidity history for the connected wallet, sourced from Arc Testnet logs.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {refreshedAt > 0 && (
            <span>Updated {formatRelativeTime(Math.floor(refreshedAt / 1000))}</span>
          )}
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count = counts[f.key as keyof typeof counts] ?? 0;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card/60 text-muted-foreground hover:border-primary/40"
              }`}
            >
              {f.label}
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-primary/20" : "bg-muted"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div className="bento-card overflow-hidden">
        {!address ? (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10">
              <svg className="size-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 11c2.5 0 4.5-2 4.5-4.5S14.5 2 12 2 7.5 4 7.5 6.5 9.5 11 12 11Z" />
                <path d="M5 22a7 7 0 0114 0" />
              </svg>
            </div>
            <h3 className="mt-4 font-display text-lg font-bold">Connect your wallet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to see your swap and liquidity history.</p>
            <button
              onClick={connect}
              className="mt-4 rounded-full bg-gradient-mint px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-mint"
            >
              Connect Wallet
            </button>
          </div>
        ) : loading && records.length === 0 ? (
          <div className="space-y-2 p-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : error ? (
          <div className="px-6 py-20 text-center">
            <h3 className="font-display text-lg font-bold text-destructive">Couldn't load activity</h3>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <button
              onClick={refresh}
              className="mt-4 rounded-full bg-gradient-mint px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-mint"
            >
              Retry
            </button>
          </div>
        ) : pageRows.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10">
              <svg className="size-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7h18M3 12h18M3 17h18" />
              </svg>
            </div>
            <h3 className="mt-4 font-display text-lg font-bold">
              {filter === "all" ? "No activity yet" : "No matching activity"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter === "all"
                ? "Once you swap or provide liquidity, your history will appear here."
                : "Try a different filter, or come back after your next transaction."}
            </p>
            <Link
              to="/swap"
              className="mt-4 inline-block rounded-full bg-gradient-mint px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-mint"
            >
              Open Swap
            </Link>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-12 gap-4 border-b border-border/50 px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground md:grid">
              <div className="col-span-3">Type</div>
              <div className="col-span-5">Details</div>
              <div className="col-span-2">When</div>
              <div className="col-span-2 text-right">Tx</div>
            </div>
            <div className="divide-y divide-border/40">
              {pageRows.map((r) => {
                const symA = (r.symA ?? "USDC") as TokenSym;
                const symB = (r.symB ?? "Z")    as TokenSym;
                return (
                  <div
                    key={r.id}
                    className="grid grid-cols-1 gap-3 px-6 py-4 transition hover:bg-primary/5 md:grid-cols-12 md:items-center md:gap-4"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <TokenLogo sym={symA} className="size-8 rounded-full ring-2 ring-card" />
                        <TokenLogo sym={symB} className="size-8 rounded-full ring-2 ring-card" />
                      </div>
                      <div className="min-w-0">
                        <KindBadge kind={r.kind} status={r.status} />
                        <div className="mt-0.5 truncate text-sm font-semibold">{r.title}</div>
                      </div>
                    </div>
                    <div className="col-span-5 truncate text-sm text-muted-foreground">
                      {r.subtitle}
                    </div>
                    <div className="col-span-2 text-xs text-muted-foreground">
                      {formatRelativeTime(r.timestamp)}
                    </div>
                    <div className="col-span-2 text-right">
                      <a
                        href={explorerTxUrl(r.txHash, r.chainId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                      >
                        {shortHash(r.txHash)}
                        <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M7 17L17 7M17 7H8M17 7v9" />
                        </svg>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-border/40 px-6 py-3 text-xs">
                <span className="text-muted-foreground">
                  Page {safePage} of {pageCount} · {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-full border border-border bg-card/60 px-3 py-1 font-semibold transition hover:border-primary/40 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={safePage >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    className="rounded-full border border-border bg-card/60 px-3 py-1 font-semibold transition hover:border-primary/40 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
