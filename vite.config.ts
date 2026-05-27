// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Vercel deployment configuration with Nitro
export default defineConfig({
  tanstackStart: {
    deployment: {
      preset: "vercel",
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  define: {
    'process.env.BUFFER_SIZE': '1024',
  },
  build: {
    target: 'esnext',
  },
  plugins: [
    nitro({
      preset: "vercel",
    }),
  ],
});