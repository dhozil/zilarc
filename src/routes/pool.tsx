import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useWallet } from "@/hooks/useWallet";
import { TokenLogo, type TokenSym } from "@/components/ChainLogos";
import { TokenPicker } from "@/components/TokenPicker";
import {
  useAddLiquidity,
  isLiquidityPairSupported,
  type LiquidityToken,
} from "@/hooks/useAddLiquidity";
import { useDexStats, fmtUsd, fmtCount } from "@/hooks/useDexStats";

export const Route = createFileRoute("/pool")({
  head: () => ({
    meta: [
      { title: "Pools — Zilarc" },
      { name: "description", content: "Provide liquidity and earn yield from trading fees on Arc Network." },
    ],
  }),
  component: PoolPage,
});

// Tokens supported by the AMM. Listed regardless of whether every pair
// exists — the picker dynamically disables the pairs without a pool.
const AVAILABLE_TOKENS: { sym: LiquidityToken; name: string }[] = [
  { sym: "USDC", name: "USD Coin (native)" },
  { sym: "EURC", name: "Euro Coin" },
  { sym: "Z",    name: "Zilarc Token" },
  { sym: "NEON", name: "Neon Token" },
  { sym: "JETT", name: "Jett Token" },
];

function PoolPage() {
  const { address, connect, isCorrectNetwork, switchToArc } = useWallet();
  const { isApproving, isAddingLiquidity, error, addLiquidity } = useAddLiquidity();
  const stats = useDexStats(30_000);

  const [tab, setTab] = useState<"all" | "my">("all");
  const [showAdd, setShowAdd] = useState(false);

  // Selected token symbols
  const [tokenASym, setTokenASym] = useState<LiquidityToken>("USDC");
  const [tokenBSym, setTokenBSym] = useState<LiquidityToken>("Z");

  // Amount inputs
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pair guard: keep tokenA != tokenB AND ensure the pair has a deployed
  // pool. If the user picks a pair without a pool, snap to the first valid
  // partner for tokenA so the UI never shows a "no pool" dead-end form.
  useEffect(() => {
    if (tokenASym === tokenBSym || !isLiquidityPairSupported(tokenASym, tokenBSym)) {
      const partner = AVAILABLE_TOKENS.find(
        (t) => t.sym !== tokenASym && isLiquidityPairSupported(tokenASym, t.sym),
      );
      if (partner) setTokenBSym(partner.sym);
    }
  }, [tokenASym, tokenBSym]);

  const pairSupported = useMemo(
    () => isLiquidityPairSupported(tokenASym, tokenBSym),
    [tokenASym, tokenBSym],
  );

  const handleSupply = useCallback(async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!pairSupported) {
      setErrorMsg(`No pool exists for ${tokenASym}/${tokenBSym}`);
      return;
    }
    if (!amountA || !amountB) {
      setErrorMsg("Enter amounts for both tokens");
      return;
    }
    if (parseFloat(amountA) <= 0 || parseFloat(amountB) <= 0) {
      setErrorMsg("Amounts must be greater than 0");
      return;
    }

    try {
      const txHash = await addLiquidity(amountA, amountB, tokenASym, tokenBSym);
      setSuccessMsg(
        `Supplied ${amountA} ${tokenASym} + ${amountB} ${tokenBSym} · ${String(txHash).slice(0, 10)}…`,
      );
      setAmountA("");
      setAmountB("");
    } catch (err: any) {
      setErrorMsg(err?.message || "Transaction failed");
    }
  }, [pairSupported, amountA, amountB, tokenASym, tokenBSym, addLiquidity]);

  const buttonLabel = isAddingLiquidity
    ? "Supplying..."
    : isApproving
    ? "Approving..."
    : !address
    ? "Connect Wallet"
    : !isCorrectNetwork
    ? "Switch to Arc"
    : !pairSupported
    ? `${tokenASym}/${tokenBSym} not supported`
    : !amountA || !amountB
    ? "Enter Amounts"
    : "Supply Liquidity";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-bold md:text-5xl">
            Liquidity <span className="text-gradient">Pools</span>
          </h1>
          <p className="mt-2 text-muted-foreground">Earn yield by providing liquidity for traders</p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-mint px-5 py-2.5 font-semibold text-primary-foreground shadow-mint"
        >
          + Add Liquidity
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {(() => {
          const fees24h = stats.pools.reduce(
            (acc, p) => acc + p.volume24hUSD * (p.feeBps / 10000),
            0,
          );
          const topApy = stats.pools.reduce((max, p) => {
            if (p.tvlUSD <= 0) return max;
            const dailyFee = p.volume24hUSD * (p.feeBps / 10000);
            const apy = (dailyFee * 365 * 100) / p.tvlUSD;
            return Math.max(max, apy);
          }, 0);
          const items = [
            { l: "Total TVL",  v: stats.loading ? null : fmtUsd(stats.totalTvlUSD) },
            { l: "24h Fees",   v: stats.loading ? null : fmtUsd(fees24h) },
            { l: "Active LPs", v: stats.loading ? null : `${stats.activePairs}` },
            { l: "Top APY",    v: stats.loading ? null : (topApy > 0 ? `${topApy.toFixed(2)}%` : "—"), g: true },
          ];
          return items.map((s) => (
            <div key={s.l} className="bento-card p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.l}</div>
              {s.v === null ? (
                <div className="mt-2 h-7 w-20 animate-pulse rounded bg-muted" />
              ) : (
                <div className={`mt-2 font-display text-2xl font-bold ${s.g ? "text-gradient" : ""}`}>{s.v}</div>
              )}
            </div>
          ));
        })()}
      </div>

      {/* Add Liquidity Panel */}
      {showAdd && (
        <div className="bento-card p-6">
          <h3 className="font-display text-xl font-bold">Add Liquidity</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {/* Token A */}
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="mb-3 text-xs text-muted-foreground">Token A</div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  placeholder="0.0"
                  value={amountA}
                  onChange={(e) => setAmountA(e.target.value)}
                  className="w-full bg-transparent font-display text-2xl font-bold outline-none placeholder:text-muted-foreground/40"
                />
                <TokenPicker
                  value={tokenASym}
                  options={AVAILABLE_TOKENS}
                  onChange={(v) => setTokenASym(v as LiquidityToken)}
                  exclude={tokenBSym}
                  isOptionEnabled={(sym) => isLiquidityPairSupported(sym as LiquidityToken, tokenBSym)}
                />
              </div>
            </div>

            {/* Token B */}
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="mb-3 text-xs text-muted-foreground">Token B</div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  placeholder="0.0"
                  value={amountB}
                  onChange={(e) => setAmountB(e.target.value)}
                  className="w-full bg-transparent font-display text-2xl font-bold outline-none placeholder:text-muted-foreground/40"
                />
                <TokenPicker
                  value={tokenBSym}
                  options={AVAILABLE_TOKENS}
                  onChange={(v) => setTokenBSym(v as LiquidityToken)}
                  exclude={tokenASym}
                  isOptionEnabled={(sym) => isLiquidityPairSupported(tokenASym, sym as LiquidityToken)}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            {[{ l: "Share of Pool", v: "—" }, { l: "Est. APY", v: "—" }, { l: "Fee Tier", v: "0.30%" }].map((x) => (
              <div key={x.l} className="rounded-xl bg-background/40 p-3">
                <div className="text-xs text-muted-foreground">{x.l}</div>
                <div className="font-mono font-semibold">{x.v}</div>
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-semibold text-primary">{successMsg}</p>
            </div>
          )}

          {isApproving && (
            <div className="mt-3 text-center text-sm text-muted-foreground">
              Processing token approvals...
            </div>
          )}

          {isAddingLiquidity && (
            <div className="mt-3 text-center text-sm text-muted-foreground">
              Confirm the transaction in your wallet...
            </div>
          )}

          <button
            onClick={
              !address
                ? connect
                : !isCorrectNetwork
                ? switchToArc
                : handleSupply
            }
            disabled={isApproving || isAddingLiquidity}
            className="mt-4 w-full rounded-2xl bg-gradient-mint py-3.5 font-display font-bold text-primary-foreground shadow-mint transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
          >
            {buttonLabel}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex w-fit rounded-full border border-border bg-card/40 p-1">
        {(["all", "my"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition ${tab === t ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}
          >
            {t === "all" ? "All Pools" : "My Positions"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bento-card overflow-hidden">
        <div className="grid grid-cols-12 gap-4 border-b border-border/50 px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Pool</div>
          <div className="col-span-2">TVL</div>
          <div className="col-span-2">24h Volume</div>
          <div className="col-span-1">Fee</div>
          <div className="col-span-2">APY</div>
          <div className="col-span-1"></div>
        </div>
        {tab === "all" ? (
          stats.loading ? (
            <div className="space-y-2 p-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : stats.pools.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10">
                <svg className="size-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h18M3 12h18M3 17h18"/></svg>
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">No pools yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Be the first to seed a pool on Arc Testnet.</p>
              <button onClick={() => setShowAdd(true)} className="mt-4 rounded-full bg-gradient-mint px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-mint">
                Add Liquidity
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {stats.pools.map((p) => {
                const a = p.symA as TokenSym;
                const b = p.symB as TokenSym;
                const dailyFee = p.volume24hUSD * (p.feeBps / 10000);
                const apy = p.tvlUSD > 0 ? (dailyFee * 365 * 100) / p.tvlUSD : 0;
                return (
                  <div key={p.pool} className="grid grid-cols-12 items-center gap-4 px-6 py-4 transition hover:bg-primary/5">
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
                    <div className="col-span-2 font-mono">{fmtUsd(p.tvlUSD)}</div>
                    <div className="col-span-2 font-mono text-sm">{fmtUsd(p.volume24hUSD)}</div>
                    <div className="col-span-1 font-mono text-sm text-muted-foreground">
                      {(p.feeBps / 100).toFixed(2)}%
                    </div>
                    <div className="col-span-2 font-mono font-bold text-green-500">
                      {apy > 0 ? `${apy.toFixed(2)}%` : "—"}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        onClick={() => {
                          setTokenASym(p.symA as LiquidityToken);
                          setTokenBSym(p.symB as LiquidityToken);
                          setShowAdd(true);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="px-6 py-20 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10">
              <svg className="size-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <h3 className="mt-4 font-display text-lg font-bold">No positions yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">Add liquidity to start earning yield from trading fees.</p>
            <button onClick={() => setShowAdd(true)} className="mt-4 rounded-full bg-gradient-mint px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-mint">
              Add Liquidity
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
