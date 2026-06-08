/**
 * /api/swap — Server-side App Kit swap execution.
 *
 * Lives at project-root /api/ (Nitro/Vercel serverless), NOT under src/routes/
 * — TanStack Router would try to crawl and bundle it for the client.
 *
 * Holds KIT_KEY + PRIVATE_KEY server-side. Builds Viem adapter from
 * PRIVATE_KEY, calls kit.swap() routed through LiFi aggregator, returns
 * the resulting tx hash + amountOut to the client.
 *
 * ⚠️  This endpoint MOVES REAL FUNDS (or testnet funds on Arc_Testnet).
 * Always start with small amounts.
 */

import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { ArcTestnet } from "@circle-fin/app-kit/chains";
import { isAddress } from "viem";

interface SwapRequest {
  chain?: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  fromAddress: string;
  slippageBps?: number;
  stopLimit?: string;
}

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const kitKey = process.env.KIT_KEY;
  const privateKey = process.env.PRIVATE_KEY;
  if (!kitKey) return jsonError("KIT_KEY env var not set on server", 500);
  if (!privateKey || !privateKey.startsWith("0x")) {
    return jsonError("PRIVATE_KEY env var not set on server", 500);
  }

  let body: SwapRequest;
  try {
    body = (await req.json()) as SwapRequest;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const {
    chain,
    tokenIn,
    tokenOut,
    amountIn,
    fromAddress,
    slippageBps,
    stopLimit,
  } = body;

  if (!tokenIn || !tokenOut || !amountIn || !fromAddress) {
    return jsonError("tokenIn, tokenOut, amountIn, fromAddress are required");
  }
  if (tokenIn === tokenOut) return jsonError("tokenIn and tokenOut must differ");
  if (!isAddress(fromAddress)) return jsonError("fromAddress is not a valid address");

  // USDC precompile caveat: USDC on Arc is the native gas token (precompile
  // at 0x3600…0000). The aggregator's approve() call would revert. Bail out
  // and tell the client to use Zilarc UsdcSwapHandler instead.
  if (tokenIn.toLowerCase() === "0x3600000000000000000000000000000000000000") {
    return jsonError(
      "USDC on Arc is a precompile. Use the Zilarc UsdcSwapHandler (useSwap.ts) for USDC -> token swaps on this chain.",
      400,
    );
  }

  const chainId = chain ?? "Arc_Testnet";
  if (chainId !== "Arc_Testnet") {
    return jsonError(`Chain ${chainId} not supported by this endpoint`, 400);
  }

  try {
    const kit = new AppKit();
    const adapter = createViemAdapterFromPrivateKey({
      privateKey: privateKey as `0x${string}`,
    });

    const config: { kitKey: string; slippageBps?: number; stopLimit?: string } = { kitKey };
    if (typeof slippageBps === "number") config.slippageBps = slippageBps;
    if (typeof stopLimit === "string") config.stopLimit = stopLimit;

    const result = await kit.swap({
      from: { adapter, chain: ArcTestnet },
      tokenIn,
      tokenOut,
      amountIn,
      config,
    });

    return new Response(
      JSON.stringify({
        amountIn: result.amountIn,
        amountOut: result.amountOut,
        chain: result.chain,
        txHash: result.txHash,
        explorerUrl: result.explorerUrl,
        fromAddress: result.fromAddress,
        toAddress: result.toAddress,
        fees: result.fees ?? [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[api/swap] error:", err);
    return jsonError(err?.message ?? "Swap failed", 500);
  }
}
