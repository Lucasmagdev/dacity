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
import { PAYS, RULES, playRound, seededRandom, sha256Hex } from "../../../server/src/slot/engine";
import { mountSlot, type SlotConfig, type SlotHandle, type SpinResponse } from "./slot";

const LICENCE = (import.meta.env.VITE_JACKPOT_LICENCE as string | undefined)?.trim() || "";
const MAIN_SITE = (import.meta.env.VITE_MAIN_SITE_URL as string | undefined)?.trim() || "https://audacitygame.xyz";
const DC_PER_USD = 100;

type Phase = "disconnected" | "signing" | "ready" | "error";
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

const CLOSED: SlotConfig = { enabled: false, bets: [10, 20, 50, 100], buyEnabled: false, buyCostX: 58, maxWinX: 2500 };

/**
 * LOCAL DEV ONLY (`npm run dev` with VITE_MOCK not "0", or no Supabase): the same engine runs in the browser
 * with test DC that resets on every reload, so the screen can be checked without the server. Never in a
 * production build: there every round goes through the server.
 */
/** Standalone free-play site (its own Vercel project): VITE_CASINO_DEMO=1 at build time. No wallet, no database. */
const STANDALONE_DEMO = (import.meta.env.VITE_CASINO_DEMO as string | undefined) === "1";
const UNIT = STANDALONE_DEMO ? "$CASINO" : "DC";
const DEMO = STANDALONE_DEMO || (import.meta.env.DEV && ((import.meta.env.VITE_MOCK as string | undefined) !== "0" || !supabase));
const DEMO_CFG: SlotConfig = { ...CLOSED, enabled: true, buyEnabled: true };
const DEMO_START = 10_000;
// the standalone site opens with an empty balance (0 $CASINO); REFILL tops it up with play money
const demoStore = { bal: STANDALONE_DEMO ? 0 : DEMO_START, pot: 0, nonce: 0 };
const randHex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => x.toString(16).padStart(2, "0")).join("");

