<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Solana code lives in src/lib/solana-impl.ts and must only be loaded via loadSolana() from src/lib/load-solana.ts, which sets globalThis.Buffer in a separate awaited step first (same-chunk polyfill imports get reordered in production). vite.config.ts stubs solana-impl on the server (Solana libs can't resolve for the Worker) and forces client buffer/node:buffer imports to the npm `buffer` package (otherwise Vite externalizes it to an empty stub).
- Every launch tx tags KILN_REGISTRY as an extra read-only key on the createAccount ix; the home-page launch list is built from getSignaturesForAddress(KILN_REGISTRY), so there is no database. Phantom must sign before the mint keypair's partialSign.
- Bonding-curve Anchor source stays in programs/kiln but has no page in the app (removed at user request).
