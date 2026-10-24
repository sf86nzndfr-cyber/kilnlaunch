import { Link } from "@tanstack/react-router";
import { usePhantom } from "@/hooks/use-phantom";

export const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export function SiteHeader() {
  const { address, balance, connect, disconnect, installed } = usePhantom();
  return (
    <header className="sticky top-0 z-20 border-b-2 border-border bg-background/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:flex md:gap-6">
        <Link to="/" className="flex min-w-0 items-baseline gap-2">
          <span className="font-display text-3xl font-extrabold italic text-primary">KILN</span>
          <span className="hidden text-[10px] uppercase tracking-[0.3em] text-muted-foreground sm:inline">solana foundry · devnet</span>
        </Link>
        <nav className="col-span-2 row-start-2 flex gap-4 overflow-x-auto whitespace-nowrap text-[11px] md:col-span-1 md:row-start-auto md:text-xs uppercase tracking-widest text-muted-foreground">
          <Link to="/" activeOptions={{ exact: true }} activeProps={{ className: "text-accent" }}>Forge</Link>
          <Link to="/vault" activeProps={{ className: "text-accent" }}>My tokens</Link>
          <Link to="/curve" activeProps={{ className: "text-accent" }}>Curve program</Link>
        </nav>
        <div className="shrink-0 md:ml-auto">
          {address ? (
            <button onClick={disconnect} className="border-2 border-primary px-3 py-1.5 text-xs hover:bg-primary hover:text-primary-foreground">
              {short(address)}<span className="hidden sm:inline"> · {balance?.toFixed(3) ?? "…"} SOL</span>
            </button>
          ) : (
            <button onClick={connect} className="ember bg-primary px-3 py-2 text-[11px] sm:px-4 sm:text-xs font-semibold uppercase tracking-widest text-primary-foreground">
              {installed ? "Connect Phantom" : "Get Phantom"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
