type Props = { className?: string };

/* ============ CHAIN LOGOS (using PNG from icons folder) ============ */

export function ArcLogo({ className }: Props) {
  return <img src="/icons/arc.png" alt="Arc" className={className} />;
}

export function EthereumLogo({ className }: Props) {
  return <img src="/icons/ethereum.png" alt="Ethereum" className={className} />;
}

export function ArbitrumLogo({ className }: Props) {
  return <img src="/icons/arbitrum.png" alt="Arbitrum" className={className} />;
}

export function OptimismLogo({ className }: Props) {
  return <img src="/icons/optimism.png" alt="Optimism" className={className} />;
}

export function BaseLogo({ className }: Props) {
  return <img src="/icons/base.png" alt="Base" className={className} />;
}

export function AvalancheLogo({ className }: Props) {
  return <img src="/icons/avalanche.png" alt="Avalanche" className={className} />;
}

export function PolygonLogo({ className }: Props) {
  return <img src="/icons/polygon_new.png" alt="Polygon" className={className} />;
}

export function LineaLogo({ className }: Props) {
  return <img src="/icons/linea.png" alt="Linea" className={className} />;
}

/* ============ TOKEN LOGOS ============ */

export function UsdcLogo({ className }: Props) {
  return <img src="/icons/usdc.png" alt="USDC" className={className} />;
}

export function EurcLogo({ className }: Props) {
  return <img src="/icons/euro.png" alt="EURC" className={className} />;
}

export function UsdtLogo({ className }: Props) {
  return <img src="/icons/usdt.png" alt="USDT" className={className} />;
}

/* DAI — official style: yellow circle with overlapping "D" wordmark */
export function DaiLogo({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="DAI"
    >
      <circle cx="16" cy="16" r="16" fill="#F5AC37" />
      <path
        d="M19.3 9.6h-2.2v12.8h2.2c2.2 0 3.9-.6 5.1-1.8 1.2-1.2 1.8-2.8 1.8-4.6 0-1.9-.6-3.5-1.8-4.6-1.2-1.2-2.9-1.8-5.1-1.8Zm-3.5 1.5h-3.2v9.8h3.2v-9.8Zm3.4 9.8h-.9V11.1h.9c1.7 0 3 .4 3.9 1.3.9.9 1.4 2.1 1.4 3.6 0 1.5-.5 2.7-1.4 3.6-.9.9-2.2 1.3-3.9 1.3Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/* WETH — wrapped ETH: ETH diamond inside a rounded square outline (distinguishes from raw ETH) */
export function WethLogo({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="WETH"
    >
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="7.5" fill="#1F1F1F" stroke="#A1A1AA" strokeWidth="1.5" />
      <path d="M16 4 L16 13.2 L21.8 15.4 Z" fill="#FFFFFF" />
      <path d="M16 4 L10.2 15.4 L16 13.2 Z" fill="#E0E0E0" />
      <path d="M16 22.5 L16 28 L21.8 16.5 Z" fill="#FFFFFF" />
      <path d="M16 28 L16 22.5 L10.2 16.5 Z" fill="#E0E0E0" />
      <path d="M16 21.3 L21.8 15.9 L16 14 Z" fill="#BFBFBF" />
      <path d="M16 21.3 L10.2 15.9 L16 14 Z" fill="#D9D9D9" />
    </svg>
  );
}

export function CirbtcLogo({ className }: Props) {
  return <img src="/icons/cirBTC.png" alt="cirBTC" className={className} />;
}

export function ZilarcLogo({ className }: Props) {
  return <img src="/icons/z.svg" alt="Z" className={className} />;
}

export function NeonLogo({ className }: Props) {
  return <img src="/icons/neon.svg" alt="NEON" className={className} />;
}

export function JettLogo({ className }: Props) {
  return <img src="/icons/jett.svg" alt="JETT" className={className} />;
}

export function CircleLogo({ className }: Props) {
  return <img src="/icons/circle.png" alt="Circle" className={className} />;
}

/* ============ REGISTRIES ============ */

export const CHAIN_LOGOS = {
  arc: ArcLogo,
  eth: EthereumLogo,
  arb: ArbitrumLogo,
  op: OptimismLogo,
  base: BaseLogo,
  polygon: PolygonLogo,
  avax: AvalancheLogo,
  linea: LineaLogo,
} as const;

export type ChainId = keyof typeof CHAIN_LOGOS;

export function ChainLogo({ id, className = "size-8" }: { id: ChainId; className?: string }) {
  const C = CHAIN_LOGOS[id];
  return <C className={className} />;
}

export const TOKEN_LOGOS = {
  ARC: ArcLogo,
  USDC: UsdcLogo,
  EURC: EurcLogo,
  USDT: UsdtLogo,
  DAI: DaiLogo,
  WETH: WethLogo,
  cirBTC: CirbtcLogo,
  ETH: EthereumLogo,
  CIRCLE: CircleLogo,
  Z: ZilarcLogo,
  NEON: NeonLogo,
  JETT: JettLogo,
} as const;

// Tokens available in the swap UI
export type TokenSym = "USDC" | "EURC" | "USDT" | "DAI" | "WETH" | "Z" | "NEON" | "JETT";

export function TokenLogo({ sym, className = "size-8" }: { sym: TokenSym; className?: string }) {
  const C = TOKEN_LOGOS[sym as keyof typeof TOKEN_LOGOS];
  if (!C) return null;
  return <C className={className} />;
}