import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useWallet } from "@/hooks/useWallet";
import { TokenLogo, type TokenSym } from "@/components/ChainLogos";
import { useArcUsdcBalance, useTokenBalance } from "@/hooks/useBalance";
import {
  useSwap,
  TOKEN_DECIMALS,
  isPairTradable,
  type TokenSym as ZilarcTokenSym,
} from "@/hooks/useSwap";
import { usePoolData } from "@/hooks/usePoolData";
import { ARC_TOKENS } from "@/lib/wagmi";
import { RecentActivity } from "@/components/RecentActivity";

export const Route = createFileRoute("/swap")({
  head: () => ({
    meta: [
      { title: "Swap — Zilarc" },
      {
        name: "description",
        content: "Swap USDC, EURC, Z, NEON and JETT tokens via the Zilarc AMM router on Arc Testnet.",
      },
    ],
  }),
  component: SwapPage,
});

// Tokens supported by the Zilarc AMM. Tradability is decided at runtime
// against the on-chain pool registry (`isPairTradable`) — a token may be
// listed here but disabled in the picker for a specific direction if no
// pool exists yet (e.g. EURC before EURC pools are seeded).
type SwapToken = ZilarcTokenSym;

const TOKENS: { sym: SwapToken; name: string; address: string }[] = [
  { sym: "USDC", name: "USD Coin (native gas)", address: ARC_TOKENS.USDC },
  { sym: "EURC", name: "Euro Coin",             address: ARC_TOKENS.EURC },
  { sym: "Z",    name: "Zilarc Token",          address: ARC_TOKENS.Z    },
  { sym: "NEON", name: "Neon Token",            address: ARC_TOKENS.NEON },
  { sym: "JETT", name: "Jett Token",            address: ARC_TOKENS.JETT },
];

