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
  cirBTC: CirbtcLogo,
  ETH: EthereumLogo,
  CIRCLE: CircleLogo,
  Z: ZilarcLogo,
  NEON: NeonLogo,
  JETT: JettLogo,
} as const;

// Tokens available in the swap UI
export type TokenSym = "USDC" | "EURC" | "Z" | "NEON" | "JETT";

export function TokenLogo({ sym, className = "size-8" }: { sym: TokenSym; className?: string }) {
  const C = TOKEN_LOGOS[sym as keyof typeof TOKEN_LOGOS];
  if (!C) return null;
  return <C className={className} />;
}