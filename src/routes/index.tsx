import { createFileRoute, Link } from "@tanstack/react-router";
import { ChainLogo } from "@/components/ChainLogos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zilarc — Swap, Bridge & Pool on Arc Testnet" },
      { name: "description", content: "A modern DEX built on Arc Network testnet. Swap tokens, bridge across chains, and provide liquidity with an elegant bento-grid UI." },
    ],
  }),
  component: Index,
});

const stats = [
  { label: "Total Volume", value: "—" },
  { label: "TVL", value: "—" },
  { label: "24h Trades", value: "—" },
  { label: "Active Pairs", value: "—" },
];


function Index() {
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
        {stats.map((s) => (
          <div key={s.label} className="bento-card p-6">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="mt-2 font-display text-3xl font-bold text-gradient">{s.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">No data yet</div>
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
                <div className="mt-1 font-mono text-sm">USDC · EURC · cirBTC</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="text-xs text-muted-foreground">Network</div>
                <div className="mt-1 font-mono text-sm">Arc Testnet</div>
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
            <div className="mt-3 font-display text-4xl font-bold text-gradient">—</div>
            <div className="text-xs text-muted-foreground">Pools coming soon</div>
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
        <div className="px-6 py-16 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10">
            <svg className="size-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18M7 14l4-4 4 4 6-6" />
            </svg>
          </div>
          <h4 className="mt-4 font-display text-lg font-bold">No market data yet</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Live pairs and prices will appear here once trading goes live on Arc Testnet.
          </p>
        </div>
      </section>
    </div>
  );
}