async function demoSpin(bet: number, buy: boolean, c: SlotConfig = DEMO_CFG): Promise<SpinResponse> {
  const cost = buy ? bet * c.buyCostX : bet;
  let bal = demoStore.bal;
  if (cost > bal) throw new Error("Not enough DC");
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
  // the standalone free-play site has no entry screen
  const [adult, setAdult] = useState(() => { if (STANDALONE_DEMO) return true; try { return localStorage.getItem("aj.adult") === "1"; } catch { return false; } });
  const [fairOpen, setFairOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [cfgNow, setCfgNow] = useState<SlotConfig>(DEMO ? DEMO_CFG : CLOSED);
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

  // Sign in once per connected wallet. The wallet adapter re-creates its functions on every state change, so
  // they live in a ref and never re-trigger this: one signature request at a time, no loop. A rejected
  // request is NOT retried by itself; the player taps "Sign in" again.
  const walletRef = useRef(w);
  walletRef.current = w;
  const signingFor = useRef<string | null>(null);
  const address = w.connected && w.publicKey ? w.publicKey.toBase58() : null;

  const signIn = useCallback(async () => {
    if (DEMO || !supabase) return;
    const cur = walletRef.current;
    if (!cur.connected || !cur.publicKey) return;
    const addr = cur.publicKey.toBase58();
    if (signingFor.current === addr) return;
    signingFor.current = addr;
    setError(null);
    try {
      if ((await sessionWallet()) !== addr) {
        await supabase.auth.signOut();
        setPhase("signing");
        const solanaWallet = cur.signIn
          ? { publicKey: cur.publicKey, signIn: cur.signIn }
          : { publicKey: cur.publicKey, signMessage: cur.signMessage };
        const { error: e } = await supabase.auth.signInWithWeb3({
          chain: "solana",
          statement: "Sign in to Audacity Game",
          wallet: solanaWallet as never,
          options: { url: `${window.location.origin}/` },
        });
        if (e) throw new Error(e.message);
      }
      await rpc("ensure_player");
      if (walletRef.current.publicKey?.toBase58() !== addr) return; // switched wallets meanwhile
      setPhase("ready");
      await refreshBalance();
    } catch (e) {
      if (walletRef.current.publicKey?.toBase58() !== addr) return;
      setPhase("error");
      const m = (e as Error).message || "Sign-in failed";
      setError(/reject|denied|cancel/i.test(m) ? "You cancelled the signature. Tap SIGN IN to try again." : `Sign-in failed: ${m}`);
    } finally {
      if (signingFor.current === addr) signingFor.current = null;
    }
  }, [refreshBalance]);

  useEffect(() => {
    if (DEMO || !supabase) return;
    if (!address) {
      setPhase("disconnected");
      setError(null);
      return;
    }
    void signIn();
  }, [address, signIn]);

  // the slot itself (plain DOM)
  useEffect(() => {
    if (!adult || !slotEl.current) return;
    let alive = true;
    const el = slotEl.current;
    loadConfig().then(({ cfg, pot }) => {
      if (!alive) return;
      setCfgNow(cfg);
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
      loadConfig().then(({ cfg, pot }) => { setCfgNow(cfg); slot.current?.setConfig(cfg); slot.current?.setPot(pot); }).catch(() => undefined);
      if (phaseRef.current === "ready" && !DEMO) refreshBalance().catch(() => undefined);
    }, 20_000);
    return () => { alive = false; clearInterval(t); slot.current?.destroy(); slot.current = null; };
  }, [adult, refreshBalance, setVisible]);

  if (!supabase && !DEMO) return <div className="aj-page"><p className="aj-note">The jackpot isn't configured (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).</p></div>;

  if (DEMO) {
    return (
      <div className="aj-page">
        <header className="aj-top">
          <div className="aj-logo"><img className="aj-emb" src="/jackpot/logo-a.png" alt="" /><span className="a">VICECITY</span><span className="j">CASINO</span></div>
          <div className="aj-tools">
            <span className="aj-pill demo" title="Play money: no real value"><b>{fmt(balance)}</b> $CASINO</span>
            <button className="aj-tb" type="button" onClick={() => { demoStore.bal = DEMO_START; void refreshBalance(); }}>REFILL</button>
            {/* demo wallet: only reads the address to show it. Nothing is signed, sent or charged. */}
            {w.connected && w.publicKey ? (
              <button className="aj-tb" type="button" title="Demo: the wallet is only used to show your address" onClick={() => void w.disconnect()}>
                {short(w.publicKey.toBase58())} · DISCONNECT
              </button>
            ) : (
              <button className="aj-tb gold" type="button" onClick={() => setVisible(true)}>
                {w.connecting ? "CONNECTING…" : "CONNECT WALLET"}
              </button>
            )}
          </div>
        </header>
        <p className="aj-demo-note">
          <b>FREE PLAY DEMO</b> · the $CASINO balance here is play money with no value. Nothing can be bought, won or withdrawn.
          {w.connected && " Your wallet is only connected to show your address: nothing is signed or charged."}
        </p>
        {adult ? <div ref={slotEl} /> : (
          <div className="aj-gate" role="dialog" aria-modal="true" aria-labelledby="aj-gate-t">
            <h2 id="aj-gate-t">18+ only</h2>
            <p>This is a free demo of a casino-style slot, played with credits that have no value. No real money is involved.</p>
            <p>The content is meant for adults only.</p>
            <button className="aj-tb gold" type="button" onClick={() => { try { localStorage.setItem("aj.adult", "1"); } catch { /* ignore */ } setAdult(true); }}>I'M 18+ · ENTER</button>
          </div>
        )}
        <footer className="aj-foot">
          <span>18+ · Free play demo with credits that have no value · Theoretical RTP ≈ 89% plus the progressive GRAND pot (≈ 90% in all) · Max win {cfgNow.maxWinX.toLocaleString("en-US")}× bet</span>
          <span>Results come from the same provably-fair engine as a real round, run in your browser.</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="aj-page">
      <header className="aj-top">
        <div className="aj-logo"><img className="aj-emb" src="/jackpot/logo-a.png" alt="" /><span className="a">VICECITY</span><span className="j">CASINO</span></div>
        <div className="aj-tools">
          {phase === "ready" && (
            <span className="aj-pill" title="100 DC = 1 USDC">
              <b>{fmt(balance)}</b> CASINO <i>≈ ${fmt(balance / DC_PER_USD)}</i>
            </span>
          )}
          <a className="aj-tb" href={`${MAIN_SITE}/`} target="_blank" rel="noreferrer">DEPOSIT DC</a>
                    <button className="aj-tb" type="button" onClick={() => setFairOpen(true)}>PROVABLY FAIR</button>
          {w.connected && w.publicKey ? (
            <>
              {phase === "error" && (
                <button className="aj-tb gold" type="button" onClick={() => void signIn()}>SIGN IN</button>
              )}
              <button className="aj-tb" type="button" onClick={() => { void w.disconnect(); void supabase!.auth.signOut(); }}>
                {phase === "signing" ? "APPROVE IN YOUR WALLET…" : short(w.publicKey.toBase58())} · DISCONNECT
              </button>
            </>
          ) : (
            <button className="aj-tb gold" type="button" onClick={() => setVisible(true)}>CONNECT WALLET</button>
          )}
        </div>
      </header>
      {error && <p className="aj-err">{error}</p>}

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
        <span>18+ · Bets and wins in DC (100 DC = 1 USDC) · Theoretical RTP ≈ 89% plus the progressive GRAND pot (≈ 90% in all) · Max win {cfgNow.maxWinX.toLocaleString("en-US")}× bet</span>
        <span>Every round is decided by the server from your seeds and can be verified under Provably fair. Gamble responsibly.</span>
      </footer>

      {fairOpen && <Fairness signedIn={phase === "ready"} onClose={() => setFairOpen(false)} />}
      {howOpen && <HowToPlay cfg={cfgNow} onClose={() => setHowOpen(false)} />}
    </div>
  );
}

type SeedInfo = { server_seed_hash: string; client_seed: string; nonce: number };
type RoundRow = { id: number; at: string; kind: "spin" | "buy"; status: string; bet: number; cost: number; server_seed_hash: string; client_seed: string; nonce: number; win_x: number | null; payout: number | null; pot_paid: number; jackpot: string | null };
type Revealed = { server_seed: string; server_seed_hash: string; client_seed: string; last_nonce: number };

function Fairness({ signedIn, onClose }: { signedIn: boolean; onClose: () => void }) {
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
    if (!signedIn) return;
    const [i, r, v] = await Promise.all([
      rpc<SeedInfo>("slot_seed_info"),
      supabase!.from("slot_rounds").select("*").order("id", { ascending: false }).limit(20),
      supabase!.from("slot_revealed_seeds").select("server_seed,server_seed_hash,client_seed,last_nonce").order("id", { ascending: false }).limit(50),
    ]);
    setInfo(i);
    setRounds((r.data as RoundRow[]) ?? []);
    setRevealed((v.data as Revealed[]) ?? []);
  }, [signedIn]);
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
        <p className="aj-mnote">The result of every round is fixed before you bet, and nobody can change it afterwards: not the game, not you.</p>
        <ol className="aj-steps">
          <li><b>Before you bet</b> you see the <b>hash</b> of the server seed (a fingerprint of a secret number). The secret itself stays hidden, so nobody can predict the next round.</li>
          <li><b>Each round</b> = HMAC-SHA256(server seed, "client seed:nonce:cursor"). The client seed is yours (you can pick it) and the nonce counts your rounds: 1, 2, 3…</li>
          <li><b>Rotate &amp; reveal</b> shows the old server seed and starts a new pair. Check it matches the hash you saw, then press <b>Verify</b> on any round played with it: your browser replays it with the same engine and must get the exact same win.</li>
        </ol>
        {!signedIn && <p className="aj-mnote"><b>Connect your wallet</b> to see your seeds and verify your own rounds.</p>}
        {signedIn && info && (
          <dl className="aj-seeds">
            <dt>Server seed hash</dt><dd><code>{info.server_seed_hash}</code></dd>
            <dt>Client seed</dt><dd><code>{info.client_seed}</code></dd>
            <dt>Next nonce</dt><dd><code>{Number(info.nonce) + 1}</code></dd>
          </dl>
        )}
        {signedIn && <>
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
        </>}
      </div>
    </div>
  );
}

