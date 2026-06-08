/**
 * /api/quote — Server-side App Kit estimateSwap.
 *
 * Holds KIT_KEY + PRIVATE_KEY server-side only. Returns estimated output
 * without executing the swap. Client uses this to display "you will receive ~X".
 *
 * Lives at project-root /api/ (Nitro/Vercel serverless), NOT under src/routes/
 * — TanStack Router would try to crawl and bundle it for the client.
 */

import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { ArcTestnet } from "@circle-fin/app-kit/chains";

interface QuoteRequest {
  chain?: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
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

  let body: QuoteRequest;
  try {
    body = (await req.json()) as QuoteRequest;
  } catch {
    return jsonError("Invalid JSON body");
  }

  const { chain, tokenIn, tokenOut, amountIn } = body;
  if (!tokenIn || !tokenOut || !amountIn) {
    return jsonError("tokenIn, tokenOut, amountIn are required");
  }
  if (tokenIn === tokenOut) return jsonError("tokenIn and tokenOut must differ");

  const chainId = chain ?? "Arc_Testnet";
  if (chainId !== "Arc_Testnet") {
    return jsonError(`Chain ${chainId} not supported by this endpoint`, 400);
  }

  try {
    const kit = new AppKit();
    const adapter = createViemAdapterFromPrivateKey({
      privateKey: privateKey as `0x${string}`,
    });

    const estimate = await kit.estimateSwap({
      from: { adapter, chain: ArcTestnet },
      tokenIn,
      tokenOut,
      amountIn,
      config: { kitKey },
    });

    return new Response(
      JSON.stringify({
        amountIn,
        estimatedOutput: estimate.estimatedOutput,
        fees: estimate.fees ?? [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[api/quote] error:", err);
    return jsonError(err?.message ?? "Quote failed", 500);
  }
}
