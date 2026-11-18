/**
 * The jackpot subdomain: wallet sign-in (same "Sign in with Solana" account as the main game), the DC
 * balance, the slot itself (./slot.ts) and the provably-fair panel. All bets go through the payment
 * server (POST /slot/spin); this page never decides a result.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { supabase, rpc } from "../backend/supabase";
import { api } from "../backend/api";
import { playRound, seededRandom, sha256Hex } from "../../../server/src/slot/engine";
import { mountSlot, type SlotConfig, type SlotHandle, type SpinResponse } from "./slot";

const LICENCE = (import.meta.env.VITE_JACKPOT_LICENCE as string | undefined)?.trim() || "";
const MAIN_SITE = (import.meta.env.VITE_MAIN_SITE_URL as string | undefined)?.trim() || "https://audacitygame.xyz";
const DC_PER_USD = 100;

type Phase = "disconnected" | "signing" | "ready" | "error";
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

const CLOSED: SlotConfig = { enabled: false, bets: [10, 20, 50, 100, 200, 500, 1000], buyEnabled: false, buyCostX: 58, maxWinX: 5000 };

/**
 * LOCAL DEMO (VITE_MOCK not "0", or no Supabase): the same engine runs in the browser with play-money DC
 * kept in localStorage. For trying the game locally only; the real game always goes through the server.
 */
const DEMO = (import.meta.env.VITE_MOCK as string | undefined) !== "0" || !supabase;
const DEMO_CFG: SlotConfig = { ...CLOSED, enabled: true, buyEnabled: true };
const DEMO_START = 10_000;
const demoStore = {
  get bal() { try { return Number(localStorage.getItem("aj.demo.bal") ?? DEMO_START); } catch { return DEMO_START; } },
  set bal(v: number) { try { localStorage.setItem("aj.demo.bal", String(v)); } catch { /* private mode */ } },
  pot: 0,
  nonce: 0,
};
const randHex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, "0")).join("");
async function demoSpin(bet: number, buy: boolean): Promise<SpinResponse> {
  const c = DEMO_CFG;
  const cost = buy ? bet * c.buyCostX : bet;
  let bal = demoStore.bal;
  if (cost > bal) throw new Error("Not enough demo DC: tap Refill");
  bal -= cost;
  demoStore.pot += cost * 0.01;
  const serverSeed = randHex(32), clientSeed = randHex(8), nonce = ++demoStore.nonce;
  const round = playRound(seededRandom(serverSeed, clientSeed, nonce), { buy, maxWinX: c.maxWinX });
  const payout = Math.floor(bet * round.totalX * 100) / 100;
  let potPaid = 0;
  if (round.jackpots.includes("GRAND")) {
    potPaid = Math.floor(demoStore.pot * Math.min(1, bet / Math.max(...c.bets)) * 100) / 100;
    demoStore.pot -= potPaid;
  }
  bal += payout + potPaid;
  demoStore.bal = bal;
  await new Promise((r) => setTimeout(r, 120)); // feels like a request
  return { roundId: nonce, bet, cost, round, payout, potPaid, balance: bal, pot: demoStore.pot, fair: { serverSeedHash: sha256Hex(serverSeed), clientSeed, nonce } };
}

async function loadConfig(): Promise<{ cfg: SlotConfig; pot: number }> {
  if (DEMO) return { cfg: DEMO_CFG, pot: demoStore.pot };
  if (!supabase) return { cfg: CLOSED, pot: 0 };
  const [c, s] = await Promise.all([
    supabase.from("slot_config").select("enabled,bets,buy_enabled,buy_cost_x,max_win_x").eq("id", 1).maybeSingle(),
    supabase.from("slot_state").select("pot").eq("id", 1).maybeSingle(),
  ]);
  const row = c.data as { enabled: boolean; bets: (number | string)[]; buy_enabled: boolean; buy_cost_x: number | string; max_win_x: number | string } | null;
  const cfg: SlotConfig = row
    ? { enabled: row.enabled, bets: row.bets.map(Number), buyEnabled: row.buy_enabled, buyCostX: Number(row.buy_cost_x), maxWinX: Number(row.max_win_x) }
    : CLOSED;
  return { cfg, pot: Number((s.data as { pot: number | string } | null)?.pot ?? 0) };
}

