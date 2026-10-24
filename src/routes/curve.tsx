import { createFileRoute } from "@tanstack/react-router";
import source from "../../programs/kiln/src/lib.rs?raw";

export const Route = createFileRoute("/curve")({
  head: () => ({
    meta: [
      { title: "Bonding curve program — KILN" },
      { name: "description", content: "The KILN Anchor bonding-curve program: buy, sell and Raydium graduation at 85 SOL." },
      { property: "og:title", content: "KILN bonding curve program" },
      { property: "og:description", content: "Open-source Anchor program powering KILN trading." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Curve,
});

function Curve() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <p className="text-xs uppercase tracking-[0.4em] text-accent">Status · awaiting deployment</p>
      <h1 className="mt-3 text-5xl font-extrabold">The <em className="text-primary">curve</em></h1>
      <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
        Constant-product curve (x·y=k) with 30 SOL virtual reserves, 1% fee and graduation to Raydium at 85 SOL.
        Buy and sell open in KILN once this program is deployed to devnet and its address is set in the app.
      </p>
      <ol className="mt-6 space-y-1 text-xs">
        <li>1. <code>anchor init</code>, copy this file to <code>programs/kiln/src/lib.rs</code></li>
        <li>2. Set <code>MIGRATION_AUTHORITY</code>, run <code>anchor keys sync</code></li>
        <li>3. <code>anchor build && anchor deploy --provider.cluster devnet</code></li>
        <li>4. Send the program address to the KILN builder to switch on trading</li>
      </ol>
      <pre className="mt-8 max-h-[70vh] overflow-auto border-2 border-border bg-card p-4 text-[11px] leading-relaxed">{source}</pre>
    </main>
  );
}
