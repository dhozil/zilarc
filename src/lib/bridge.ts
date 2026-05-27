import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import type { EIP1193Provider } from "viem";

// Chain name mapping untuk Circle App Kit
export const CHAIN_NAME_MAP: Record<string, string> = {
  arc: "Arc_Testnet",
  eth: "Ethereum_Sepolia",
  arb: "Arbitrum_Sepolia",
  base: "Base_Sepolia",
  op: "OP_Sepolia",
  polygon: "Polygon_Amoy",
  avax: "Avalanche_Fuji",
  linea: "Linea_Sepolia",
};

// Chain ID mapping
export const CHAIN_ID_MAP: Record<string, number> = {
  arc: 5042002,
  eth: 11155111,
  arb: 421614,
  base: 84532,
  op: 11155420,
  polygon: 80002,
  avax: 43113,
  linea: 59141,
};

// Bridge result type
export interface BridgeResult {
  state: "success" | "error";
  amount: string;
  token: string;
  source: {
    chain: string;
    address: string;
  };
  destination: {
    chain: string;
    address: string;
  };
  steps: Array<{
    name: "approve" | "burn" | "fetchAttestation" | "mint";
    state: "pending" | "success" | "error";
    txHash?: string;
    explorerUrl?: string;
    error?: string;
  }>;
}

// Helper to safely log any value (handles BigInt, circular refs, etc)
function safeLog(label: string, data: any) {
  try {
    const seen = new WeakSet();
    const result = JSON.stringify(data, (key, value) => {
      if (typeof value === "bigint") return value.toString();
      if (typeof value === "symbol") return value.toString();
      if (typeof value === "function") return "[Function]";
      if (value && typeof value === "object") {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return value;
    });
    console.log(label, JSON.parse(result));
  } catch (e) {
    console.log(label, String(data));
  }
}

// Bridge USDC using Circle App Kit
export async function bridgeUSDC({
  provider,
  fromChain,
  toChain,
  amount,
  onProgress,
}: {
  provider: EIP1193Provider;
  fromChain: string;
  toChain: string;
  amount: string;
  onProgress?: (step: string, data: any) => void;
}): Promise<BridgeResult> {
  console.log("=== Starting Bridge ===");

  const adapter = await createViemAdapterFromProvider({ provider });
  console.log("Adapter created");

  const sourceChainName = CHAIN_NAME_MAP[fromChain];
  const destChainName = CHAIN_NAME_MAP[toChain];

  if (!sourceChainName || !destChainName) {
    throw new Error(`Unsupported chain: ${fromChain} or ${toChain}`);
  }

  console.log("Bridge:", { from: sourceChainName, to: destChainName, amount });

  // Initialize App Kit
  const appKit = new AppKit();

  // Subscribe to bridge events
  appKit.on("bridge.approve", (payload: any) => {
    safeLog("bridge.approve event:", payload);
    if (onProgress) onProgress("approve", payload.values || payload);
  });

  appKit.on("bridge.burn", (payload: any) => {
    safeLog("bridge.burn event:", payload);
    if (onProgress) onProgress("burn", payload.values || payload);
  });

  appKit.on("bridge.fetchAttestation", (payload: any) => {
    safeLog("bridge.fetchAttestation event:", payload);
    if (onProgress) onProgress("fetchAttestation", payload.values || payload);
  });

  appKit.on("bridge.mint", (payload: any) => {
    safeLog("bridge.mint event:", payload);
    if (onProgress) onProgress("mint", payload.values || payload);
  });

  // Execute bridge
  console.log("Calling appKit.bridge()...");
  try {
    const result = await appKit.bridge({
      from: {
        adapter,
        chain: sourceChainName,
      },
      to: {
        adapter,
        chain: destChainName,
        useForwarder: true,
      },
      amount,
    });

    safeLog("=== Bridge Complete ===", result);

    if (result.state === "error") {
      const errorStep = result.steps?.find((s: any) => s.state === "error");
      console.error("=== Bridge Error ===");
      console.error("Step:", errorStep?.name);
      console.error("Error:", errorStep?.error);
    }

    return result as BridgeResult;
  } catch (error: any) {
    // Safely extract error info
    const errInfo = {
      message: error?.message || String(error),
      code: error?.code,
      type: error?.constructor?.name,
      step: error?.step,
    };
    console.error("=== Bridge Exception ===", errInfo);

    if (error?.code === 4001 || error?.message?.includes("rejected")) {
      throw new Error("Bridge cancelled by user");
    }

    throw error;
  }
}