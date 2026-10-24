// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

// Solana libraries are browser-only (wallet signing). Keep them out of the server bundle:
// on the server, the solana module resolves to an empty stub (it is only ever loaded via
// dynamic import inside effects/handlers, which never run during SSR).
const solanaServerStub: Plugin = {
  name: "kiln-solana-server-stub",
  enforce: "pre",
  resolveId(id) {
    if (this.environment?.name === "client") return null;
    if (/(^|\/)lib\/solana-impl(\.ts)?$/.test(id)) return "\0solana-server-stub";
    return null;
  },
  load(id) {
    if (id === "\0solana-server-stub") return "export {};";
    return null;
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: { plugins: [solanaServerStub] },
});
