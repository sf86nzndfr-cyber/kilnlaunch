import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { PhantomProvider } from "@/lib/solana-impl";

const sol = () => import("@/lib/solana-impl");

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
    if (!provider) {
      const mobile = /iphone|ipad|android/i.test(navigator.userAgent);
      const here = encodeURIComponent(window.location.href);
      // On phones, reopen KILN inside the Phantom app's built-in browser
      window.location.href = mobile ? `https://phantom.app/ul/browse/${here}?ref=${encodeURIComponent(window.location.origin)}` : "https://phantom.app/";
      return;
    }
    const r = await provider.connect();
    setAddress(r.publicKey.toBase58()); refresh();
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
