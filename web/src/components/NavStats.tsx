import { useEffect, useState, useSyncExternalStore } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import AmmoIcon from "./art/AmmoIcon";
import { TOKEN } from "../config/game";
import { NETWORK, POOL_WALLET, RPC_URL, USDC_MINT, explorerAccount, shortAddr } from "../solana";

// ------------------------------------------------------------------ Reward Pool balance (read from Solana)

const POLL_MS = 60_000;
/** null = loading, NaN = couldn't read it */
let pool: number | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function readPool() {
  if (!POOL_WALLET) return;
  try {
    const conn = new Connection(RPC_URL, "confirmed");
    const res = await conn.getParsedTokenAccountsByOwner(new PublicKey(POOL_WALLET), { mint: new PublicKey(USDC_MINT[NETWORK]) });
    pool = res.value.reduce((t, a) => t + Number(a.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0);
    listeners.forEach((l) => l());
  } catch {
    // RPC hiccup: keep the last value; if there never was one, show "—" instead of loading forever
    if (pool === null) {
      pool = NaN;
      listeners.forEach((l) => l());
    }
  }
}

/** USDC in the Reward Pool wallet. Polls once a minute while something on screen shows it. */
function usePoolUsdc() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      if (!timer) {
        readPool();
        timer = setInterval(readPool, POLL_MS);
      }
      return () => {
        listeners.delete(cb);
        if (!listeners.size && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    () => pool,
  );
}

const usd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: n >= 10_000 ? 0 : 2, maximumFractionDigits: n >= 10_000 ? 0 : 2 })}`;

// ------------------------------------------------------------------ the two pills

function CaPill() {
  const ca = TOKEN.address;
  const [state, setState] = useState<"idle" | "copied" | "soon">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 1800);
    return () => clearTimeout(t);
  }, [state]);

  const click = async () => {
    if (!ca) return setState("soon");
    try {
      await navigator.clipboard.writeText(ca);
      setState("copied");
    } catch {
      window.prompt(`${TOKEN.ticker} contract address`, ca);
    }
  };

  return (
    <button
      type="button"
      className={`navstat navstat--ca${ca ? "" : " navstat--soon"}${state === "copied" ? " is-done" : ""}`}
      onClick={click}
      title={ca ? `Copy the ${TOKEN.ticker} contract address` : `The ${TOKEN.ticker} contract address drops at launch`}
    >
      <AmmoIcon size={18} />
      <span className="navstat__label">CA</span>
      <span className="navstat__value">
        {state === "copied" ? "Copied ✓" : state === "soon" ? "Drops at launch" : ca ? shortAddr(ca) : "Soon"}
      </span>
      <svg className="navstat__copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h8" />
      </svg>
    </button>
  );
}

function PoolPill() {
  const usdc = usePoolUsdc();
  if (!POOL_WALLET) return null;
  return (
    <a
      className="navstat navstat--pool"
      href={explorerAccount(POOL_WALLET)}
      target="_blank"
      rel="noreferrer"
      title="USDC in the Reward Pool right now, read live from Solana. It pays every withdrawal. Click to see the wallet on Solscan."
    >
      <img src="/token/usdc-256.webp" width={18} height={18} alt="" />
      <span className="navstat__label">Reward Pool</span>
      <span className="navstat__value">{usdc === null ? "…" : Number.isNaN(usdc) ? "—" : usd(usdc)}</span>
      <span className="navstat__live" aria-hidden />
    </a>
  );
}

/** In-game top bar: copy the $AMMO contract address + live Reward Pool balance. Wide screens only. */
export default function NavStats() {
  return (
    <div className="navstats" aria-label="Token and pool">
      <CaPill />
      <PoolPill />
    </div>
  );
}
