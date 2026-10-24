// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";
import { fileURLToPath } from "node:url";

// Solana libraries are browser-only (wallet signing). Keep them out of the server bundle:
// on the server, the solana module resolves to an empty stub (it is only ever loaded via
// dynamic import inside effects/handlers, which never run during SSR).
const solanaServerStub: Plugin = {
  name: "kiln-solana-server-stub",
  enforce: "pre",
  transform(_code, id) {
    if (this.environment?.name === "client") return null;
    if (/[\\/]lib[\\/]solana-impl\.ts(\?|$)/.test(id)) return { code: "export {};", map: null };
    return null;
  },
};

// The build aliases "buffer" to "node:buffer", which Vite replaces with an empty stub in
// the browser — Buffer.from then crashes when launching a token. Force the real npm
// `buffer` package for every client import of buffer / node:buffer.
const bufferPkg = fileURLToPath(new URL("./node_modules/buffer/index.js", import.meta.url));
const clientBufferShim: Plugin = {
  name: "kiln-client-buffer",
  enforce: "pre",
  resolveId(id) {
    if (this.environment?.name !== "client") return null;
    if (id === "buffer" || id === "buffer/" || id === "node:buffer") return bufferPkg;
    return null;
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: { plugins: [solanaServerStub, clientBufferShim] },
});
