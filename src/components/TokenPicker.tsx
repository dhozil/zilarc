"use client";

/**
 * TokenPicker — reusable token selector with logo, used by both swap and
 * pool pages. Replaces the native <select> which can't render custom
 * children, so logos didn't show up next to the symbol.
 *
 * The component is presentation-only: it tells the caller what's being
 * picked via `onChange` and which entries are clickable via `isOptionEnabled`.
 */

import { useEffect, useRef, useState } from "react";
import { TokenLogo, type TokenSym } from "@/components/ChainLogos";

export interface TokenPickerOption<T extends string> {
  sym: T;
  name?: string;
}

export interface TokenPickerProps<T extends string> {
  value: T;
  options: ReadonlyArray<TokenPickerOption<T>>;
  onChange: (value: T) => void;
  exclude?: T;
  /** Optional gating: returning false renders the option disabled with a
   *  "no pool" badge. Use for pair-based gating (e.g. EURC dropdown when
   *  the other side has no EURC pool yet). */
  isOptionEnabled?: (sym: T) => boolean;
  className?: string;
}

export function TokenPicker<T extends string>({
  value,
  options,
  onChange,
  exclude,
  isOptionEnabled,
  className = "",
}: TokenPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click & Escape
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
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
            {options
              .filter((t) => t.sym !== exclude)
              .map((t) => {
                const enabled = isOptionEnabled ? isOptionEnabled(t.sym) || t.sym === value : true;
                return (
                  <button
                    key={t.sym}
                    onClick={() => {
                      if (!enabled) return;
                      onChange(t.sym);
                      setOpen(false);
                    }}
                    disabled={!enabled}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <TokenLogo sym={t.sym as TokenSym} className="size-8 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{t.sym}</div>
                      {t.name && (
                        <div className="truncate text-xs text-muted-foreground">{t.name}</div>
                      )}
                    </div>
                    {!enabled && (
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
