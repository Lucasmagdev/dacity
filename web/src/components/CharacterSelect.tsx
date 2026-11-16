import { useState } from "react";
import Scene from "./Scene";
import Nav from "./Nav";
import ConnectCTA from "./ConnectCTA";
import Portrait from "./Portrait";
import { PROTAGONISTS } from "../config/game";
import { MOCK, useMock } from "../mock";
import { game } from "../game";
import { useWalletAddress } from "./Wallet";

const MIN_NAME = 3;
const MAX_NAME = 24;
const byteLength = (s: string) => new TextEncoder().encode(s).length;

export default function CharacterSelect({ onBack, onEnterHq }: { onBack: () => void; onEnterHq: () => void }) {
  const { connected } = useWalletAddress();
  const [picked, setPicked] = useState<1 | 2 | null>(null);
  const [name, setName] = useState("");

  // Until the Supabase backend exists the gang lives in the browser mock.
  // With the backend: the player signs a message with their wallet and the server stores the gang.
  const mockGang = useMock((s) => s.gang);
  const existing = mockGang && { protagonist: mockGang.protagonist, gangName: mockGang.name };
  const trimmed = name.trim();
  const nameLen = byteLength(trimmed);
  const nameOk = nameLen >= MIN_NAME && nameLen <= MAX_NAME;
  const canSubmit = Boolean(picked && nameOk && (MOCK || connected));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !picked || busy) return;
    setBusy(true);
    setError(null);
    try {
      await game.createGang(picked, trimmed);
      onEnterHq();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (existing) {
    const p = PROTAGONISTS.find((x) => x.id === existing.protagonist) ?? PROTAGONISTS[0];
    return (
      <div className="page select">
        <Scene dim />
        <Nav links={false} onBack={onBack} />
        <div className="select__inner">
          <header className="section__head">
            <p className="eyebrow">Gang founded</p>
            <h2>{existing.gangName}</h2>
            <p className="section__lede">
              Boss: <b style={{ color: p.accent }}>{p.name}</b>. Next up: deposit USDC and open your first boxes.
            </p>
          </header>
          <div className="founded" style={{ "--accent": p.accent } as React.CSSProperties}>
            <div className="founded__art">
              <Portrait protagonist={p} />
            </div>
          </div>
          <div className="cta-wrap" style={{ marginTop: 28 }}>
            <button type="button" className="cta" onClick={onEnterHq}>
              Enter HQ →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page select">
      <Scene dim />
      <Nav links={false} onBack={onBack} />
      <div className="select__inner">
        <header className="section__head">
          <p className="eyebrow">Step 1 of 3</p>
          <h2>Choose your boss</h2>
          <p className="section__lede">Your choice is tied to your wallet and can't be changed later.</p>
        </header>

        <div className="select__grid" role="radiogroup" aria-label="Protagonist">
          {PROTAGONISTS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={picked === p.id}
              className="pick"
              style={{ "--accent": p.accent } as React.CSSProperties}
              onClick={() => setPicked(p.id)}
            >
              <div className="pick__art">
                <Portrait protagonist={p} />
              </div>
              <div className="pick__body">
                <span className="tag">{p.role}</span>
                <h3>{p.name}</h3>
                <p className="boss__alias">{p.alias}</p>
                <p>{p.bio}</p>
              </div>
            </button>
          ))}
        </div>

        <form className="found" onSubmit={submit}>
          <label htmlFor="gang-name">Gang name</label>
          <input
            id="gang-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Los Neon"
            maxLength={MAX_NAME}
            autoComplete="off"
          />
          <p className="hint">
            {MIN_NAME} to {MAX_NAME} characters · {nameLen}/{MAX_NAME}
          </p>

          {MOCK || connected ? (
            <button type="submit" className="cta cta--block" disabled={!canSubmit}>
              {busy ? "Founding gang…" : MOCK ? "Found gang (mock)" : "Found gang"}
            </button>
          ) : (
            <ConnectCTA />
          )}

          {!picked && (connected || MOCK) && (
            <p className="hint">Select {PROTAGONISTS.map((p) => p.name).join(" or ")} above.</p>
          )}
          {error && <p className="note note--error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
