import { loadSolana } from "@/lib/load-solana";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { PhantomProvider } from "@/lib/solana-impl";

const sol = () => loadSolana();

type Ctx = {
  address: string | null; balance: number | null; installed: boolean;
  provider: PhantomProvider | null;
  connect: () => Promise<void>; disconnect: () => Promise<void>; refresh: () => Promise<void>;
};
const PhantomCtx = createContext<Ctx | null>(null);

export function PhantomProviderRoot({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<PhantomProvider | null>(null);
  const [installed, setInstalled] = useState(true);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const s = await sol();
    const p = s.getPhantom();
    if (p?.publicKey) setBalance(await s.getBalance(p.publicKey));
  }, []);

  useEffect(() => {
    let alive = true;
    sol().then(async (s) => {
      // Phantom's in-app browser injects the provider asynchronously — poll
      // for a few seconds before concluding Phantom is absent, otherwise the
      // connect button wrongly redirects to the store/download page.
      let p: PhantomProvider | null = null;
      for (let i = 0; i < 25 && alive && !p; i++) {
        p = s.getPhantom();
        if (!p) await new Promise((r) => setTimeout(r, 200));
      }
      if (!alive) return;
      setProvider(p); setInstalled(!!p);
      if (!p) return;
      p.on("connect", () => { setAddress(p.publicKey?.toBase58() ?? null); refresh(); });
      p.on("disconnect", () => { setAddress(null); setBalance(null); });
      p.on("accountChanged", (pk) => { setAddress(pk ? String((pk as any).toBase58()) : null); refresh(); });
      try { await p.connect({ onlyIfTrusted: true }); } catch { /* not trusted yet */ }
    });
    return () => { alive = false; };
  }, [refresh]);

  const connect = async () => {
    // Everything up to the redirect must stay synchronous: iOS only hands a
    // link to the Phantom app when it happens directly inside the tap. Any
    // `await` before it (e.g. loading the Solana module) makes the tap dead.
    const w = window as any;
    const injected = w.phantom?.solana ?? w.solana;
    const live: PhantomProvider | null = provider ?? (injected?.isPhantom ? injected : null);
    if (!live) {
      const mobile = /iphone|ipad|ipod|android/i.test(navigator.userAgent);
      // Inside the editor preview the site runs in a frame; send Phantom the
      // real site address, not the frame's internal one.
      const framed = window.self !== window.top;
      const target = framed ? "https://kilnlaunch.lovable.app/" : window.location.href;
      const url = mobile
        ? `https://phantom.com/ul/browse/${encodeURIComponent(target)}?ref=${encodeURIComponent(new URL(target).origin)}`
        : "https://phantom.com/download";
      if (framed || !mobile) {
        // Frames can't navigate to apps; open a fresh top-level tab instead.
        const opened = window.open(url, "_blank", "noopener");
        if (!opened && mobile) window.location.href = url;
      } else {
        window.location.href = url;
      }
      return;
    }
    if (!provider) setProvider(live);
    try {
      const r = await live.connect();
      setAddress(r.publicKey.toBase58()); refresh();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      toast.error(/reject|denied|cancel/i.test(msg) ? "Connection declined in Phantom" : `Phantom: ${msg.slice(0, 140)}`);
    }
  };
  const disconnect = async () => { await provider?.disconnect(); };

  return (
    <PhantomCtx.Provider value={{ address, balance, installed, provider, connect, disconnect, refresh }}>
      {children}
    </PhantomCtx.Provider>
  );
}

export function usePhantom() {
  const c = useContext(PhantomCtx);
  if (!c) throw new Error("usePhantom outside provider");
  return c;
}
