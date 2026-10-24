import "./buffer-polyfill";
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, clusterApiUrl,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID, ExtensionType, getMintLen, createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction, getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction, createMintToInstruction,
  createSetAuthorityInstruction, AuthorityType, getMint, getTokenMetadata, TYPE_SIZE, LENGTH_SIZE,
} from "@solana/spl-token";
import { createInitializeInstruction, pack, type TokenMetadata } from "@solana/spl-token-metadata";

export const CLUSTER = "devnet" as const;
export const connection = new Connection(clusterApiUrl(CLUSTER), "confirmed");
export { PublicKey, LAMPORTS_PER_SOL };

export type PhantomProvider = {
  isPhantom?: boolean;
  publicKey: PublicKey | null;
  connect: (o?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  on: (ev: string, cb: (a: unknown) => void) => void;
};

export function getPhantom(): PhantomProvider | null {
  const w = window as any;
  const p = w.phantom?.solana ?? w.solana;
  return p?.isPhantom ? p : null;
}

export async function getBalance(pk: PublicKey) {
  return (await connection.getBalance(pk)) / LAMPORTS_PER_SOL;
}

export async function requestAirdrop(pk: PublicKey) {
  // The public devnet faucet often refuses 1 SOL; fall back to a smaller amount.
  let sig: string;
  try { sig = await connection.requestAirdrop(pk, LAMPORTS_PER_SOL); }
  catch { sig = await connection.requestAirdrop(pk, LAMPORTS_PER_SOL / 2); }
  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  return sig;
}

export type LaunchInput = {
  name: string; symbol: string; uri: string; image: string; description: string;
  supply: number; decimals: number;
};

/** Real on-chain Token-2022 launch: mint + embedded metadata, full supply to creator,
 *  freeze authority never set, mint authority revoked in the same transaction. */
export async function launchToken(wallet: PhantomProvider, input: LaunchInput) {
  const payer = wallet.publicKey;
  if (!payer) throw new Error("Wallet not connected");
  const mintKp = Keypair.generate();
  const mint = mintKp.publicKey;
  const metadata: TokenMetadata = {
    mint, updateAuthority: payer, name: input.name, symbol: input.symbol, uri: input.uri,
    additionalMetadata: [
      ...(input.image ? [["image", input.image] as [string, string]] : []),
      ...(input.description ? [["description", input.description] as [string, string]] : []),
    ],
  };
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const metaLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + metaLen);
  const ata = getAssociatedTokenAddressSync(mint, payer, false, TOKEN_2022_PROGRAM_ID);
  const amount = BigInt(Math.floor(input.supply)) * 10n ** BigInt(input.decimals);

  const create = SystemProgram.createAccount({ fromPubkey: payer, newAccountPubkey: mint, space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID });
  // Tag the launch with the KILN registry address (read-only, ignored by the
  // System Program) so every KILN launch can be found on-chain later.
  create.keys.push({ pubkey: KILN_REGISTRY, isSigner: false, isWritable: false });
  const tx = new Transaction().add(
    create,
    createInitializeMetadataPointerInstruction(mint, payer, mint, TOKEN_2022_PROGRAM_ID),
    createInitializeMintInstruction(mint, input.decimals, payer, null, TOKEN_2022_PROGRAM_ID),
    createInitializeInstruction({ programId: TOKEN_2022_PROGRAM_ID, metadata: mint, updateAuthority: payer, mint, mintAuthority: payer, name: input.name, symbol: input.symbol, uri: input.uri }),
    ...metadata.additionalMetadata.map(([k, v]) => updateFieldIx(mint, payer, k, v)),
    createAssociatedTokenAccountIdempotentInstruction(payer, ata, payer, mint, TOKEN_2022_PROGRAM_ID),
    createMintToInstruction(mint, ata, payer, amount, [], TOKEN_2022_PROGRAM_ID),
    createSetAuthorityInstruction(mint, payer, AuthorityType.MintTokens, null, [], TOKEN_2022_PROGRAM_ID),
  );
  const bh = await connection.getLatestBlockhash();
  tx.feePayer = payer;
  tx.recentBlockhash = bh.blockhash;
  // Phantom requires the wallet to sign FIRST; a transaction arriving already
  // signed by another key is flagged by its safety scanner as "Request blocked".
  const signed = await wallet.signTransaction(tx);
  signed.partialSign(mintKp);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  return { mint: mint.toBase58(), signature: sig };
}