function TokenSelect({
  value,
  onChange,
  exclude,
  pairWith,
}: {
  value: SwapToken;
  onChange: (v: SwapToken) => void;
  exclude?: SwapToken;
  pairWith?: SwapToken;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-2 font-semibold transition hover:border-primary/40"
      >
        <TokenLogo sym={value as TokenSym} className="size-6 rounded-full" />
        {value}
        <svg
          className="size-4 text-muted-foreground"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-popover shadow-card">
          <div className="max-h-72 overflow-y-auto py-1">
            {TOKENS.filter((t) => t.sym !== exclude).map((t) => {
              // A token is selectable iff a pool exists for `t` paired with
              // the other side of the swap (or it's the same as current
              // selection — re-selecting is fine).
              const tradable =
                pairWith === undefined || t.sym === value || isPairTradable(t.sym, pairWith);
              return (
                <button
                  key={t.sym}
                  onClick={() => {
                    if (!tradable) return;
                    onChange(t.sym);
                    setOpen(false);
                  }}
                  disabled={!tradable}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <TokenLogo sym={t.sym as TokenSym} className="size-8 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{t.sym}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.name}</div>
                  </div>
                  {!tradable && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                      no pool
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SwapPage() {
  const [mounted, setMounted] = useState(false);
  const { address, isCorrectNetwork, switchToArc } = useWallet();
  const {
    executeSwap,
    isSwapping,
    isApproving,
    error: swapError,
    getOutputAmount,
    routerEnabled,
  } = useSwap();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Balances. USDC is the native gas token; the rest are 18-dec ERC-20s.
  const { balance: usdcBalance, formattedBalance: usdcFormatted, loading: usdcLoading, refresh: refreshUsdc } =
    useArcUsdcBalance(address);
  const { balance: eurcBalance, loading: eurcLoading, refresh: refreshEurc } = useTokenBalance(
    address,
    ARC_TOKENS.EURC as `0x${string}`,
    TOKEN_DECIMALS.EURC,
  );
  const { balance: zBalance, loading: zLoading, refresh: refreshZ } = useTokenBalance(
    address,
    ARC_TOKENS.Z as `0x${string}`,
    TOKEN_DECIMALS.Z,
  );
  const { balance: neonBalance, loading: neonLoading, refresh: refreshNeon } = useTokenBalance(
    address,
    ARC_TOKENS.NEON as `0x${string}`,
    TOKEN_DECIMALS.NEON,
  );
  const { balance: jettBalance, loading: jettLoading, refresh: refreshJett } = useTokenBalance(
    address,
    ARC_TOKENS.JETT as `0x${string}`,
    TOKEN_DECIMALS.JETT,
  );

  const [from, setFrom] = useState<SwapToken>("USDC");
  const [to,   setTo]   = useState<SwapToken>("Z");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [swapSuccess, setSwapSuccess] = useState<string | null>(null);

  // Live quote from the router/pool. Recomputed whenever the user changes
  // amount or token selection.
  const [quote, setQuote] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!amount || parseFloat(amount) <= 0 || from === to || !isPairTradable(from, to)) {
      setQuote("");
      return;
    }
    setQuoteLoading(true);
    getOutputAmount(amount, from, to)
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch(() => {
        if (!cancelled) setQuote("");
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [amount, from, to, getOutputAmount]);

  const displayOutput = quote && parseFloat(quote) > 0 ? quote : "";

  // Implied price per 1 unit of `from`, derived from the live quote. Falls
  // back to "—" when no quote is available (e.g. zero amount, no pool).
  const impliedRate = useMemo(() => {
    const inAmt  = parseFloat(amount);
    const outAmt = parseFloat(displayOutput);
    if (!inAmt || !outAmt) return null;
    return outAmt / inAmt;
  }, [amount, displayOutput]);

  // Pool stats for selected pair
  const { data: poolData, loading: poolLoading } = usePoolData(from, to);

  // Slippage-protected minimum output
  const minReceived = useMemo(() => {
    const out = parseFloat(displayOutput);
    if (!out) return 0;
    const slip = Math.max(0, Math.min(50, parseFloat(slippage) || 0));
    return out * (1 - slip / 100);
  }, [displayOutput, slippage]);

  const fromBalance =
    from === "USDC" ? usdcBalance :
    from === "EURC" ? eurcBalance :
    from === "NEON" ? neonBalance :
    from === "JETT" ? jettBalance :
    zBalance;

  const fromFormatted =
    from === "USDC" ? usdcFormatted :
    `${parseFloat(fromBalance).toFixed(4)} ${from}`;

  const toBalance =
    to === "USDC" ? usdcBalance :
    to === "EURC" ? eurcBalance :
    to === "NEON" ? neonBalance :
    to === "JETT" ? jettBalance :
    zBalance;

  const toFormatted =
    to === "USDC" ? usdcFormatted :
    `${parseFloat(toBalance).toFixed(4)} ${to}`;

  const balanceLoading =
    (from === "USDC" && usdcLoading) ||
    (from === "EURC" && eurcLoading) ||
    (from === "Z"    && zLoading) ||
    (from === "NEON" && neonLoading) ||
    (from === "JETT" && jettLoading);

  const flip = () => {
    setFrom(to);
    setTo(from);
    setSubmitError(null);
    setSwapSuccess(null);
  };

  const refreshAllBalances = useCallback(() => {
    refreshUsdc();
    refreshEurc();
    refreshZ();
    refreshNeon();
    refreshJett();
  }, [refreshUsdc, refreshEurc, refreshZ, refreshNeon, refreshJett]);

  const handleSwap = useCallback(async () => {
    setSubmitError(null);
    setSwapSuccess(null);

    if (!address) return;
    if (!isCorrectNetwork) {
      switchToArc();
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setSubmitError("Enter an amount greater than 0");
      return;
    }
    if (from === to) {
      setSubmitError("Choose two different tokens");
      return;
    }
    if (!isPairTradable(from, to)) {
      setSubmitError(`No AMM pool exists for ${from}/${to}`);
      return;
    }
    if (parseFloat(amount) > parseFloat(fromBalance)) {
      setSubmitError(`Insufficient ${from} balance`);
      return;
    }

    const slippageBps = Math.round(Math.max(0, parseFloat(slippage) || 0) * 100);

    try {
      const { txHash, amountOut } = await executeSwap(amount, from, to, {
        slippageBps,
      });
      setSwapSuccess(
        `Swapped ${amount} ${from} → ${parseFloat(amountOut).toFixed(6)} ${to} · ${txHash.slice(0, 10)}…`,
      );
      setAmount("");
      refreshAllBalances();
    } catch (err: any) {
      setSubmitError(err?.message ?? "Swap failed");
    }
  }, [
    address,
    amount,
    from,
    to,
    fromBalance,
    isCorrectNetwork,
    switchToArc,
    slippage,
    executeSwap,
    refreshAllBalances,
  ]);

  const sameToken = from === to;
  const pairUntradable = from === to ? false : !isPairTradable(from, to);
  const buttonDisabled =
    !amount ||
    parseFloat(amount) <= 0 ||
    isSwapping ||
    isApproving ||
    sameToken ||
    pairUntradable;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Market panel */}
      <div className="space-y-6">
        <div className="bento-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <TokenLogo sym={from as TokenSym} className="size-10 rounded-full ring-2 ring-background" />
                <TokenLogo sym={to as TokenSym}   className="size-10 rounded-full ring-2 ring-background" />
              </div>
              <div>
                <div className="font-display text-xl font-bold">{from}/{to}</div>
                <div className="font-mono text-sm text-muted-foreground">
                  {impliedRate != null
                    ? `1 ${from} = ${impliedRate.toFixed(6)} ${to}`
                    : `Quote unavailable`}
                </div>
              </div>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                routerEnabled
                  ? "bg-primary/15 font-mono text-primary"
                  : "bg-warning/20 font-mono text-warning"
              }`}
            >
              {routerEnabled ? "Router · AMM" : "Pool · direct"}
            </span>
          </div>

          <div className="mt-6">
            <div className="relative h-48 w-full overflow-hidden rounded-xl border border-border/60 bg-background/40">
              <div className="absolute inset-0 grid grid-rows-4 gap-px">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="border-b border-border/20" />
                ))}
              </div>
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,100 L50,95 L100,90 L150,85 L200,90 L250,95 L300,90 L350,85 L400,90 L450,95 L500,90"
                  fill="url(#chartGradient)"
                  transform="translate(0, 30)"
                />
                <path
                  d="M0,100 L50,95 L100,90 L150,85 L200,90 L250,95 L300,90 L350,85 L400,90 L450,95 L500,90"
                  fill="none"
                  stroke="rgb(34, 197, 94)"
                  strokeWidth="2"
                  transform="translate(0, 30)"
                />
              </svg>

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">1 {from} ≈</span>
                  <span className="font-display text-lg font-bold text-green-500">
                    {impliedRate != null ? impliedRate.toFixed(4) : "—"} {to}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bento-card p-4">
            <div className="text-xs text-muted-foreground">Reserves {from === to ? "" : `(${from}/${to})`}</div>
            {poolLoading ? (
              <div className="mt-1 h-7 w-24 animate-pulse rounded bg-muted" />
            ) : poolData ? (
              <div className="mt-1 font-display text-base font-bold text-green-500">
                {poolData.reserveA} / {poolData.reserveB}
              </div>
            ) : (
              <div className="mt-1 font-display text-xl font-bold text-muted-foreground">—</div>
            )}
          </div>
          <div className="bento-card p-4">
            <div className="text-xs text-muted-foreground">Pool fee</div>
            <div className="mt-1 font-display text-xl font-bold">
              {poolData ? `${poolData.fee}%` : "0.30%"}
            </div>
          </div>
          <div className="bento-card p-4">
            <div className="text-xs text-muted-foreground">Implied price</div>
            <div className="mt-1 font-display text-xl font-bold text-green-500">
              {impliedRate != null ? impliedRate.toFixed(4) : "—"}
            </div>
          </div>
        </div>

        {/* Recent activity widget — only renders when wallet is connected */}
        <RecentActivity limit={5} />
      </div>

      {/* Swap card */}
      <div className="bento-card p-6 h-fit lg:sticky lg:top-24">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold">
            <img src="/icons/swap-icon.svg" alt="Swap" className="size-6" />
            Swap
          </h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Slippage</span>
            <div className="flex rounded-full border border-border bg-background/40 p-0.5">
              {["0.1", "0.5", "1.0"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className={`rounded-full px-2.5 py-1 font-mono text-xs transition ${
                    slippage === s ? "bg-primary/20 text-primary" : "text-muted-foreground"
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* From */}
        <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>You pay</span>
            <span>
              {balanceLoading ? (
                <span className="animate-pulse">Loading…</span>
              ) : (
                `Balance: ${fromFormatted}`
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent font-display text-3xl font-bold outline-none placeholder:text-muted-foreground/40"
            />
            <TokenSelect value={from} onChange={(v) => setFrom(v)} exclude={to} pairWith={to} />
          </div>
        </div>

        {/* Flip */}
        <div className="my-[-10px] flex justify-center">
          <button
            onClick={flip}
            className="relative z-10 grid size-9 place-items-center rounded-xl border border-border bg-card shadow-card transition hover:rotate-180 hover:border-primary"
          >
            <svg className="size-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l-3 3M17 20l3-3" />
            </svg>
          </button>
        </div>

        {/* To */}
        <div className="rounded-2xl border border-border bg-background/40 p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>You receive</span>
            <span>Balance: {toFormatted}</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              readOnly
              placeholder={quoteLoading ? "Quoting…" : "0.0"}
              value={displayOutput}
              className="w-full bg-transparent font-display text-3xl font-bold outline-none placeholder:text-muted-foreground/40"
            />
            <TokenSelect value={to} onChange={(v) => setTo(v)} exclude={from} pairWith={from} />
          </div>
        </div>

        {/* Details */}
        <div className="mt-4 space-y-1.5 rounded-xl bg-background/40 p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rate</span>
            <span className="font-mono">
              {impliedRate != null
                ? `1 ${from} = ${impliedRate.toFixed(6)} ${to}`
                : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Min received</span>
            <span className="font-mono">
              {minReceived > 0 ? `${minReceived.toFixed(6)} ${to}` : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slippage tolerance</span>
            <span className="font-mono text-primary">{slippage}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pool fee</span>
            <span className="font-mono">{poolData ? `${poolData.fee}%` : "0.30%"}</span>
          </div>
        </div>

        {(submitError || swapError) && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{submitError ?? swapError}</p>
          </div>
        )}

        {swapSuccess && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4" />
              </svg>
              Swap successful
            </div>
            <p className="mt-1 break-all text-xs text-muted-foreground">{swapSuccess}</p>
          </div>
        )}

        {!mounted ? (
          <button
            disabled
            className="mt-4 w-full rounded-2xl bg-gradient-mint py-4 font-display text-base font-bold text-primary-foreground opacity-50"
          >
            Loading…
          </button>
        ) : !address ? (
          <button
            disabled
            className="mt-4 w-full rounded-2xl border-2 border-border bg-background/40 py-4 font-display font-bold text-muted-foreground"
          >
            Connect wallet to swap
          </button>
        ) : !isCorrectNetwork ? (
          <button
            onClick={switchToArc}
            className="mt-4 w-full rounded-2xl border-2 border-warning bg-warning/10 py-4 font-display font-bold text-warning transition hover:bg-warning/20"
          >
            Switch to Arc Testnet
          </button>
        ) : (
          <button
            onClick={handleSwap}
            disabled={buttonDisabled}
            className="mt-4 w-full rounded-2xl bg-gradient-mint py-4 font-display text-base font-bold text-primary-foreground shadow-mint transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
          >
            {isApproving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Approving…
              </span>
            ) : isSwapping ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Swapping…
              </span>
            ) : sameToken ? (
              "Choose two different tokens"
            ) : pairUntradable ? (
              `${from}/${to} not supported`
            ) : !amount ? (
              "Enter an amount"
            ) : (
              `Swap ${from} → ${to}`
            )}
          </button>
        )}

        <p className="mt-3 text-center text-xs text-muted-foreground">
          {routerEnabled
            ? "ZilarcRouter · constant-product AMM · USDC native gas on Arc"
            : "Direct pool fallback · set VITE_ZILARC_ROUTER for single-call swaps"}
        </p>
      </div>
    </div>
  );
}
