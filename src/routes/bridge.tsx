import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import React from "react";
import { useWallet } from "@/hooks/useWallet";
import { ChainLogo, type ChainId } from "@/components/ChainLogos";
import { useAccount, useSwitchChain, useChainId } from "wagmi";
import { useChainUsdcBalance } from "@/hooks/useBalance";
import { bridgeUSDC, CHAIN_ID_MAP, CHAIN_NAME_MAP, type BridgeResult } from "@/lib/bridge";
import type { EIP1193Provider } from "viem";
import type { config } from "@/lib/wagmi";

export const Route = createFileRoute("/bridge")({
  head: () => ({
    meta: [
      { title: "Bridge — Zilarc" },
      { name: "description", content: "Bridge USDC across chains to and from Arc Network testnet using Circle's CCTP." },
    ],
  }),
  component: BridgePage,
});

// Step status display
function BridgeStepStatus({
  step,
  status,
  txHash,
  explorerUrl,
}: {
  step: string;
  status: string;
  txHash?: string;
  explorerUrl?: string;
}) {
  const statusColors: Record<string, string> = {
    pending: "text-muted-foreground",
    success: "text-green-500",
    error: "text-red-500",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    pending: (
      <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
      </svg>
    ),
    success: (
      <svg className="size-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    error: (
      <svg className="size-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M15 9l-6 6M9 9l6 6" />
      </svg>
    ),
  };

  const stepLabels: Record<string, string> = {
    approve: "Approve USDC",
    burn: "Burn USDC",
    fetchAttestation: "Wait for Attestation",
    mint: "Mint USDC",
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {statusIcons[status] || statusIcons.pending}
        <span className={statusColors[status]}>{stepLabels[step] || step}</span>
      </div>
      {txHash && (
        <a
          href={explorerUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-xs font-mono text-primary hover:underline"
        >
          {txHash.slice(0, 10)}...{txHash.slice(-8)}
        </a>
      )}
    </div>
  );
}

// Supported chains for bridging
const CHAINS: { id: ChainId; name: string; symbol: string }[] = [
  { id: "arc", name: "Arc Testnet", symbol: "Arc" },
  { id: "eth", name: "Ethereum Sepolia", symbol: "Eth" },
  { id: "arb", name: "Arbitrum Sepolia", symbol: "Arb" },
  { id: "base", name: "Base Sepolia", symbol: "Base" },
  { id: "op", name: "OP Sepolia", symbol: "OP" },
  { id: "polygon", name: "Polygon Amoy", symbol: "Poly" },
  { id: "avax", name: "Avalanche Fuji", symbol: "Avax" },
  { id: "linea", name: "Linea Sepolia", symbol: "Linea" },
];

function ChainSelect({
  value,
  onChange,
  label,
  exclude,
}: { value: ChainId; onChange: (v: ChainId) => void; label: string; exclude?: ChainId }) {
  const available = CHAINS.filter((c) => c.id !== exclude);

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-4">
      <div className="mb-3 text-xs text-muted-foreground">{label}</div>
      <div className="grid grid-cols-4 gap-2">
        {available.map((c) => (
          <button
            key={c.id}
            onClick={() => onChange(c.id)}
            className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${
              c.id === value ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
            }`}
          >
            <ChainLogo id={c.id} className="size-8" />
            <span className="text-[10px] font-medium">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function BridgePage() {
  const [mounted, setMounted] = useState(false);
  const { address, connect } = useWallet();
  const { connector } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  useEffect(() => {
    setMounted(true);
  }, []);

  const [from, setFrom] = useState<ChainId>("eth");
  const [to, setTo] = useState<ChainId>("arc");
  const [amount, setAmount] = useState("");
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeResult, setBridgeResult] = useState<BridgeResult | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string>("");

  // Step statuses for UI
  const [stepStatuses, setStepStatuses] = useState<Record<string, { status: string; txHash?: string; explorerUrl?: string }>>({
    approve: { status: "pending" },
    burn: { status: "pending" },
    fetchAttestation: { status: "pending" },
    mint: { status: "pending" },
  });

  // Get USDC balance dari SOURCE chain (yang dipilih di "From")
  const { balance: sourceBalance, formattedBalance: sourceFormatted, loading: sourceLoading } = useChainUsdcBalance(address, from);

  // Get Arc balance untuk sidebar
  const { formattedBalance: arcFormatted } = useChainUsdcBalance(address, "arc");

  const flip = () => {
    setFrom((prevFrom) => {
      const newFrom = to;
      setTo(prevFrom);
      return newFrom;
    });
  };

  // Check if route is supported (Arc <-> Other chains)
  const isRouteSupported = from === "arc" || to === "arc";

  const handleBridge = useCallback(async () => {
    console.log("handleBridge called", { address, amount, isRouteSupported, connector });

    if (!address || !amount || !isRouteSupported || !connector) {
      console.log("handleBridge early return", {
        hasAddress: !!address,
        hasAmount: !!amount,
        isRouteSupported,
        hasConnector: !!connector,
      });
      return;
    }

    // Reset states
    setBridgeResult(null);
    setBridgeError(null);
    setIsBridging(true);
    setStepStatuses({
      approve: { status: "pending" },
      burn: { status: "pending" },
      fetchAttestation: { status: "pending" },
      mint: { status: "pending" },
    });

    try {
      const sourceChainId = CHAIN_ID_MAP[from];
      console.log(`Current chain: ${chainId}, Source chain: ${sourceChainId}`);

      // Switch to source chain if needed
      if (chainId !== sourceChainId) {
        console.log(`Switching from chain ${chainId} to ${sourceChainId}...`);
        await switchChainAsync({ chainId: sourceChainId as typeof config.chains[number]["id"] });
        // Wait a bit for chain to switch
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      // Get provider
      const provider = (await connector?.getProvider()) as EIP1193Provider | undefined;
      console.log("Provider:", provider);

      if (!provider) {
        throw new Error("Wallet not connected. Please connect your wallet first.");
      }

      console.log("Starting bridge...", { from, to, amount });

      // Progress callback
      const onProgress = (step: string, data: any) => {
        console.log(`Bridge step: ${step}`, data);
        setCurrentStep(step);

        setStepStatuses((prev) => ({
          ...prev,
          [step]: {
            status: data.state || "success",
            txHash: data.txHash,
            explorerUrl: data.explorerUrl,
          },
        }));
      };

      // Execute bridge
      console.log("Calling bridgeUSDC...");
      const result = await bridgeUSDC({
        provider,
        fromChain: from,
        toChain: to,
        amount,
        onProgress,
      });
      console.log("Bridge completed:", result);

      setBridgeResult(result);
      setCurrentStep("");
      setAmount("");

      // Switch back to Arc if destination was Arc
      if (to === "arc" && chainId !== CHAIN_ID_MAP.arc) {
        await switchChainAsync({ chainId: CHAIN_ID_MAP.arc as typeof config.chains[number]["id"] });
      }

    } catch (error: any) {
      console.error("Bridge error:", error);
      setBridgeError(error?.message || "Bridge failed. Please try again.");
    } finally {
      setIsBridging(false);
    }
  }, [address, amount, isRouteSupported, connector, from, to, chainId, switchChainAsync]);

  // Reset result when chains or amount change
  useEffect(() => {
    setBridgeResult(null);
    setBridgeError(null);
  }, [from, to, amount]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="flex items-center gap-3 font-display text-4xl font-bold md:text-5xl">
          <img src="/icons/bridge-icon.svg" alt="Bridge" className="size-10" />
          Cross-chain <span className="text-gradient">Bridge</span>
        </h1>
        <p className="mt-3 text-muted-foreground">
          Move USDC between networks using Circle's CCTP protocol
        </p>
        <a
          href="https://faucet.circle.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Need testnet USDC? Get from faucet →
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="bento-card p-6">
          <ChainSelect value={from} onChange={setFrom} label="From" exclude={to} />

          <div className="my-[-12px] flex justify-center">
            <button
              onClick={flip}
              className="relative z-10 grid size-10 place-items-center rounded-xl border border-border bg-card shadow-card transition hover:rotate-180 hover:border-primary"
            >
              <svg className="size-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 4v16M12 4l-4 4M12 4l4 4" />
              </svg>
            </button>
          </div>

          <ChainSelect value={to} onChange={setTo} label="To" exclude={from} />

          {/* Amount input */}
          <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Amount (USDC)</span>
              <span className="text-xs text-primary">Balance: {sourceFormatted}</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-transparent font-display text-2xl font-bold outline-none placeholder:text-muted-foreground/40"
              />
              <button
                onClick={() => setAmount(sourceBalance)}
                className="rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-semibold text-muted-foreground hover:border-primary/40"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Action button */}
          {!mounted ? (
            <button
              disabled
              className="mt-4 w-full rounded-2xl bg-gradient-mint py-4 font-display font-bold text-primary-foreground opacity-50"
            >
              Loading...
            </button>
          ) : !address ? (
            <button
              onClick={connect}
              className="mt-4 w-full rounded-2xl bg-gradient-mint py-4 font-display font-bold text-primary-foreground shadow-mint transition hover:scale-[1.01]"
            >
              Connect Wallet
            </button>
          ) : !isRouteSupported ? (
            <button
              disabled
              className="mt-4 w-full rounded-2xl bg-muted py-4 font-display font-bold text-muted-foreground"
            >
              Route Not Supported
            </button>
          ) : (
            <button
              onClick={handleBridge}
              disabled={!amount || isBridging}
              className="mt-4 w-full rounded-2xl bg-gradient-mint py-4 font-display font-bold text-primary-foreground shadow-mint transition hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
            >
              {isBridging ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
                  </svg>
                  Bridging... {currentStep && `(${currentStep})`}
                </span>
              ) : !amount ? (
                "Enter an amount"
              ) : (
                `Bridge ${amount} USDC`
              )}
            </button>
          )}

          {bridgeError && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">{bridgeError}</p>
            </div>
          )}

          {/* Bridge Progress */}
          {isBridging && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="mb-3 text-sm font-semibold text-primary">Bridge Progress</div>
              <div className="space-y-1">
                {Object.entries(stepStatuses).map(([step, data]) => (
                  <BridgeStepStatus
                    key={step}
                    step={step}
                    status={data.status}
                    txHash={data.txHash}
                    explorerUrl={data.explorerUrl}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bridge Result */}
          {bridgeResult && bridgeResult.state === "success" && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Bridge Successful!
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Successfully bridged {bridgeResult.amount} USDC from {CHAINS.find(c => c.id === from)?.name} to {CHAINS.find(c => c.id === to)?.name}
              </p>
              <div className="mt-3 space-y-2">
                {bridgeResult.steps.map((step) => (
                  <BridgeStepStatus
                    key={step.name}
                    step={step.name}
                    status={step.state}
                    txHash={step.txHash}
                    explorerUrl={step.explorerUrl}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="space-y-4">
          <div className="bento-card p-5">
            <h3 className="font-display font-bold">Estimate</h3>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span className="font-mono">~15 min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bridge fee</span>
                <span className="font-mono">0 USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gas fee</span>
                <span className="font-mono">~$0.50</span>
              </div>
              <div className="border-t border-border/50 pt-2 flex justify-between">
                <span>You receive</span>
                <span className="font-mono font-bold text-primary">
                  {amount ? `${amount} USDC` : "0 USDC"}
                </span>
              </div>
            </div>
          </div>

          <div className="bento-card p-5">
            <h3 className="font-display font-bold">How it works</h3>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="font-bold text-primary">1.</span>
                <span>USDC is burned on source chain</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">2.</span>
                <span>Circle attests the burn</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary">3.</span>
                <span>USDC is minted on destination</span>
              </li>
            </ol>
          </div>

          <div className="bento-card p-5">
            <h3 className="font-display font-bold">Your Balance</h3>
            <div className="mt-2 text-xs text-muted-foreground">
              {CHAINS.find(c => c.id === from)?.name}
            </div>
            <div className="mt-3 text-2xl font-bold text-primary">{sourceFormatted}</div>
            <p className="mt-1 text-xs text-muted-foreground">Auto-refresh every 15 seconds</p>
          </div>
        </div>
      </div>
    </div>
  );
}