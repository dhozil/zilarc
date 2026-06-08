import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

/**
 * POST /api/swap — App Kit swap execution (server-side).
 *
 * Why server-side: kit.swap() requires a kit key + signing key. Both are
 * server-side secrets. The browser only sends the user's intent and
 * their connected wallet address.
 *
 * Request body:
 *   {
 *     chain: "Arc_Testnet",
 *     tokenIn: string,    // alias or 0x address
 *     tokenOut: string,   // alias or 0x address
 *     amountIn: string,   // human-readable e.g. "10.00"
 *     fromAddress: string,// connected user wallet (used as recipient/output)
 *     slippageBps?: number,
 *     stopLimit?: string, // absolute minimum output (takes precedence over slippageBps)
 *   }
 *
 * Response: { amountIn, amountOut, chain, txHash, explorerUrl, fromAddress, toAddress, fees }
 */
export const Route = createFileRoute("/api/swap")({
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

        const {
          chain, tokenIn, tokenOut, amountIn, fromAddress,
          slippageBps, stopLimit,
        } = body ?? {};

        if (!chain || !tokenIn || !tokenOut || !amountIn || !fromAddress) {
          return jsonError(400, "chain, tokenIn, tokenOut, amountIn, fromAddress required");
        }
        if (tokenIn === tokenOut) {
          return jsonError(400, "tokenIn and tokenOut must differ");
        }
        if (Number(amountIn) <= 0) {
          return jsonError(400, "amountIn must be > 0");
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(fromAddress)) {
          return jsonError(400, "fromAddress must be a valid 0x address");
        }

        // For safety, cap the per-swap size. Adjust per your app's needs.
        const AMOUNT_CAP = 100_000;
        if (Number(amountIn) > AMOUNT_CAP) {
          return jsonError(400, `amountIn exceeds safety cap of ${AMOUNT_CAP}`);
        }

        const config: any = { kitKey: KIT_KEY };
        if (slippageBps != null) config.slippageBps = Number(slippageBps);
        if (stopLimit != null)   config.stopLimit   = String(stopLimit);

        try {
          const kit = new AppKit();
          const adapter = createViemAdapterFromPrivateKey({
            privateKey: PRIVATE_KEY as `0x${string}`,
          });

          const result = await kit.swap({
            from: { adapter, chain },
            tokenIn,
            tokenOut,
            amountIn: String(amountIn),
            config,
          });

          return Response.json(result);
        } catch (err: any) {
          console.error("[/api/swap] error:", err);
          return jsonError(500, err?.message ?? "Swap failed");
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
