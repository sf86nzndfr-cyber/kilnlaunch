import { loadSolana } from "@/lib/load-solana";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { TokenInfo } from "@/lib/solana-impl";

export const Route = createFileRoute("/token/$mint")({
  head: ({ params }) => ({
    meta: [
      { title: `Token ${params.mint.slice(0, 6)}… — MINT.EXE` },
      { name: "description", content: "Live on-chain state of a Solana token minted with MINT.EXE." },
      { property: "og:title", content: "Token on MINT.EXE" },
      { property: "og:description", content: "Live on-chain token state on Solana." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TokenPage,
});

function TokenPage() {
  const { mint } = Route.useParams();
  const [t, setT] = useState<TokenInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ex, setEx] = useState<(k: "address" | "tx", v: string) => string>(() => () => "#");

  useEffect(() => {
    let unsub = () => {};
    loadSolana().then((s) => {
      setEx(() => s.explorer);
      const load = () => s.fetchToken(mint).then(setT).catch(() => setErr("No Token-2022 mint found at this address on devnet."));
      load();
      try { unsub = s.subscribeMint(mint, load); } catch { setErr("Invalid address"); }
    });
    return () => unsub();
  }, [mint]);

  if (err) return <main className="mx-auto max-w-3xl px-4 py-20"><p className="text-destructive">{err}</p><Link to="/" className="text-accent underline">Back to the terminal</Link></main>;
  if (!t) return <main className="mx-auto max-w-3xl px-4 py-20 text-muted-foreground">Reading the chain…</main>;

  const rows: [string, string][] = [
    ["Mint", t.mint], ["Supply", t.supply], ["Decimals", String(t.decimals)],
    ["Mint authority", t.mintAuthority ?? "REVOKED ✓"], ["Freeze authority", t.freezeAuthority ?? "NONE ✓"],
    ["Update authority", t.updateAuthority ?? "—"], ["Metadata URI", t.uri || "—"],
  ];
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 fade-up">
      <div className="flex flex-wrap items-end gap-6">
        {t.image ? <img src={t.image} alt={t.name} className="h-32 w-32 border border-primary object-cover" /> :
          <div className="h-32 w-32 border border-primary" />}
        <div>
          <p className="text-xs text-accent">${t.symbol}</p>
          <h1 className="break-words text-5xl text-primary sm:text-7xl">{t.name}</h1>
          {t.description && <p className="mt-2 max-w-lg text-sm text-muted-foreground">{t.description}</p>}
        </div>
      </div>
      <p className="mt-6 text-[11px] text-success">● live — subscribed to account changes</p>
      <dl className="mt-4 divide-y divide-border border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 p-3 text-xs sm:grid-cols-[180px_1fr]">
            <dt className="text-muted-foreground">{k}</dt><dd className="break-all">{v}</dd>
          </div>
        ))}
      </dl>
      <a href={ex("address", t.mint)} target="_blank" rel="noreferrer" className="mt-6 inline-block bg-primary px-4 py-2 text-xs uppercase text-primary-foreground">&gt; view on solana explorer ↗</a>
    </main>
  );
}
