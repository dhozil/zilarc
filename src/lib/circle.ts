import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import type { Hex } from "viem";

// Import chain definitions from Circle App Kit chains package
import {
  ArcTestnet,
  EthereumSepolia,
  ArbitrumSepolia,
  BaseSepolia,
  OptimismSepolia,
  PolygonAmoy,
  AvalancheFuji,
  LineaSepolia
} from "@circle-fin/app-kit/chains";

// Export Arc Testnet chain
export const arcTestnet = ArcTestnet;

// Token addresses on Arc Testnet
export const ARC_TOKENS = {
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
} as const;

// CCTP Domain IDs
export const CCTP_DOMAINS = {
  ethereum: 0,
  avalanche: 1,
  optimism: 2,
  arbitrum: 3,
  base: 6,
  polygon: 7,
  linea: 15,
  arc: 26,
} as const;

// Supported chains metadata
export const SUPPORTED_CHAINS = [
  { id: "arc", name: "Arc Testnet", domain: 26, chainId: 5042002, chain: ArcTestnet },
  { id: "eth", name: "Ethereum Sepolia", domain: 0, chainId: 11155111, chain: EthereumSepolia },
  { id: "arb", name: "Arbitrum Sepolia", domain: 3, chainId: 421614, chain: ArbitrumSepolia },
  { id: "base", name: "Base Sepolia", domain: 6, chainId: 84532, chain: BaseSepolia },
  { id: "op", name: "OP Sepolia", domain: 2, chainId: 11155420, chain: OptimismSepolia },
  { id: "polygon", name: "Polygon Amoy", domain: 7, chainId: 80002, chain: PolygonAmoy },
  { id: "avax", name: "Avalanche Fuji", domain: 1, chainId: 43113, chain: AvalancheFuji },
  { id: "linea", name: "Linea Sepolia", domain: 15, chainId: 534351, chain: LineaSepolia },
] as const;

// Chain ID to AppKit chain object mapping
const CHAIN_MAP: Record<string, any> = {
  arc: ArcTestnet,
  eth: EthereumSepolia,
  arb: ArbitrumSepolia,
  base: BaseSepolia,
  op: OptimismSepolia,
  polygon: PolygonAmoy,
  avax: AvalancheFuji,
  linea: LineaSepolia,
};

// App Kit singleton
let appKit: AppKit | null = null;

export function getAppKit(): AppKit {
  if (!appKit) {
    appKit = new AppKit();
  }
  return appKit;
}

// Bridge types
export interface BridgeQuote {
  sourceChain: string;
  destinationChain: string;
  amount: string;
  destinationAmount: string;
  bridgeFee: string;
  gasFee: string;
  estimatedTime: string;
}

export interface BridgeTransaction {
  id: string;
  sourceChain: string;
  destinationChain: string;
  amount: string;
  status: "pending" | "confirming" | "completed" | "failed";
  txHash?: string;
  timestamp: number;
}

// Get chain object for AppKit
export function getChainObject(chainId: string): any {
  return CHAIN_MAP[chainId];
}

// Estimate bridge quote
export async function getBridgeQuote(
  sourceChainId: string,
  destinationChainId: string,
  amount: string,
  sourceAdapter: any
): Promise<BridgeQuote> {
  const kit = getAppKit();

  try {
    const destChain = getChainObject(destinationChainId);

    const estimate = await kit.estimateBridge({
      from: sourceAdapter,
      to: { chain: destChain },
      amount,
      token: "USDC",
    });

    return {
      sourceChain: sourceChainId,
      destinationChain: destinationChainId,
      amount,
      destinationAmount: amount,
      bridgeFee: estimate.protocolFee || "0",
      gasFee: estimate.gasFee || "~0.50",
      estimatedTime: estimate.estimatedDuration || "~15 min",
    };
  } catch (error) {
    console.error("Bridge estimate error:", error);
    return {
      sourceChain: sourceChainId,
      destinationChain: destinationChainId,
      amount,
      destinationAmount: amount,
      bridgeFee: "0",
      gasFee: "~0.50",
      estimatedTime: "~15 min",
    };
  }
}

// Execute bridge transfer
export async function executeBridge(
  sourceChainId: string,
  destinationChainId: string,
  amount: string,
  sourceAdapter: any,
  destinationAddress: string
): Promise<{ success: boolean; txHash?: string; error?: string; result?: any }> {
  const kit = getAppKit();

  try {
    const destChain = getChainObject(destinationChainId);

    const result = await kit.bridge({
      from: sourceAdapter,
      to: {
        chain: destChain,
        destinationAddress: destinationAddress,
      },
      amount,
      token: "USDC",
    });

    return {
      success: true,
      txHash: result.hash,
      result,
    };
  } catch (error: any) {
    console.error("Bridge execution error:", error);
    return {
      success: false,
      error: error?.message || "Bridge failed",
    };
  }
}

// Create wallet adapter from provider (for browser)
export async function createWalletAdapter(provider: any) {
  const { createViemAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2");
  return createViemAdapterFromProvider({ provider });
}

// Create adapter from private key (for server-side)
export function createServerAdapter(privateKey: Hex) {
  return createViemAdapterFromPrivateKey({
    privateKey,
    chain: arcTestnet as any,
  });
}

// Check if route is supported
export function isRouteSupported(sourceChainId: string, destinationChainId: string): boolean {
  const supportedPairs: Record<string, string[]> = {
    arc: ["eth", "arb", "base", "op", "polygon", "avax", "linea"],
    eth: ["arc", "arb", "base", "op", "polygon", "avax", "linea"],
    arb: ["arc", "eth", "base", "op", "polygon", "avax", "linea"],
    base: ["arc", "eth", "arb", "op", "polygon", "avax", "linea"],
    op: ["arc", "eth", "arb", "base", "polygon", "avax", "linea"],
    polygon: ["arc", "eth", "arb", "base", "op", "avax", "linea"],
    avax: ["arc", "eth", "arb", "base", "op", "polygon", "linea"],
    linea: ["arc", "eth", "arb", "base", "op", "polygon", "avax"],
  };

  return supportedPairs[sourceChainId]?.includes(destinationChainId) ?? false;
}

// Get gas balance needed for bridging
export async function getGasNeeded(chainId: string, amount: string): Promise<string> {
  const kit = getAppKit();

  try {
    const chain = getChainObject(chainId);
    const estimate = await kit.estimateBridge({
      from: { chain },
      to: { chain: ArcTestnet },
      amount,
      token: "USDC",
    });

    return estimate.gasFee || "0";
  } catch (error) {
    return "~0.50";
  }
}
