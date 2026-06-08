"use client";

/**
 * BridgeSuccessModal — full-overlay success state for completed CCTP bridges.
 *
 * Shown after `bridgeUSDC` resolves successfully. Replaces the small inline
 * card so the moment-of-success feels appropriately weighty (the user has
 * just waited ~10–15 minutes for attestation + mint).
 *
 * Surfaces:
 *   - Big check icon + "Bridge complete" headline
 *   - Amount + source/destination chains, with logos
 *   - Each CCTP step (approve, burn, fetchAttestation, mint) with its
 *     transaction hash linked to the proper explorer
 *   - Updated destination-chain balance (refreshed every 5 s after mint
 *     until the user closes the modal)
 *   - Two CTAs: "Bridge again" (close + reset form) and, when destination
 *     is Arc, "Swap on Arc" (deep-link to /swap)
 */

import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ChainLogo, type ChainId } from "@/components/ChainLogos";
import { useChainUsdcBalance } from "@/hooks/useBalance";
import type { BridgeResult } from "@/lib/bridge";

type ChainMeta = { id: ChainId; name: string };

interface Props {
  open: boolean;
  result: BridgeResult | null;
  fromChain: ChainMeta;
  toChain: ChainMeta;
  address: string | null | undefined;
  onClose: () => void;
  onBridgeAgain: () => void;
}

const STEP_ORDER: Array<"approve" | "burn" | "fetchAttestation" | "mint"> = [
  "approve",
  "burn",
  "fetchAttestation",
  "mint",
];

const STEP_LABEL: Record<string, string> = {
  approve:          "Approve USDC",
  burn:             "Burn on source",
  fetchAttestation: "Circle attestation",
  mint:             "Mint on destination",
};

export function BridgeSuccessModal({
  open,
  result,
  fromChain,
  toChain,
  address,
  onClose,
  onBridgeAgain,
}: Props) {
  // Refresh destination balance while the modal is open. Mint is the last
  // step, so by the time we render here the balance should already reflect
  // the new amount — but RPCs can lag a few seconds, hence the polling.
  const { formattedBalance: destFormatted, refresh } = useChainUsdcBalance(
    address,
    toChain.id,
  );

  useEffect(() => {
    if (!open) return;
    refresh();
    const t = setInterval(refresh, 5_000);
    return () => clearInterval(t);
  }, [open, refresh]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !result) return null;

  // Map step name → step result. Steps may arrive out of registration order
  // depending on the App Kit event sequence, so do a lookup rather than
  // index-by-position.
  const stepByName: Record<string, typeof result.steps[number] | undefined> = {};
  for (const s of result.steps) stepByName[s.name] = s;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bridge-success-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-primary/30 bg-card shadow-2xl">
        {/* Top accent strip with celebratory shimmer */}
        <div className="relative h-1.5 w-full bg-gradient-mint">
          <div className="absolute inset-0 shimmer" />
        </div>

        <div className="p-7">
          {/* Big success icon */}
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-primary/15 ring-1 ring-primary/40">
            <svg className="size-10 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Headline */}
          <h2 id="bridge-success-title" className="mt-5 text-center font-display text-3xl font-bold">
            Bridge complete
          </h2>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Your USDC has arrived on {toChain.name}.
          </p>

          {/* Amount + route */}
          <div className="mt-6 rounded-2xl border border-border bg-background/40 p-5">
            <div className="text-center">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">You bridged</div>
              <div className="mt-1 font-display text-4xl font-bold text-gradient">
                {result.amount} USDC
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex flex-1 flex-col items-center rounded-xl bg-card/60 p-3">
                <ChainLogo id={fromChain.id} className="size-8" />
                <div className="mt-2 text-xs text-muted-foreground">From</div>
                <div className="text-sm font-semibold">{fromChain.name}</div>
              </div>
              <svg className="size-5 shrink-0 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="flex flex-1 flex-col items-center rounded-xl bg-card/60 p-3">
                <ChainLogo id={toChain.id} className="size-8" />
                <div className="mt-2 text-xs text-muted-foreground">To</div>
                <div className="text-sm font-semibold">{toChain.name}</div>
              </div>
            </div>

            {/* Destination balance */}
            <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/5 px-4 py-3 text-sm">
              <span className="text-muted-foreground">New balance on {toChain.name}</span>
              <span className="font-mono font-bold text-primary">{destFormatted}</span>
            </div>
          </div>

          {/* Step-by-step explorer links */}
          <div className="mt-5 rounded-2xl border border-border bg-background/40 p-4">
            <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
              Transaction trail
            </div>
            <div className="space-y-2">
              {STEP_ORDER.map((stepName) => {
                const s = stepByName[stepName];
                if (!s) return null;
                return (
                  <div key={stepName} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <svg className="size-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{STEP_LABEL[stepName]}</span>
                    </div>
                    {s.txHash ? (
                      <a
                        href={s.explorerUrl ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {s.txHash.slice(0, 8)}…{s.txHash.slice(-6)}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTAs */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => {
                onClose();
                onBridgeAgain();
              }}
              className="flex-1 rounded-2xl border border-border bg-card/60 py-3 font-display text-sm font-bold transition hover:border-primary/40"
            >
              Bridge again
            </button>
            {toChain.id === "arc" ? (
              <Link
                to="/swap"
                onClick={onClose}
                className="flex-1 rounded-2xl bg-gradient-mint py-3 text-center font-display text-sm font-bold text-primary-foreground shadow-mint transition hover:scale-[1.01]"
              >
                Swap on Arc →
              </Link>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 rounded-2xl bg-gradient-mint py-3 font-display text-sm font-bold text-primary-foreground shadow-mint transition hover:scale-[1.01]"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
