import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Forge,
});

const field = "w-full border-2 border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Forge() {
  const { address, provider, balance, connect, refresh } = usePhantom();
  const [f, setF] = useState({ name: "", symbol: "", image: "", uri: "", description: "", supply: "1000000000", decimals: "6" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ mint: string; signature: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const airdrop = async () => {
    if (!provider?.publicKey) return;
    const s = await import("@/lib/solana-impl");
    const t = toast.loading("Requesting 1 devnet SOL…");
    try { await s.requestAirdrop(provider.publicKey); toast.success("Airdrop landed", { id: t }); refresh(); }
    catch { toast.error("Devnet faucet is rate-limited. Try faucet.solana.com.", { id: t }); }
  };

  const fire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider || !address) return connect();
    if (!f.name.trim() || !f.symbol.trim()) return toast.error("Name and symbol are required");
    setBusy(true); setResult(null);
    try {
      const s = await import("@/lib/solana-impl");
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
    <main className="mx-auto grid max-w-6xl gap-10 px-4 py-12 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative">
        <div className="molten pointer-events-none absolute -inset-x-10 -bottom-20 h-64 opacity-30 blur-2xl" />
        <p className="text-xs uppercase tracking-[0.4em] text-accent">Furnace № 01 · Token-2022</p>
        <h1 className="mt-4 text-6xl font-extrabold leading-[0.9] md:text-8xl">
          Fire it<br /><em className="text-primary">into the</em><br />chain.
        </h1>
        <p className="mt-6 max-w-md text-sm text-muted-foreground">
          Every token forged here is a real Solana mint, signed by your Phantom wallet. Name, symbol and art live
          on-chain. Freeze authority is never set and mint authority is destroyed in the same transaction —
          supply is final the moment it cools.
        </p>
        <ul className="mt-8 space-y-2 text-xs">
          {["Real wallet signature — nothing simulated", "On-chain metadata (Token-2022 extension)", "Mint authority revoked · no freeze", "Full supply delivered to your wallet"].map((x) => (
            <li key={x} className="flex gap-3"><span className="text-primary">▲</span>{x}</li>
          ))}
        </ul>
        {address && (
          <button onClick={airdrop} className="mt-8 border-b border-dashed border-accent text-xs text-accent">
            Low on devnet SOL ({balance?.toFixed(3)})? Get 1 free →
          </button>
        )}
      </section>

      <form onSubmit={fire} className="ember space-y-4 border-2 border-primary bg-card p-6">
        <h2 className="text-2xl font-bold">The mould</h2>
        <div className="grid grid-cols-[2fr_1fr] gap-3">
          <label className="space-y-1 text-xs">Name<input className={field} maxLength={32} value={f.name} onChange={set("name")} placeholder="Molten Moose" /></label>
          <label className="space-y-1 text-xs">Symbol<input className={field} maxLength={10} value={f.symbol} onChange={set("symbol")} placeholder="MOOSE" /></label>
        </div>
        <label className="block space-y-1 text-xs">Image URL<input className={field} value={f.image} onChange={set("image")} placeholder="https://arweave.net/…" /></label>
        {f.image && <img src={f.image} alt="Token art preview" className="h-24 w-24 border-2 border-border object-cover" />}
        <label className="block space-y-1 text-xs">Metadata JSON URI (optional)<input className={field} value={f.uri} onChange={set("uri")} placeholder="https://arweave.net/…json" /></label>
        <label className="block space-y-1 text-xs">Description<textarea className={field} rows={2} maxLength={200} value={f.description} onChange={set("description")} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs">Total supply<input className={field} type="number" min={1} value={f.supply} onChange={set("supply")} /></label>
          <label className="space-y-1 text-xs">Decimals<input className={field} type="number" min={0} max={9} value={f.decimals} onChange={set("decimals")} /></label>
        </div>
        <button disabled={busy} className="w-full bg-primary py-3 text-sm font-bold uppercase tracking-[0.3em] text-primary-foreground disabled:opacity-50">
          {!address ? "Connect Phantom to forge" : busy ? "Firing… check Phantom" : "Fire the kiln"}
        </button>
        <p className="text-[10px] text-muted-foreground">Costs ≈0.005 devnet SOL in rent + fees. Runs on Solana devnet.</p>
        {result && (
          <div className="border-2 border-success p-3 text-xs">
            <p className="text-success">Forged. Mint address:</p>
            <p className="break-all">{result.mint}</p>
            <Link to="/token/$mint" params={{ mint: result.mint }} className="mt-2 inline-block text-accent underline">Open token page →</Link>
          </div>
        )}
      </form>
    </main>
  );
}
