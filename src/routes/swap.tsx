import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { TokenLogo, type TokenSym } from "@/components/ChainLogos";
import { useArcUsdcBalance, useTokenBalance } from "@/hooks/useBalance";
import { useSwap } from "@/hooks/useSwap";
import { usePoolData } from "@/hooks/usePoolData";
import { ARC_TOKENS } from "@/lib/wagmi";
import { parseUnits } from "viem";

export const Route = createFileRoute("/swap")({
  head: () => ({
    meta: [
      { title: "Swap — Zilarc" },
      { name: "description", content: "Swap USDC, EURC and other tokens on Arc Network testnet." },
    ],
  }),
  component: SwapPage,
});

// Arc Testnet supported tokens
const TOKENS: { sym: TokenSym; name: string; address: string }[] = [
  { sym: "USDC", name: "USD Coin (native gas)", address: ARC_TOKENS.USDC },
  { sym: "EURC", name: "Euro Coin", address: ARC_TOKENS.EURC },
  { sym: "Z", name: "Zilarc Token", address: ARC_TOKENS.Z },
  { sym: "NEON", name: "Neon Token", address: ARC_TOKENS.NEON },
  { sym: "JETT", name: "Jett Token", address: ARC_TOKENS.JETT },
];

// Exchange rates (1 USDC = 1 Z, 1 NEON, 1 JETT)
const EXCHANGE_RATES: Record<string, string> = {
  "USDC->EURC": "0.92",
  "EURC->USDC": "1.09",
  "USDC->Z": "1.00",
  "Z->USDC": "1.00",
  "EURC->Z": "0.92",
  "Z->EURC": "1.09",
  "USDC->NEON": "1.00",
  "NEON->USDC": "1.00",
  "USDC->JETT": "1.00",
  "JETT->USDC": "1.00",
  "Z->NEON": "1.00",
  "NEON->Z": "1.00",
  "Z->JETT": "1.00",
  "JETT->Z": "1.00",
  "NEON->JETT": "1.00",
  "JETT->NEON": "1.00",
  "Z->Z": "1.00",
  "USDC->USDC": "1.00",
  "EURC->EURC": "1.00",
  "NEON->NEON": "1.00",
  "JETT->JETT": "1.00",
};

