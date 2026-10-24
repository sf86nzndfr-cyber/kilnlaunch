// Load the Buffer polyfill in its own step BEFORE any Solana code is evaluated.
// Bundlers can reorder modules inside one chunk, so a same-chunk polyfill import
// is not guaranteed to run first; a separate awaited import is.
let p: Promise<typeof import("./solana-impl")> | null = null;
export function loadSolana() {
  return (p ??= import("buffer").then(({ Buffer }) => {
    const g = globalThis as any;
    g.Buffer ??= Buffer;
    if (typeof window !== "undefined") (window as any).Buffer ??= Buffer;
    return import("./solana-impl");
  }));
}