/** The wallet behind the saved Supabase session (Web3 identity or sign-in claims). */
async function sessionWallet() {
  const { data } = await supabase!.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  const fromIdentity = u.identities
    ?.map((i) => /^web3:solana:([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec((i as { provider_id?: string }).provider_id ?? "")?.[1])
    .find(Boolean);
  const claims = (u.user_metadata?.custom_claims ?? {}) as { address?: string };
  return fromIdentity ?? claims.address ?? null;
}

export default function Shell() {
  const w = useWallet();
  const { setVisible } = useWalletModal();
  const [phase, setPhase] = useState<Phase>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [adult, setAdult] = useState(() => { try { return localStorage.getItem("aj.adult") === "1"; } catch { return false; } });
  const [fairOpen, setFairOpen] = useState(false);
  const slotEl = useRef<HTMLDivElement>(null);
  const slot = useRef<SlotHandle | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const refreshBalance = useCallback(async () => {
    if (DEMO) {
      setBalance(demoStore.bal);
      slot.current?.setBalance(demoStore.bal);
      return;
    }
    if (!supabase) return;
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return;
    const { data } = await supabase.from("players").select("dc").eq("user_id", uid).maybeSingle();
    const dc = Number((data as { dc: number | string } | null)?.dc ?? 0);
    setBalance(dc);
    slot.current?.setBalance(dc);
  }, []);

  // sign in when a wallet connects (reuses the session if it's the same wallet)
  useEffect(() => {
    if (DEMO || !supabase) return;
    if (!w.connected || !w.publicKey) {
      setPhase("disconnected");
      return;
    }
    const address = w.publicKey.toBase58();
    let cancelled = false;
    (async () => {
      try {
        if ((await sessionWallet()) !== address) {
          await supabase.auth.signOut();
          setPhase("signing");
          const solanaWallet = w.signIn
            ?{ publicKey: w.publicKey, signIn: w.signIn }
            : { publicKey: w.publicKey, signMessage: w.signMessage };
          const { error: e } = await supabase.auth.signInWithWeb3({
            chain: "solana",
            statement: "Sign in to Audacity Game",
            wallet: solanaWallet as never,
            options: { url: `${window.location.origin}/` },
          });
          if (e) throw new Error(e.message);
        }
        await rpc("ensure_player");
        if (cancelled) return;
        setPhase("ready");
        setError(null);
        await refreshBalance();
      } catch (e) {
        if (!cancelled) { setPhase("error"); setError((e as Error).message); }
      }
    })();
    return () => { cancelled = true; };
  }, [w.connected, w.publicKey, w.signIn, w.signMessage, w.wallet, refreshBalance]);

  // the slot itself (plain DOM)
  useEffect(() => {
    if (!adult || !slotEl.current) return;
    let alive = true;
    const el = slotEl.current;
    loadConfig().then(({ cfg, pot }) => {
      if (!alive) return;
      slot.current = mountSlot(el, {
        config: cfg,
        balance: 0,
        pot,
        spin: async (bet, buy) => {
          if (DEMO) return demoSpin(bet, buy);
          if (phaseRef.current !== "ready") {
            setVisible(true);
            throw new Error("Connect your wallet to play");
          }
          return api<SpinResponse>("/slot/spin", { bet, buy });
        },
        onSettled: (r) => setBalance(r.balance),
        onError: () => { refreshBalance().catch(() => undefined); },
      });
      refreshBalance().catch(() => undefined);
    });
    const t = setInterval(() => {
      loadConfig().then(({ cfg, pot }) => { slot.current?.setConfig(cfg); slot.current?.setPot(pot); }).catch(() => undefined);
      if (phaseRef.current === "ready" && !DEMO) refreshBalance().catch(() => undefined);
    }, 20_000);
    return () => { alive = false; clearInterval(t); slot.current?.destroy(); slot.current = null; };
  }, [adult, refreshBalance, setVisible]);

  if (!supabase && !DEMO) return <div className="aj-page"><p className="aj-note">The jackpot isn't configured (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).</p></div>;

  if (DEMO) {
    return (
      <div className="aj-page">
        <header className="aj-top">
          <div className="aj-logo"><span className="a">● AUDACITY</span><span className="j">JACKPOT</span></div>
          <div className="aj-tools">
            <span className="aj-pill demo">LOCAL DEMO · PLAY-MONEY DC</span>
            <span className="aj-pill"><b>{fmt(balance)}</b> DC</span>
            <button className="aj-tb" type="button" onClick={() => { demoStore.bal = DEMO_START; void refreshBalance(); }}>REFILL DEMO</button>
          </div>
        </header>
        {adult ? <div ref={slotEl} /> : (
          <div className="aj-gate" role="dialog" aria-modal="true" aria-labelledby="aj-gate-t">
            <h2 id="aj-gate-t">18+ only</h2>
            <p>Local demo with play-money DC. The live jackpot on the subdomain uses real DC.</p>
            <button className="aj-tb gold" type="button" onClick={() => { try { localStorage.setItem("aj.adult", "1"); } catch { /* ignore */ } setAdult(true); }}>I'M OF LEGAL AGE · ENTER</button>
          </div>
        )}
        <footer className="aj-foot"><span>Local demo: results come from the same engine as the server, but run in this browser. Set VITE_MOCK=0 and Supabase to play against the real server.</span></footer>
      </div>
    );
  }

  return (
    <div className="aj-page">
      <header className="aj-top">
        <div className="aj-logo"><span className="a">● AUDACITY</span><span className="j">JACKPOT</span></div>
        <div className="aj-tools">
          {phase === "ready" && (
            <span className="aj-pill" title="100 DC = 1 USDC">
              <b>{fmt(balance)}</b> DC <i>≈ ${fmt(balance / DC_PER_USD)}</i>
            </span>
          )}
          <a className="aj-tb" href={`${MAIN_SITE}/`} target="_blank" rel="noreferrer">DEPOSIT DC</a>
          <button className="aj-tb" type="button" onClick={() => setFairOpen(true)} disabled={phase !== "ready"}>PROVABLY FAIR</button>
          {w.connected && w.publicKey ? (
            <button className="aj-tb" type="button" onClick={() => { void w.disconnect(); void supabase!.auth.signOut(); }}>
              {phase === "signing" ? "SIGN IN IN YOUR WALLET…" : short(w.publicKey.toBase58())} · DISCONNECT
            </button>
          ) : (
            <button className="aj-tb gold" type="button" onClick={() => setVisible(true)}>CONNECT WALLET</button>
          )}
        </div>
      </header>
      {error && <p className="aj-err">Sign-in failed: {error}</p>}

      {adult ? (
        <div ref={slotEl} />
      ) : (
        <div className="aj-gate" role="dialog" aria-modal="true" aria-labelledby="aj-gate-t">
          <h2 id="aj-gate-t">18+ only</h2>
          <p>Audacity Jackpot is a real-money game: bets and wins are in DC (100 DC = 1 USDC) and DC can be withdrawn.</p>
          <p>Enter only if you are of legal gambling age where you live and online gambling is legal there. Play with money you can afford to lose.</p>
          <button className="aj-tb gold" type="button" onClick={() => { try { localStorage.setItem("aj.adult", "1"); } catch { /* ignore */ } setAdult(true); }}>
            I'M OF LEGAL AGE · ENTER
          </button>
        </div>
      )}

      <footer className="aj-foot">
        {LICENCE && <span>{LICENCE}</span>}
        <span>18+ · Bets and wins in DC (100 DC = 1 USDC) · Theoretical RTP ≈ 89% plus the progressive GRAND pot (≈ 90% in all) · Max win {CLOSED.maxWinX.toLocaleString("en-US")}× bet</span>
        <span>Every round is decided by the server from your seeds and can be verified under Provably fair. Gamble responsibly.</span>
      </footer>

      {fairOpen && <Fairness onClose={() => setFairOpen(false)} />}
    </div>
  );
}

type SeedInfo = { server_seed_hash: string; client_seed: string; nonce: number };
type RoundRow = { id: number; at: string; kind: "spin" | "buy"; status: string; bet: number; cost: number; server_seed_hash: string; client_seed: string; nonce: number; win_x: number | null; payout: number | null; pot_paid: number; jackpot: string | null };
type Revealed = { server_seed: string; server_seed_hash: string; client_seed: string; last_nonce: number };

function Fairness({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<SeedInfo | null>(null);
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [revealed, setRevealed] = useState<Revealed[]>([]);
  const [client, setClient] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<number, string>>({});
  const [maxWinX, setMaxWinX] = useState(CLOSED.maxWinX);

  const load = useCallback(async () => {
    const { cfg } = await loadConfig();
    setMaxWinX(cfg.maxWinX);
    const [i, r, v] = await Promise.all([
      rpc<SeedInfo>("slot_seed_info"),
      supabase!.from("slot_rounds").select("*").order("id", { ascending: false }).limit(20),
      supabase!.from("slot_revealed_seeds").select("server_seed,server_seed_hash,client_seed,last_nonce").order("id", { ascending: false }).limit(50),
    ]);
    setInfo(i);
    setRounds((r.data as RoundRow[]) ?? []);
    setRevealed((v.data as Revealed[]) ?? []);
  }, []);
  useEffect(() => { load().catch((e) => setNote((e as Error).message)); }, [load]);

  const rotate = async () => {
    setBusy(true); setNote(null);
    try {
      await rpc("slot_rotate_seed", { p_client_seed: client.trim() || null });
      setClient("");
      await load();
      setNote("Old server seed revealed. Rounds played with it can be verified below.");
    } catch (e) { setNote((e as Error).message); }
    setBusy(false);
  };

  const verify = (r: RoundRow) => {
    const seed = revealed.find((s) => s.server_seed_hash === r.server_seed_hash);
    if (!seed) return;
    const hashOk = sha256Hex(seed.server_seed) === r.server_seed_hash;
    const replay = playRound(seededRandom(seed.server_seed, r.client_seed, Number(r.nonce)), { buy: r.kind === "buy", maxWinX });
    const winOk = Math.abs(replay.totalX - Number(r.win_x ?? 0)) < 0.0001;
    setChecks((c) => ({ ...c, [r.id]: hashOk && winOk ? `✓ matches (${replay.totalX}× bet)` : `✕ mismatch: replay ${replay.totalX}× · hash ${hashOk ? "ok" : "bad"}` }));
  };

  return (
    <div className="aj-modal" role="dialog" aria-modal="true" aria-labelledby="aj-fair-t" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="aj-mbox">
        <h2 id="aj-fair-t">PROVABLY FAIR <button className="aj-tb" type="button" onClick={onClose}>CLOSE</button></h2>
        <p className="aj-mnote">Each round = HMAC-SHA256(server seed, "client seed:nonce:cursor"). You see the server seed's hash before you bet. Rotate to reveal it, then verify any round played with it.</p>
        {info && (
          <dl className="aj-seeds">
            <dt>Server seed hash</dt><dd><code>{info.server_seed_hash}</code></dd>
            <dt>Client seed</dt><dd><code>{info.client_seed}</code></dd>
            <dt>Next nonce</dt><dd><code>{Number(info.nonce) + 1}</code></dd>
          </dl>
        )}
        <div className="aj-rot">
          <label htmlFor="aj-client">New client seed (optional)</label>
          <input id="aj-client" value={client} maxLength={64} onChange={(e) => setClient(e.target.value.replace(/[^A-Za-z0-9_-]/g, ""))} placeholder="leave empty for a random one" />
          <button className="aj-tb gold" type="button" disabled={busy} onClick={rotate}>ROTATE &amp; REVEAL</button>
        </div>
        {note && <p className="aj-mnote">{note}</p>}
        <h3>YOUR LAST ROUNDS</h3>
        <div className="aj-tablewrap">
          <table className="aj-table">
            <thead><tr><th>#</th><th>Type</th><th>Cost</th><th>Won</th><th>Nonce</th><th>Check</th></tr></thead>
            <tbody>
              {rounds.map((r) => {
                const canVerify = revealed.some((s) => s.server_seed_hash === r.server_seed_hash) && r.status === "settled";
                return (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.kind === "buy" ? "Heist buy" : "Spin"}{r.jackpot ? ` · ${r.jackpot}` : ""}</td>
                    <td>{fmt(Number(r.cost))}</td>
                    <td>{r.status === "settled" ? fmt(Number(r.payout ?? 0) + Number(r.pot_paid ?? 0)) : "settling…"}</td>
                    <td>{r.nonce}</td>
                    <td>{checks[r.id] ?? (canVerify ? <button className="aj-tb" type="button" onClick={() => verify(r)}>VERIFY</button> : <span className="aj-dim">rotate seed first</span>)}</td>
                  </tr>
                );
              })}
              {!rounds.length && <tr><td colSpan={6} className="aj-dim">No rounds yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