function TokenPill({ sym, onClick }: { sym: TokenSym; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-2 font-semibold transition hover:border-primary/40"
    >
      <TokenLogo sym={sym} className="size-6 rounded-full" />
      {sym}
      <svg className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

function TokenSelect({
  value,
  onChange,
  exclude,
}: {
  value: TokenSym;
  onChange: (v: TokenSym) => void;
  exclude?: TokenSym;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <TokenPill sym={value} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-popover shadow-card">
          {TOKENS.filter((t) => t.sym !== exclude).map((t) => (
            <button
              key={t.sym}
              onClick={() => {
                onChange(t.sym);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-primary/10"
            >
              <TokenLogo sym={t.sym} className="size-8 rounded-full" />
              <div>
                <div className="font-semibold">{t.sym}</div>
                <div className="text-xs text-muted-foreground">{t.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SwapPage() {
  const [mounted, setMounted] = useState(false);
  const { address, connect, isCorrectNetwork, switchToArc } = useWallet();
  const { executeSwap, isSwapping: isSwapPending, isApproving, error: swapContractError, getOutputAmount } = useSwap();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get USDC balance using BentoSwap pattern
  const { balance: usdcBalance, formattedBalance: usdcFormatted, loading: usdcLoading } = useArcUsdcBalance(address);

  // Get EURC balance
  const { balance: eurcBalance, loading: eurcLoading } = useTokenBalance(
    address,
    ARC_TOKENS.EURC as `0x${string}`,
    6
  );

  // Get Z token balance
  const { balance: zBalance, loading: zLoading } = useTokenBalance(
    address,
    ARC_TOKENS.Z as `0x${string}`,
    18
  );

  // Get NEON balance
  const { balance: neonBalance, loading: neonLoading } = useTokenBalance(
    address,
    ARC_TOKENS.NEON as `0x${string}`,
    18
  );

  // Get JETT balance
  const { balance: jettBalance, loading: jettLoading } = useTokenBalance(
    address,
    ARC_TOKENS.JETT as `0x${string}`,
    18
  );

  const [from, setFrom] = useState<TokenSym>("USDC");
  const [to, setTo] = useState<TokenSym>("NEON");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSuccess, setSwapSuccess] = useState<string | null>(null);

  // Calculate output based on exchange rate
  const rate = EXCHANGE_RATES[`${from}->${to}`] || "1.00";
  const outputAmount = amount ? (parseFloat(amount) * parseFloat(rate)).toFixed(6) : "";

  // Live output amount from on-chain contract
  const [liveOutputAmount, setLiveOutputAmount] = useState("");

  useEffect(() => {
    if (!amount || parseFloat(amount) === 0) {
      setLiveOutputAmount("");
      return;
    }
    getOutputAmount(amount, from, to).then(setLiveOutputAmount).catch(() => {});
  }, [amount, from, to, getOutputAmount]);

  const displayOutput = liveOutputAmount || outputAmount;

  // Pool data for selected pair
  const { data: poolData, loading: poolLoading } = usePoolData(from, to);

  // Get current balance based on selected token
  const fromBalance =
    from === "USDC" ? usdcBalance :
    from === "EURC" ? eurcBalance :
    from === "NEON" ? neonBalance :
    from === "JETT" ? jettBalance :
    zBalance;

  const fromFormatted =
    from === "USDC" ? usdcFormatted :
    from === "EURC" ? `${parseFloat(eurcBalance).toFixed(4)} EURC` :
    from === "NEON" ? `${parseFloat(neonBalance).toFixed(4)} NEON` :
    from === "JETT" ? `${parseFloat(jettBalance).toFixed(4)} JETT` :
    `${parseFloat(zBalance).toFixed(4)} Z`;

  // Get destination token balance
  const toBalance =
    to === "USDC" ? usdcBalance :
    to === "EURC" ? eurcBalance :
    to === "NEON" ? neonBalance :
    to === "JETT" ? jettBalance :
    zBalance;

  const toFormatted =
    to === "USDC" ? usdcFormatted :
    to === "EURC" ? `${parseFloat(eurcBalance).toFixed(4)} EURC` :
    to === "NEON" ? `${parseFloat(neonBalance).toFixed(4)} NEON` :
    to === "JETT" ? `${parseFloat(jettBalance).toFixed(4)} JETT` :
    `${parseFloat(zBalance).toFixed(4)} Z`;

  const flip = () => {
    setFrom(to);
    setTo(from);
  };

  const handleSwap = useCallback(async () => {
    if (!address || !amount) return;
    if (!isCorrectNetwork) {
      switchToArc();
      return;
    }

    await executeSwap(amount, from, to);

    setSwapSuccess(`Successfully swapped ${amount} ${from} for ${displayOutput} ${to}!`);
    setAmount("");
  }, [address, amount, isCorrectNetwork, from, to, displayOutput, switchToArc, executeSwap]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      {/* Market panel */}
      <div className="space-y-6">
        <div className="bento-card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <TokenLogo sym={from} className="size-10 rounded-full ring-2 ring-background" />
                <TokenLogo sym={to} className="size-10 rounded-full ring-2 ring-background" />
              </div>
              <div>
                <div className="font-display text-xl font-bold">{from}/{to}</div>
                <div className="font-mono text-sm text-muted-foreground">1 {from} = {rate} {to}</div>
              </div>
            </div>
          </div>
          <div className="mt-6">
            {/* Price Chart */}
            <div className="relative h-48 w-full overflow-hidden rounded-xl border border-border/60 bg-background/40">
              {/* Grid lines */}
              <div className="absolute inset-0 grid grid-rows-4 gap-px">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="border-b border-border/20" />
                ))}
              </div>

              {/* Price line chart - simple line showing stable price */}
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                {/* Gradient fill */}
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Fill area */}
                <path
                  d="M0,100 L50,95 L100,90 L150,85 L200,90 L250,95 L300,90 L350,85 L400,90 L450,95 L500,90"
                  fill="url(#chartGradient)"
                  transform="translate(0, 30)"
                />

                {/* Price line */}
                <path
                  d="M0,100 L50,95 L100,90 L150,85 L200,90 L250,95 L300,90 L350,85 L400,90 L450,95 L500,90"
                  fill="none"
                  stroke="rgb(34, 197, 94)"
                  strokeWidth="2"
                  transform="translate(0, 30)"
                />

                {/* Data points */}
                <circle cx="50" cy="125" r="3" fill="rgb(34, 197, 94)" />
                <circle cx="150" cy="115" r="3" fill="rgb(34, 197, 94)" />
                <circle cx="250" cy="125" r="3" fill="rgb(34, 197, 94)" />
                <circle cx="350" cy="115" r="3" fill="rgb(34, 197, 94)" />
                <circle cx="450" cy="120" r="3" fill="rgb(34, 197, 94)" />
              </svg>

              {/* Price label overlay */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">1 {from} =</span>
                  <span className="font-display text-lg font-bold text-green-500">
                    {(parseFloat(rate)).toFixed(4)} {to}
                  </span>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-1">
                  <svg className="size-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M7 17l5-5 5 5M7 7l5 5 5-5" />
                  </svg>
                  <span className="text-xs font-medium text-green-500">$1.00</span>
                </div>
              </div>

              {/* Time labels */}
              <div className="absolute inset-x-0 top-2 flex justify-between px-4 text-xs text-muted-foreground">
                <span>24m</span>
                <span>1h</span>
                <span>2h</span>
                <span>4h</span>
              </div>
            </div>

            {/* Price stats */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">High 24h</div>
                  <div className="font-mono text-sm font-semibold">$1.00</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Low 24h</div>
                  <div className="font-mono text-sm font-semibold">$0.98</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-green-500">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17l5-5 5 5M7 7l5 5 5-5" />
                </svg>
                <span className="text-sm font-medium">+0.00%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bento-card p-4">
            <div className="text-xs text-muted-foreground">24h Volume</div>
            <div className="mt-1 font-display text-xl font-bold">$0</div>
          </div>
          <div className="bento-card p-4">
            <div className="text-xs text-muted-foreground">Liquidity</div>
            {poolLoading ? (
              <div className="mt-1 h-7 w-16 animate-pulse rounded bg-muted" />
            ) : poolData ? (
              <div className="mt-1 font-display text-xl font-bold text-green-500">
                ${poolData.liquidityUSD}
              </div>
            ) : (
              <div className="mt-1 font-display text-xl font-bold text-muted-foreground">—</div>
            )}
          </div>
          <div className="bento-card p-4">
            <div className="text-xs text-muted-foreground">Price</div>
            <div className="mt-1 font-display text-xl font-bold text-green-500">
              {from === "Z" ? "$1.00" : to === "Z" ? "$1.00" : rate}
            </div>
          </div>
        </div>
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
              {usdcLoading || eurcLoading || zLoading ? (
                <span className="animate-pulse">Loading...</span>
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
            <TokenSelect value={from} onChange={setFrom} exclude={to} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            ≈ $ {amount || "0.00"}
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
              placeholder="0.0"
              value={displayOutput}
              className="w-full bg-transparent font-display text-3xl font-bold outline-none placeholder:text-muted-foreground/40"
            />
            <TokenSelect value={to} onChange={setTo} exclude={from} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            ≈ $ {displayOutput || "0.00"}
          </div>
        </div>

        {/* Details */}
        <div className="mt-4 space-y-1.5 rounded-xl bg-background/40 p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rate</span>
            <span className="font-mono">1 {from} = {rate} {to}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Min received</span>
            <span className="font-mono">{(parseFloat(displayOutput || "0") * 0.995).toFixed(6)} {to}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Network fee</span>
            <span className="font-mono">~0.01 USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Slippage protection</span>
            <span className="font-mono text-primary">{slippage}%</span>
          </div>
        </div>

        {swapError && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{swapError}</p>
          </div>
        )}

        {swapSuccess && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Swap Successful!
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{swapSuccess}</p>
          </div>
        )}

        {!mounted ? (
          <button
            disabled
            className="mt-4 w-full rounded-2xl bg-gradient-mint py-4 font-display text-base font-bold text-primary-foreground opacity-50"
          >
            Loading...
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
            disabled={!amount || isSwapPending || isApproving}
            className="mt-4 w-full rounded-2xl bg-gradient-mint py-4 font-display text-base font-bold text-primary-foreground shadow-mint transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
          >
            {isApproving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Approving...
              </span>
            ) : isSwapPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Swapping...
              </span>
            ) : !amount ? (
              "Enter an amount"
            ) : (
              `Swap ${from} → ${to}`
            )}
          </button>
        )}

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Powered by Circle App Kit • USDC native gas on Arc
        </p>
      </div>
    </div>
  );
}