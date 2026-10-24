import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { TokenInfo } from "@/lib/solana-impl";

export const Route = createFileRoute("/token/$mint")({
  head: ({ params }) => ({
    meta: [
      { title: `Token ${params.mint.slice(0, 6)}… — KILN` },
      { name: "description", content: "Live on-chain state of a Solana token forged in KILN." },
      { property: "og:title", content: "Token on KILN" },
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
    import("@/lib/solana-impl").then((s) => {
      setEx(() => s.explorer);
      const load = () => s.fetchToken(mint).then(setT).catch(() => setErr("No Token-2022 mint found at this address on devnet."));
      load();
      try { unsub = s.subscribeMint(mint, load); } catch { setErr("Invalid address"); }
    });
    return () => unsub();
  }, [mint]);

  if (err) return <main className="mx-auto max-w-3xl px-4 py-20"><p className="text-destructive">{err}</p><Link to="/" className="text-accent underline">Back to the forge</Link></main>;
  if (!t) return <main className="mx-auto max-w-3xl px-4 py-20 text-muted-foreground">Reading the chain…</main>;

  const rows: [string, string][] = [
    ["Mint", t.mint], ["Supply", t.supply], ["Decimals", String(t.decimals)],
    ["Mint authority", t.mintAuthority ?? "REVOKED ✓"], ["Freeze authority", t.freezeAuthority ?? "NONE ✓"],
    ["Update authority", t.updateAuthority ?? "—"], ["Metadata URI", t.uri || "—"],
  ];
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-end gap-6">
        {t.image ? <img src={t.image} alt={t.name} className="ember h-32 w-32 border-2 border-primary object-cover" /> :
          <div className="molten h-32 w-32 border-2 border-primary" />}
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-accent">${t.symbol}</p>
          <h1 className="text-5xl font-extrabold md:text-7xl">{t.name}</h1>
          {t.description && <p className="mt-2 max-w-lg text-sm text-muted-foreground">{t.description}</p>}
        </div>
      </div>
      <p className="mt-6 text-[10px] uppercase tracking-widest text-success">● live — subscribed to account changes</p>
      <dl className="mt-4 divide-y-2 divide-border border-2 border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 p-3 text-xs sm:grid-cols-[180px_1fr]">
            <dt className="text-muted-foreground">{k}</dt><dd className="break-all">{v}</dd>
          </div>
        ))}
      </dl>
      <a href={ex("address", t.mint)} target="_blank" rel="noreferrer" className="mt-6 inline-block bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground">View on Solana Explorer ↗</a>
      <p className="mt-8 text-xs text-muted-foreground">Buy/sell on a bonding curve unlocks once the KILN curve program is deployed — see <Link to="/curve" className="text-accent underline">Curve program</Link>.</p>
    </main>
  );
}