function updateFieldIx(mint: PublicKey, auth: PublicKey, key: string, value: string) {
  // lazy import keeps tree small
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return createUpdateField({ programId: TOKEN_2022_PROGRAM_ID, metadata: mint, updateAuthority: auth, field: key, value });
}
import { createUpdateFieldInstruction as createUpdateField } from "@solana/spl-token-metadata";

export type TokenInfo = {
  mint: string; name: string; symbol: string; uri: string; image?: string | undefined; description?: string | undefined;
  supply: string; decimals: number; mintAuthority: string | null; freezeAuthority: string | null;
  updateAuthority: string | null;
};

export async function fetchToken(mintStr: string): Promise<TokenInfo> {
  const mint = new PublicKey(mintStr);
  const [m, md] = await Promise.all([
    getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID),
    getTokenMetadata(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID),
  ]);
  const extra = Object.fromEntries(md?.additionalMetadata ?? []);
  const ui = Number(m.supply) / 10 ** m.decimals;
  return {
    mint: mintStr, name: md?.name ?? "Unknown", symbol: md?.symbol ?? "???", uri: md?.uri ?? "",
    image: extra["image"], description: extra["description"], supply: ui.toLocaleString(), decimals: m.decimals,
    mintAuthority: m.mintAuthority?.toBase58() ?? null, freezeAuthority: m.freezeAuthority?.toBase58() ?? null,
    updateAuthority: md?.updateAuthority?.toBase58() ?? null,
  };
}

export async function fetchHoldings(owner: PublicKey) {
  const res = await connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID });
  const rows = res.value.map((a) => {
    const info = (a.account.data as any).parsed.info;
    return { mint: info.mint as string, amount: info.tokenAmount.uiAmountString as string };
  });
  const out = await Promise.all(rows.map(async (r) => {
    try { return { ...(await fetchToken(r.mint)), held: r.amount }; } catch { return null; }
  }));
  return out.filter(Boolean) as (TokenInfo & { held: string })[];
}

export function subscribeMint(mintStr: string, cb: () => void) {
  const id = connection.onAccountChange(new PublicKey(mintStr), cb, "confirmed");
  return () => { connection.removeAccountChangeListener(id); };
}

export const explorer = (kind: "address" | "tx", v: string) =>
  `https://explorer.solana.com/${kind}/${v}?cluster=${CLUSTER}`;

/** Fixed address every KILN launch transaction references (read-only). */
export const KILN_REGISTRY = new PublicKey("7rBfE2JVq6ZR4DRac7Kvp5F8GLySeg41oLw1xo5kpf1m");

export type Launch = TokenInfo & { launchedAt: number | null; creator: string };

/** Every token launched through KILN, newest first, read straight from Solana. */
export async function fetchLaunches(limit = 60): Promise<Launch[]> {
  const sigs = await connection.getSignaturesForAddress(KILN_REGISTRY, { limit }, "confirmed");
  const ok = sigs.filter((s) => !s.err);
  const txs = await Promise.all(ok.map((s) =>
    connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" }).catch(() => null)));
  const found: { mint: string; creator: string; at: number | null }[] = [];
  txs.forEach((tx, i) => {
    for (const ix of tx?.transaction.message.instructions ?? []) {
      const p = (ix as any).parsed;
      if ((ix as any).program === "system" && p?.type === "createAccount" && p.info.owner === TOKEN_2022_PROGRAM_ID.toBase58()) {
        found.push({ mint: p.info.newAccount, creator: p.info.source, at: ok[i].blockTime ?? null });
      }
    }
  });
  const out = await Promise.all(found.map(async (f) => {
    try { return { ...(await fetchToken(f.mint)), launchedAt: f.at, creator: f.creator }; } catch { return null; }
  }));
  return out.filter(Boolean) as Launch[];
}
