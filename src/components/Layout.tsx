import { Link, useLocation } from "@tanstack/react-router";
import { useWallet, shortAddress } from "@/hooks/useWallet";
import { type ReactNode, useState, useEffect } from "react";

const nav = [
  { to: "/", label: "Home" },
  { to: "/swap", label: "Swap" },
  { to: "/bridge", label: "Bridge" },
  { to: "/pool", label: "Pool" },
  { to: "/history", label: "Activity" },
];

export function WalletButton() {
  const [mounted, setMounted] = useState(false);
  const { address, connect, disconnect, isCorrectNetwork, switchToArc, isConnecting } = useWallet();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading state until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div className="h-[40px] w-[160px] animate-pulse rounded-full bg-card/50" />
    );
  }

  if (!address) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className="relative inline-flex items-center gap-2 rounded-full bg-gradient-mint px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-mint transition hover:scale-[1.02] disabled:opacity-50"
      >
        <span className="size-2 rounded-full bg-primary-foreground/80 animate-pulse" />
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }
  if (!isCorrectNetwork) {
    return (
      <button
        onClick={switchToArc}
        className="inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning"
      >
        Switch to Arc Testnet
      </button>
    );
  }
  return (
    <button
      onClick={disconnect}
      className="group inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 font-mono text-sm backdrop-blur transition hover:border-primary/40"
    >
      <span className="size-2 rounded-full bg-green-500" />
      {shortAddress(address)}
    </button>
  );
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <img src="/icons/zilarc.svg" alt="Zilarc" className="size-12 rounded-xl" />
      <div className="leading-none">
        <div className="font-display text-xl font-bold tracking-tight">
          <span className="text-gradient">Zil</span>arc
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Build on Arc Testnet
        </div>
      </div>
    </Link>
  );
}

function Header() {
  const loc = useLocation();
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/40 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4 w-full px-6 py-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = loc.pathname === n.to;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`relative rounded-full px-4 py-2 text-sm font-medium transition ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {active && <span className="absolute inset-0 rounded-full bg-primary/10 ring-1 ring-primary/30" />}
                  <span className="relative">{n.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-semibold text-success shadow-sm">
            <span className="size-2 rounded-full bg-success animate-pulse" />
            Arc Testnet
          </div>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 w-full border-t border-border/50 bg-background/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 md:grid-cols-4">
        {/* Brand column */}
        <div className="space-y-4">
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted-foreground">
            A decentralized exchange built on Arc Network. Swap, bridge, and provide liquidity without limits.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <a
              href="https://x.com/arc"
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-9 items-center justify-center rounded-xl border border-border bg-card/40 transition hover:border-primary/40 hover:bg-primary/10"
            >
              <svg className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.261 5.636 5.903-5.636zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a
              href="https://discord.gg/circle"
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-9 items-center justify-center rounded-xl border border-border bg-card/40 transition hover:border-primary/40 hover:bg-primary/10"
            >
              <svg className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.052a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
            <a
              href="https://github.com/dhozil/zilarc"
              target="_blank"
              rel="noopener noreferrer"
              className="flex size-9 items-center justify-center rounded-xl border border-border bg-card/40 transition hover:border-primary/40 hover:bg-primary/10"
            >
              <svg className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Protocol column */}
        <div className="bento-card p-5">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Protocol</h4>
          <ul className="mt-4 space-y-3">
            <li>
              <Link to="/swap" className="flex items-center gap-2 text-sm hover:text-primary transition">
                Swap <span className="text-[10px] text-muted-foreground">→</span>
              </Link>
            </li>
            <li>
              <Link to="/bridge" className="flex items-center gap-2 text-sm hover:text-primary transition">
                Bridge <span className="text-[10px] text-muted-foreground">→</span>
              </Link>
            </li>
            <li>
              <Link to="/pool" className="flex items-center gap-2 text-sm hover:text-primary transition">
                Pool <span className="text-[10px] text-muted-foreground">→</span>
              </Link>
            </li>
            <li>
              <Link to="/history" className="flex items-center gap-2 text-sm hover:text-primary transition">
                Activity <span className="text-[10px] text-muted-foreground">→</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Resources column */}
        <div className="bento-card p-5">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Resources</h4>
          <ul className="mt-4 space-y-3">
            <li>
              <a
                href="https://docs.arc.network"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover:text-primary transition"
              >
                Docs <span className="text-[10px] text-muted-foreground">↗</span>
              </a>
            </li>
            <li>
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover:text-primary transition"
              >
                Faucet <span className="text-[10px] text-muted-foreground">↗</span>
              </a>
            </li>
            <li>
              <a
                href="https://testnet.arcscan.app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm hover:text-primary transition"
              >
                Explorer <span className="text-[10px] text-muted-foreground">↗</span>
              </a>
            </li>
          </ul>
        </div>

        {/* Network column */}
        <div className="bento-card p-5">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground">Network</h4>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Chain ID</span>
              <span className="font-mono text-xs">5042002</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="flex items-center gap-1.5 text-green-500">
                <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Token</span>
              <span className="font-mono text-xs">USDC (CCTP)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-border/60 bg-card/40 px-3 py-1 font-medium">v0.1.0</span>
            <span>Testnet build — not for real-value transactions.</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Built on</span>
            <span className="font-display font-bold text-primary">Arc Network</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="glow-dot left-[-10%] top-20 size-[400px] bg-primary/40" />
      <div className="glow-dot right-[-5%] top-1/3 size-[500px] bg-accent/30" />
      <Header />
      <main className="relative mx-auto max-w-7xl px-6 py-10">{children}</main>
      <Footer />
    </div>
  );
}
