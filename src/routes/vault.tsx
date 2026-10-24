import { loadSolana } from "@/lib/load-solana";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { usePhantom } from "@/hooks/use-phantom";
import type { TokenInfo } from "@/lib/solana-impl";

export const Route = createFileRoute("/vault")({
  head: () => ({
    meta: [
      { title: "My tokens — KILN" },
      { name: "description", content: "Every Token-2022 coin held by your connected Phantom wallet, read live from Solana." },
      { property: "og:title", content: "My tokens — KILN" },
      { property: "og:description", content: "Your Solana tokens, read live from the chain." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Vault,
});

function Vault() {
  const { address, connect, provider } = usePhantom();
  const [list, setList] = useState<(TokenInfo & { held: string })[] | null>(null);
  useEffect(() => {
    if (!provider?.publicKey) { setList(null); return; }
    loadSolana().then((s) => s.fetchHoldings(provider.publicKey!)).then(setList).catch(() => setList([]));
  }, [address, provider]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-4xl font-extrabold sm:text-5xl">The <em className="text-primary">cooling rack</em></h1>
      <p className="mt-2 text-sm text-muted-foreground">Token-2022 coins in your wallet, straight from Solana devnet.</p>
      {!address ? (
        <button onClick={connect} className="mt-8 bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground">Connect Phantom</button>
      ) : list === null ? <p className="mt-8 text-sm text-muted-foreground">Reading the chain…</p>
        : list.length === 0 ? <p className="mt-8 text-sm">Nothing here yet. <Link to="/" className="text-accent underline">Forge your first token</Link>.</p>
        : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((t) => (
              <Link key={t.mint} to="/token/$mint" params={{ mint: t.mint }} className="group border-2 border-border bg-card p-4 hover:border-primary">
                <div className="flex gap-3">
                  {t.image ? <img src={t.image} alt={t.name} className="h-14 w-14 object-cover" /> : <div className="molten h-14 w-14" />}
                  <div><p className="font-display text-xl font-bold group-hover:text-primary">{t.name}</p><p className="text-xs text-accent">${t.symbol}</p></div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Holding {t.held} / {t.supply}</p>
              </Link>
            ))}
          </div>
        )}
    </main>
  );
}
