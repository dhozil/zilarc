"use client";

/**
 * RecentActivity — compact list of the user's last 5 swaps and LP actions.
 *
 * Designed to slot into the swap page sidebar (and reusable elsewhere) so
 * traders can see their recent fills without navigating away. Uses the
 * same `useTxHistory` source as the full /history page; the only
 * difference is the slice + the layout.
 *
 * When the user is disconnected, the component renders nothing so it
 * doesn't take up sidebar space on a wallet-less view.
 */

import { Link } from "@tanstack/react-router";
import { useAccount } from "wagmi";
import { TokenLogo, type TokenSym } from "@/components/ChainLogos";
import {
  useTxHistory,
  formatRelativeTime,
  shortHash,
  explorerTxUrl,
  type TxKind,
} from "@/hooks/useTxHistory";

const KIND_LABEL: Record<TxKind, string> = {
  swap:            "Swap",
  addLiquidity:    "Add LP",
  removeLiquidity: "Remove LP",
  bridge:          "Bridge",
};

const KIND_COLOR: Record<TxKind, string> = {
  swap:            "text-primary",
  addLiquidity:    "text-green-500",
  removeLiquidity: "text-orange-500",
  bridge:          "text-blue-400",
};

export function RecentActivity({ limit = 5 }: { limit?: number }) {
  const { address } = useAccount();
  const { records, loading } = useTxHistory(30_000);

  if (!address) return null;

  const rows = records.slice(0, limit);

  return (
    <div className="bento-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold">Recent activity</h3>
        <Link to="/history" className="text-xs font-semibold text-primary hover:underline">
          View all →
        </Link>
      </div>

      {loading && rows.length === 0 ? (
        <div className="mt-4 space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          No recent transactions. Your activity will show up here.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => {
            const symA = (r.symA ?? "USDC") as TokenSym;
            const symB = (r.symB ?? "Z")    as TokenSym;
            return (
              <li
                key={r.id}
                className="rounded-xl border border-border/50 bg-background/30 p-3 transition hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex shrink-0 -space-x-1.5">
                      <TokenLogo sym={symA} className="size-6 rounded-full ring-2 ring-card" />
                      <TokenLogo sym={symB} className="size-6 rounded-full ring-2 ring-card" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold ${KIND_COLOR[r.kind]}`}>
                          {KIND_LABEL[r.kind]}
                        </span>
                        {r.status === "pending" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-warning">
                            <span className="size-1 animate-pulse rounded-full bg-warning" />
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {r.subtitle}
                      </div>
                    </div>
                  </div>
                  <a
                    href={explorerTxUrl(r.txHash, r.chainId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 text-[10px] font-mono text-primary hover:underline"
                    title={r.txHash}
                  >
                    {shortHash(r.txHash)}
                  </a>
                </div>
                <div className="mt-1.5 text-[10px] text-muted-foreground">
                  {formatRelativeTime(r.timestamp)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