const SYM_ORDER = ["coin", "red", "papa", "lil", "rifle", "smg", "pistol", "vest", "medkit"] as const;
const xs = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}×`;

/** The rules, read from the engine and the live config, so the numbers here are always the real ones. */
function HowToPlay({ cfg, onClose }: { cfg: SlotConfig; onClose: () => void }) {
  const jackpots = [...RULES.jackpots].sort((a, b) => b.min - a.min);
  const minBet = Math.min(...cfg.bets);
  const maxBet = Math.max(...cfg.bets);
  const mults = RULES.multVals;
  return (
    <div className="aj-modal" role="dialog" aria-modal="true" aria-labelledby="aj-how-t" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="aj-mbox">
        <h2 id="aj-how-t">HOW TO PLAY <button className="aj-tb" type="button" onClick={onClose}>CLOSE</button></h2>

        <h3>THE BASICS</h3>
        <ul className="aj-steps">
          {STANDALONE_DEMO ? (
            <li>This is a <b>free demo</b>: balances are play money with no real value. Press <b>REFILL</b> to get play $CASINO.</li>
          ) : (
            <li>Connect your wallet and sign in once (free, no transaction). You play with your <b>DC from Audacity Game</b>: 100 DC = 1 USDC. Need more? <b>Deposit DC</b> on the main site.</li>
          )}
          <li>Pick your bet with <b>−</b> / <b>+</b> ({minBet} to {maxBet} {UNIT}) and press <b>SPIN</b> (or the space bar).</li>
          <li>The grid is 6 × 5. <b>8 or more of the same symbol anywhere</b> pays: no lines, no order.</li>
          <li>Winning symbols explode and new ones <b>tumble</b> in. Every new win pays too, until nothing else lines up.</li>
        </ul>

        <h3>PAYTABLE · × YOUR BET</h3>
        <div className="aj-tablewrap">
          <table className="aj-table">
            <thead><tr><th>Symbol</th><th>8–9</th><th>10–11</th><th>12+</th></tr></thead>
            <tbody>
              {SYM_ORDER.map((id) => (
                <tr key={id}><td>{PAYS[id].name}</td><td>{xs(PAYS[id].pay[0])}</td><td>{xs(PAYS[id].pay[1])}</td><td>{xs(PAYS[id].pay[2])}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3>MULTIPLIERS</h3>
        <ul className="aj-steps">
          <li>Multipliers from {xs(mults[0])} up to {xs(mults[mults.length - 1])} can land on any spin. When the tumbles end, if the spin won, every multiplier on the grid is <b>added up</b> and multiplies the win.</li>
        </ul>

        <h3>THE HEIST · FREE SPINS</h3>
        <ul className="aj-steps">
          <li><b>4 or more Banks</b> anywhere start <b>The Heist</b>: {RULES.heistSpins} free spins. The banks also pay {xs(RULES.scatterPay[4])} (4), {xs(RULES.scatterPay[5])} (5) or {xs(RULES.scatterPay[6])} (6+) your bet.</li>
          <li><b>Heat stacks</b> during The Heist: every multiplier that lands on a winning spin is added to the Heat, and each win is multiplied by the total Heat so far. It only resets when The Heist ends.</li>
          <li><b>3 or more Banks</b> during The Heist give <b>+{RULES.retrigger} free spins</b>.</li>
        </ul>

        <h3>BUY THE HEIST · BONUS BUY</h3>
        <ul className="aj-steps">
          {cfg.buyEnabled ? (
            <li>Don't want to wait for the banks? <b>Buy the Heist</b> starts it right away for <b>{cfg.buyCostX}× your bet</b> ({xs(cfg.buyCostX)} {minBet} {UNIT} = {(cfg.buyCostX * minBet).toLocaleString("en-US")} {UNIT} at the smallest bet). Tap once to arm it, again to confirm. Same rules as a Heist you trigger.</li>
          ) : (
            <li>Buying the Heist is turned off right now.</li>
          )}
        </ul>

        <h3>VAULT JACKPOTS</h3>
        <div className="aj-tablewrap">
          <table className="aj-table">
            <thead><tr><th>Jackpot</th><th>Vaults on the grid</th><th>Pays</th></tr></thead>
            <tbody>
              {jackpots.map((j) => (
                <tr key={j.id}><td>{j.id}</td><td>{j.min}{j.id === "GRAND" ? "+" : ""}</td><td>{xs(j.x)} your bet{j.id === "GRAND" ? " + the GRAND pot" : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="aj-steps">
          <li>What counts is the number of <b>Vaults left on the grid</b> after the tumbles (the counter on the left shows it). One jackpot per spin: the biggest one reached. Free spins can hit jackpots too.</li>
          <li>The <b>GRAND pot</b> grows with 1% of every bet. GRAND pays a share of it: your bet ÷ {maxBet} {UNIT} (the biggest bet), so the whole pot at the biggest bet.</li>
        </ul>

        <h3>BUTTONS</h3>
        <ul className="aj-steps">
          <li><b>AUTO 25</b>: plays 25 spins in a row at your bet. Press it again (or STOP) to stop any time. It also stops if your balance runs out.</li>
          <li><b>TURBO</b>: faster animations. The results are exactly the same.</li>
          <li><b>SOUND</b>: music and effects on or off.</li>
          <li><b>PROVABLY FAIR</b>: your seeds, and a check of any round you played.</li>
        </ul>

        <h3>LIMITS &amp; ODDS</h3>
        <ul className="aj-steps">
          <li>Max win per round: <b>{xs(cfg.maxWinX)} your bet</b> (the GRAND pot share comes on top).</li>
          <li>Theoretical return to player (RTP): about <b>89%</b>, plus about 1% back through the GRAND pot (≈ 90% in all). It's an average over a huge number of rounds: any session can end up or down.</li>
          <li>18+ only. Play only with money you can afford to lose.</li>
        </ul>
      </div>
    </div>
  );
}
