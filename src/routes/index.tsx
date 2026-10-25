import { loadSolana } from "@/lib/load-solana";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Launch } from "@/lib/solana-impl";
import { toast } from "sonner";
import { usePhantom } from "@/hooks/use-phantom";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KILN — fire a real token onto Solana" },
      { name: "description", content: "Connect Phantom and launch a real Token-2022 coin on Solana with on-chain metadata and revoked mint authority." },
      { property: "og:title", content: "KILN — Solana token foundry" },
      { property: "og:description", content: "Launch real Solana tokens from your Phantom wallet. No simulations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Forge,
});

const field = "w-full border border-input bg-background px-3 py-2 text-base text-foreground sm:text-sm outline-none focus:border-primary";

function Forge() {
  const { address, provider, balance, connect, refresh } = usePhantom();
  const [f, setF] = useState({ name: "", symbol: "", image: "", uri: "", description: "", supply: "1000000000", decimals: "6" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ mint: string; signature: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const airdrop = async () => {
    if (!provider?.publicKey) return;
    const s = await loadSolana();
    const t = toast.loading("Requesting devnet SOL…");
    try { await s.requestAirdrop(provider.publicKey); toast.success("Test SOL received", { id: t }); refresh(); }
    catch {
      toast.error("Solana's free faucet is busy. Opening the official faucet — your address is copied, paste it there.", { id: t, duration: 8000 });
      try { await navigator.clipboard.writeText(provider.publicKey.toBase58()); } catch { /* ignore */ }
      window.open("https://faucet.solana.com/", "_blank", "noopener");
    }
  };

  const fire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !address) return connect();
    if (!f.name.trim() || !f.symbol.trim()) return toast.error("Name and symbol are required");
    setBusy(true); setResult(null);
    try {
      const s = await loadSolana();
      const r = await s.launchToken(provider, {
        name: f.name.trim().slice(0, 32), symbol: f.symbol.trim().toUpperCase().slice(0, 10),
        uri: f.uri.trim(), image: f.image.trim(), description: f.description.trim().slice(0, 200),
        supply: Number(f.supply), decimals: Number(f.decimals),
      });
      setResult(r); toast.success("Token fired onto Solana"); refresh();
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      toast.error(/reject/i.test(msg) ? "You declined the signature in Phantom" : /insufficient|0x1\b|debit/i.test(msg) ? "Not enough SOL for rent + fees" : /blockhash/i.test(msg) ? "Blockhash expired — try again" : msg.slice(0, 160));
    } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-12 px-4 py-8">
      <section className="fade-up">
        <p className="text-xs text-muted-foreground">KILN v1.0 · SOLANA DEVNET · TOKEN-2022</p>
        <h1 className="mt-2 text-5xl leading-none text-primary sm:text-7xl">LAUNCH A REAL TOKEN<span className="blink">█</span></h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Signed by your Phantom wallet. Metadata on-chain. Mint authority revoked, no freeze — supply is final.
        </p>
        {address && (
          <button onClick={airdrop} className="mt-3 text-xs text-accent underline">
            &gt; balance {balance?.toFixed(3)} SOL — get free test SOL
          </button>
        )}
      </section>

      <form onSubmit={fire} className="space-y-4 border border-border p-4 sm:p-6">
        <h2 className="text-3xl">&gt; NEW_TOKEN</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="space-y-1 text-xs">NAME<input className={field} maxLength={32} value={f.name} onChange={set("name")} placeholder="Green Screen" /></label>
          <label className="space-y-1 text-xs">SYMBOL<input className={field} maxLength={10} value={f.symbol} onChange={set("symbol")} placeholder="GRN" /></label>
        </div>
        <label className="block space-y-1 text-xs">IMAGE URL<input className={field} value={f.image} onChange={set("image")} placeholder="https://…" /></label>
        {f.image && <img src={f.image} alt="Token art preview" className="h-20 w-20 border border-border object-cover" />}
        <label className="block space-y-1 text-xs">METADATA URI (OPTIONAL)<input className={field} value={f.uri} onChange={set("uri")} placeholder="https://…json" /></label>
        <label className="block space-y-1 text-xs">DESCRIPTION<textarea className={field} rows={2} maxLength={200} value={f.description} onChange={set("description")} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs">SUPPLY<input className={field} type="number" min={1} value={f.supply} onChange={set("supply")} /></label>
          <label className="space-y-1 text-xs">DECIMALS<input className={field} type="number" min={0} max={9} value={f.decimals} onChange={set("decimals")} /></label>
        </div>
        <button disabled={busy} className="w-full bg-primary py-3 font-display text-2xl text-primary-foreground disabled:opacity-50">
          {!address ? "> CONNECT PHANTOM" : busy ? "> SIGNING… CHECK PHANTOM" : "> LAUNCH"}
        </button>
        <p className="text-[11px] text-muted-foreground">Cost ≈ 0.005 devnet SOL.</p>
        {result && (
          <div className="border border-primary p-3 text-xs">
            <p>OK. MINT:</p>
            <p className="break-all">{result.mint}</p>
            <Link to="/token/$mint" params={{ mint: result.mint }} className="mt-2 inline-block text-accent underline">&gt; open token</Link>
          </div>
        )}
      </form>

      <LaunchList key={result?.mint ?? "all"} />
    </main>
  );
}

function LaunchList() {
  const [list, setList] = useState<Launch[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    loadSolana().then((s) => s.fetchLaunches()).then(setList).catch(() => setErr(true));
  }, []);
  return (
    <section className="fade-up-1">
      <h2 className="text-3xl">&gt; ALL LAUNCHES {list && <span className="text-muted-foreground">({list.length})</span>}</h2>
      {err ? <p className="mt-3 text-sm text-destructive">Could not read Solana right now. Refresh to retry.</p>
        : list === null ? <p className="mt-3 text-sm text-muted-foreground">reading chain<span className="blink">…</span></p>
        : list.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No launches yet. Be the first.</p>
        : (
          <ul className="mt-3 divide-y divide-border border border-border">
            {list.map((t) => (
              <li key={t.mint}>
                <Link to="/token/$mint" params={{ mint: t.mint }} className="flex items-center gap-3 p-3 hover:bg-primary hover:text-primary-foreground">
                  {t.image ? <img src={t.image} alt={t.name} className="h-10 w-10 shrink-0 border border-border object-cover" /> : <div className="h-10 w-10 shrink-0 border border-border" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{t.name} <span className="opacity-70">${t.symbol}</span></p>
                    <p className="truncate text-[11px] opacity-70">supply {t.supply} · by {t.creator.slice(0, 4)}…{t.creator.slice(-4)}</p>
                  </div>
                  <span className="hidden text-[11px] opacity-70 sm:block">{t.launchedAt ? new Date(t.launchedAt * 1000).toLocaleDateString() : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
