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
    /** Always a string. App Kit sometimes hands back a raw `Error` object;
     *  we normalize at the boundary so React render code never has to. */
    error?: string;
  }>;
}

/**
 * Coerce any value (string, Error, object, undefined) into a printable
 * string. Used at every place we surface an error to the UI so we never
 * accidentally render an Error instance as a React child.
 */
function errorToString(err: unknown): string {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || err.toString();
  if (typeof err === "object") {
    const anyErr = err as { message?: unknown; toString?: () => string };
    if (typeof anyErr.message === "string") return anyErr.message;
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
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
//
// App Kit and its Solana CommonJS dependencies (@coral-xyz/anchor,
// @solana/web3.js, etc.) only need to load when the user actually
// triggers a bridge — they're never reached during SSR. Importing them
// at module top level used to drag the Anchor CJS module into Nitro's
// server bundle, which crashed every Vercel function with
// `ReferenceError: exports is not defined in ES module scope`.
//
// Lazy dynamic imports inside the handler keep that whole graph in
// the browser bundle only.
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

  const [{ AppKit }, { createViemAdapterFromProvider }] = await Promise.all([
    import("@circle-fin/app-kit"),
    import("@circle-fin/adapter-viem-v2"),
  ]);

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

    // Normalize: App Kit's BridgeResult can hand back step.error as an
    // `Error` instance, which crashes React when rendered as text. Map
    // every step's `error` field to a string before returning.
    const normalized: BridgeResult = {
      ...(result as unknown as BridgeResult),
      steps: ((result as any).steps ?? []).map((s: any) => ({
        ...s,
        error: s?.error == null ? undefined : errorToString(s.error),
      })),
    };

    if (normalized.state === "error") {
      const errorStep = normalized.steps?.find((s) => s.state === "error");
      console.error("=== Bridge Error ===");
      console.error("Step:", errorStep?.name);
      console.error("Error:", errorStep?.error);
    }

    return normalized;
  } catch (error: any) {
    // Safely extract error info
    const errInfo = {
      message: errorToString(error),
      code: error?.code,
      type: error?.constructor?.name,
      step: error?.step,
    };
    console.error("=== Bridge Exception ===", errInfo);

    if (error?.code === 4001 || errInfo.message.toLowerCase().includes("rejected")) {
      throw new Error("Bridge cancelled by user");
    }

    // Detect Circle's attestation/fee API timeout. The fast-burn-fee
    // endpoint occasionally takes >10 retries; surface that as a clear
    // retryable message instead of a stack trace.
    if (errInfo.message.includes("Maximum retry attempts") || errInfo.message.toLowerCase().includes("request timed out")) {
      throw new Error("Circle's bridge service timed out. This is usually a transient testnet issue — wait 30 seconds and try again.");
    }

    throw new Error(errInfo.message || "Bridge failed");
  }
}