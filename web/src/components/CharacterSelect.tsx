import { useEffect, useState } from "react";
import type { BaseError } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import Scene from "./Scene";
import Nav from "./Nav";
import ConnectCTA from "./ConnectCTA";
import Portrait from "./Portrait";
import { PROTAGONISTS } from "../config/game";
import { gangAbi, getDeployment } from "../contracts";
import { TARGET_CHAIN } from "../chains";
import { MOCK, mock, useMock } from "../mock";

const MIN_NAME = 3;
const MAX_NAME = 24;
const byteLength = (s: string) => new TextEncoder().encode(s).length;

export default function CharacterSelect({ onBack, onEnterHq }: { onBack: () => void; onEnterHq: () => void }) {
  const { address, isConnected, chainId } = useAccount();
  const onTargetChain = chainId === TARGET_CHAIN.id;
  const gang = getDeployment(chainId)?.gang;

  const [picked, setPicked] = useState<1 | 2 | null>(null);
  const [name, setName] = useState("");

  const boss = useReadContract({
    address: gang,
    abi: gangAbi,
    functionName: "bossOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(gang && address) },
  });

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (receipt.isSuccess) boss.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess]);

  const mockGang = useMock((s) => s.gang);
  const existing = MOCK
    ? mockGang && { protagonist: mockGang.protagonist, gangName: mockGang.name }
    : boss.data && boss.data.createdAt > 0n
      ? boss.data
      : null;
  const trimmed = name.trim();
  const nameLen = byteLength(trimmed);
  const nameOk = nameLen >= MIN_NAME && nameLen <= MAX_NAME;
  const busy = isPending || receipt.isLoading;
  const canSubmit = MOCK ? Boolean(picked && nameOk) : Boolean(isConnected && onTargetChain && gang && picked && nameOk && !busy);
  const error = writeError ?? receipt.error;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (MOCK) {
      if (!canSubmit || !picked) return;
      mock.createGang(picked, trimmed);
      onEnterHq();
      return;
    }
    if (!canSubmit || !gang || !picked) return;
    writeContract({ address: gang, abi: gangAbi, functionName: "createGang", args: [picked, trimmed] });
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
          <p className="section__lede">Your choice is written to the contract and can't be changed later.</p>
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

          {MOCK ? (
            <button type="submit" className="cta cta--block" disabled={!canSubmit}>
              Found gang (mock)
            </button>
          ) : !isConnected || !onTargetChain ? (
            <ConnectCTA />
          ) : !gang ? (
            <p className="note note--warn">
              Contracts not deployed on {TARGET_CHAIN.name} yet. Run the deploy in <code>contracts/</code>.
            </p>
          ) : (
            <button type="submit" className="cta cta--block" disabled={!canSubmit}>
              {isPending ? "Confirm in your wallet…" : receipt.isLoading ? "Founding gang…" : "Found gang"}
            </button>
          )}

          {!picked && (isConnected || MOCK) && <p className="hint">Select Nina or Rico above.</p>}
          {error && <p className="note note--error">{(error as BaseError).shortMessage ?? error.message}</p>}
        </form>
      </div>
    </div>
  );
}
