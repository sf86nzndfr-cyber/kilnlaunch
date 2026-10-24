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

- Solana code lives in src/lib/solana-impl.ts and is only loaded via dynamic import() in the browser; it keeps web3/spl libs out of SSR and needs the Buffer polyfill imported first.
- Bonding-curve Anchor program source is in programs/kiln; the app cannot deploy it, so trading UI stays off until a program ID is supplied.
