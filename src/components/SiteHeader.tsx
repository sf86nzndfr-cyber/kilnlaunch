import { Link } from "@tanstack/react-router";
import { usePhantom } from "@/hooks/use-phantom";

export const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

export function SiteHeader() {
  const { address, balance, connect, disconnect, installed } = usePhantom();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link to="/" className="font-display text-3xl leading-none text-primary">
          KILN<span className="blink">_</span>
        </Link>
        <nav className="order-3 flex w-full gap-5 text-xs uppercase sm:order-none sm:w-auto">
          <Link to="/" activeOptions={{ exact: true }} className="text-muted-foreground" activeProps={{ className: "!text-primary" }}>[ launch ]</Link>
          <Link to="/vault" className="text-muted-foreground" activeProps={{ className: "!text-primary" }}>[ my tokens ]</Link>
        </nav>
        <div className="ml-auto">
          {address ? (
            <button onClick={disconnect} className="border border-primary px-3 py-1 text-xs hover:bg-primary hover:text-primary-foreground">
              {short(address)}<span className="hidden sm:inline"> · {balance?.toFixed(3) ?? "…"} SOL</span>
            </button>
          ) : (
            <button onClick={connect} className="border border-primary bg-primary px-3 py-1 text-xs uppercase text-primary-foreground">
              {installed ? "> connect phantom" : "> get phantom"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
