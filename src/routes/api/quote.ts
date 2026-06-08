import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

/**
 * POST /api/quote — App Kit swap estimate (server-side).
 *
 * Why server-side: kit.estimateSwap() requires a kit key. Kit keys are
 * server-side secrets (see .env.example). The browser never sees them.
 *
 * Request body:
 *   { chain: "Arc_Testnet", tokenIn: string, tokenOut: string, amountIn: string }
 *
 * Response: { amountIn, estimatedOutput, fees, ... }
 */
export const Route = createFileRoute("/api/quote")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const KIT_KEY = process.env.KIT_KEY;
        const PRIVATE_KEY = process.env.PRIVATE_KEY;

        if (!KIT_KEY)      return jsonError(500, "KIT_KEY not set on server");
        if (!PRIVATE_KEY || !PRIVATE_KEY.startsWith("0x")) {
          return jsonError(500, "PRIVATE_KEY not set on server");
        }

        let body: any;
        try { body = await request.json(); }
        catch { return jsonError(400, "Invalid JSON body"); }

        const { chain, tokenIn, tokenOut, amountIn } = body ?? {};
        if (!chain || !tokenIn || !tokenOut || !amountIn) {
          return jsonError(400, "chain, tokenIn, tokenOut, amountIn required");
        }
        if (tokenIn === tokenOut) {
          return jsonError(400, "tokenIn and tokenOut must differ");
        }
        if (Number(amountIn) <= 0) {
          return jsonError(400, "amountIn must be > 0");
        }

        try {
          const kit = new AppKit();
          const adapter = createViemAdapterFromPrivateKey({
            privateKey: PRIVATE_KEY as `0x${string}`,
          });

          const estimate = await kit.estimateSwap({
            from: { adapter, chain },
            tokenIn,
            tokenOut,
            amountIn: String(amountIn),
            config: { kitKey: KIT_KEY },
          });

          return Response.json(estimate);
        } catch (err: any) {
          console.error("[/api/quote] error:", err);
          return jsonError(500, err?.message ?? "Quote failed");
        }
      },
    },
  },
});

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
