import { createFileRoute, Link } from "@tanstack/react-router";
import { ChainLogo } from "@/components/ChainLogos";
import { TokenLogo, type TokenSym } from "@/components/ChainLogos";
import { useDexStats, fmtUsd, fmtCount } from "@/hooks/useDexStats";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zilarc — Swap, Bridge & Pool on Arc Testnet" },
      { name: "description", content: "A modern DEX built on Arc Network testnet. Swap tokens, bridge across chains, and provide liquidity with an elegant bento-grid UI." },
    ],
  }),
  component: Index,
});

function Index() {
  const stats = useDexStats(30_000);

  const headlineStats = [
    {
      label: "Total Volume",
      value: stats.loading ? null : fmtUsd(stats.totalVolume24hUSD),
      sub: stats.loading ? "Loading…" : "24h trading volume",
    },
    {
      label: "TVL",
      value: stats.loading ? null : fmtUsd(stats.totalTvlUSD),
      sub: stats.loading ? "Loading…" : "Across all AMM pools",
    },
    {
      label: "24h Trades",
      value: stats.loading ? null : fmtCount(stats.totalTrades24h),
      sub: stats.loading ? "Loading…" : "Swaps in last 24h",
    },
    {
      label: "Active Pairs",
      value: stats.loading ? null : `${stats.activePairs}`,
      sub: stats.loading ? "Loading…" : `${stats.pools.length} total deployed`,
    },
  ];

  const topMarkets = stats.pools.slice(0, 5);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="relative grid-bg overflow-hidden rounded-3xl border border-border/50 bg-card/30 px-8 py-16 backdrop-blur-sm md:px-14 md:py-20">
        <div className="relative z-10 max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
            Live on Arc Network Testnet
          </div>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            Trade without limits on <span className="text-gradient">Arc Network</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Swap, bridge, and provide liquidity with low fees and instant execution. Built for testnet pioneers.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/swap" className="inline-flex items-center gap-2 rounded-full bg-gradient-mint px-6 py-3 font-semibold text-primary-foreground shadow-mint transition hover:scale-[1.02]">
              Start Swapping →
            </Link>
            <Link to="/pool" className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-6 py-3 font-semibold backdrop-blur transition hover:border-primary/40">
              Explore Pools
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {headlineStats.map((s) => (
          <div key={s.label} className="bento-card p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            {s.value === null ? (
              <div className="mt-2 h-9 w-24 animate-pulse rounded bg-muted" />
            ) : (
              <div className="mt-2 font-display text-3xl font-bold text-gradient">{s.value}</div>
            )}
            <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>
          </div>
        ))}
      </section>

      {/* Bento grid features */}
      <section className="grid gap-4 md:grid-cols-6 md:grid-rows-2">
        <Link to="/swap" className="bento-card md:col-span-3 md:row-span-2 group">
          <div className="flex h-full flex-col justify-between p-8">
            <div>
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-mint shadow-glow">
                <svg className="size-6 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l-3 3M17 20l3-3" />
                </svg>
              </div>
              <h3 className="mt-6 font-display text-3xl font-bold">Instant Swap</h3>
              <p className="mt-3 max-w-md text-muted-foreground">
                Swap hundreds of tokens on Arc with minimal slippage. Smart routing picks the best path automatically.
              </p>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">Supported tokens</div>
                <div className="mt-1 font-mono text-sm">USDC · EURC · Z · NEON · JETT</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">Active pairs</div>
                <div className="mt-1 font-mono text-sm">
                  {stats.loading ? "—" : `${stats.activePairs} live`}
                </div>
              </div>
            </div>

            <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
              Open Swap →
            </div>
          </div>
        </Link>

        <Link to="/bridge" className="bento-card md:col-span-3">
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Cross-chain</div>
                <h3 className="mt-2 font-display text-2xl font-bold">Bridge Assets</h3>
              </div>
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 12h16M14 6l6 6-6 6" />
                </svg>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Move assets between Ethereum, Arbitrum, and Arc in minutes.</p>
            <div className="mt-4 flex items-center gap-2">
              {(["arc","eth","arb","base","op","avax","polygon","linea"] as const).map((c) => (
                <div key={c} className="grid size-8 place-items-center rounded-full border border-border/60 bg-background/40">
                  <ChainLogo id={c} className="size-5" />
                </div>
              ))}
            </div>
          </div>
        </Link>

        <Link to="/pool" className="bento-card md:col-span-2">
          <div className="p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Earn</div>
            <h3 className="mt-2 font-display text-2xl font-bold">Liquidity Pools</h3>
            <div className="mt-3 font-display text-4xl font-bold text-gradient">
              {stats.loading ? "—" : fmtUsd(stats.totalTvlUSD)}
            </div>
            <div className="text-xs text-muted-foreground">
              {stats.loading
                ? "Loading…"
                : `${stats.activePairs} pool${stats.activePairs === 1 ? "" : "s"} earning fees`}
            </div>
          </div>
        </Link>


        <div className="bento-card md:col-span-1 relative">
          <div className="absolute inset-0 shimmer rounded-[inherit]" />
          <div className="relative p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Faucet</div>
            <p className="mt-2 text-sm">Claim free testnet ARC</p>
            <div className="mt-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Available</div>
          </div>
        </div>
      </section>

      {/* Market table */}
      <section className="bento-card">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <h3 className="font-display text-lg font-bold">Top Markets</h3>
          <Link to="/swap" className="text-sm text-primary hover:underline">Open swap →</Link>
        </div>
        {stats.loading ? (
          <div className="space-y-2 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : topMarkets.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10">
              <svg className="size-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3v18h18M7 14l4-4 4 4 6-6" />
              </svg>
            </div>
            <h4 className="mt-4 font-display text-lg font-bold">No active markets</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              All pools are empty. Add liquidity to bring a market live.
            </p>
          </div>
        ) : (
          <div>
            <div className="grid grid-cols-12 gap-4 border-b border-border/30 px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">
              <div className="col-span-4">Pair</div>
              <div className="col-span-3 text-right">TVL</div>
              <div className="col-span-3 text-right">24h Volume</div>
              <div className="col-span-2 text-right">Trades</div>
            </div>
            <div className="divide-y divide-border/30">
              {topMarkets.map((p) => {
                const a = p.symA as TokenSym;
                const b = p.symB as TokenSym;
                return (
                  <Link
                    key={p.pool}
                    to="/swap"
                    className="grid grid-cols-12 items-center gap-4 px-6 py-4 transition hover:bg-primary/5"
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="flex -space-x-2">
                        <TokenLogo sym={a} className="size-9 rounded-full ring-2 ring-card" />
                        <TokenLogo sym={b} className="size-9 rounded-full ring-2 ring-card" />
                      </div>
                      <div>
                        <div className="font-semibold">{p.pair}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.reserveA.toFixed(2)} {p.symA} · {p.reserveB.toFixed(2)} {p.symB}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3 text-right font-mono">{fmtUsd(p.tvlUSD)}</div>
                    <div className="col-span-3 text-right font-mono">{fmtUsd(p.volume24hUSD)}</div>
                    <div className="col-span-2 text-right font-mono text-muted-foreground">
                      {fmtCount(p.trades24h)}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

