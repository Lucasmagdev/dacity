import { useEffect, useMemo, useState } from "react";
import { renderVaultCam, H, W, type VaultCamData } from "../share/vaultCam";

const X_HANDLE = "@audacitygamesol";

export function shareText(d: VaultCamData) {
  const head =
    d.farmed >= 1
      ? `Caught on the Vault cam 🎥 ${d.gang} has farmed +${Math.round(d.farmed).toLocaleString("en-US")} DC with a crew of ${d.crew}. Day ${d.day}, still farming.`
      : `Caught on the Vault cam 🎥 ${d.gang} just hit the streets with a crew of ${d.crew}. Day ${d.day}, the farm is on.`;
  return `${head}\n\nJoin my gang on ${X_HANDLE} 👇\n${d.link}`;
}

const intentUrl = (text: string) => `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
const isPhone = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Dashboard "Share" modal: renders the Vault Cam GIF and posts it to X. */
export default function ShareFarm({ data, onClose }: { data: VaultCamData; onClose: () => void }) {
  const [gif, setGif] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const text = useMemo(() => shareText(data), [data]);
  const url = useMemo(() => (gif ? URL.createObjectURL(gif) : null), [gif]);
  const fileName = `vault-cam-${data.gang.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.gif`;

  useEffect(() => {
    let live = true;
    renderVaultCam(data).then(
      (b) => live && setGif(b),
      (e) => live && setError((e as Error).message || "Couldn't make the GIF"),
    );
    return () => {
      live = false;
    };
    // render once per opening, with the numbers at that moment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const post = async () => {
    if (!gif) return;
    const file = new File([gif], fileName, { type: "image/gif" });
    // phones: the share sheet attaches the GIF itself, pick X there
    if (isPhone() && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    // computer (or no share sheet): open X with the text, download the GIF to drop into the post
    window.open(intentUrl(text), "_blank", "noopener");
    download(gif, fileName);
    setNote("GIF downloaded. Drag it into your post on X (or click the image icon and pick it).");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setNote("Text copied.");
    } catch {
      window.prompt("Copy your post", text);
    }
  };

  return (
    <div className="reveal sharecam" role="dialog" aria-modal="true" aria-label="Share your farm" style={{ "--rc": "#22e4ff" } as React.CSSProperties} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sharecam__box">
        <button type="button" className="sharecam__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="eyebrow">Share your farm</p>
        <h2>Vault Cam</h2>

        <div className="sharecam__frame" style={{ aspectRatio: `${W} / ${H}` }}>
          {url ? (
            <img src={url} alt={`Vault Cam GIF: ${data.gang} farmed ${Math.round(data.farmed)} DC`} />
          ) : error ? (
            <p className="sharecam__msg">{error}</p>
          ) : (
            <p className="sharecam__msg">
              <span className="acctload__spin" aria-hidden /> Rolling the tape…
            </p>
          )}
        </div>

        <pre className="sharecam__text">{text}</pre>

        <div className="sharecam__actions">
          <button type="button" className="btn btn--cyan btn--block" disabled={!gif} onClick={post}>
            Post on X
          </button>
          <button type="button" className="btn" disabled={!gif} onClick={() => gif && download(gif, fileName)}>
            Download GIF
          </button>
          <button type="button" className="btn" onClick={copy}>
            Copy text
          </button>
        </div>
        {note && (
          <p className="sharecam__note" role="status">
            {note}
          </p>
        )}
        <p className="sharecam__fine">Your invite link is in the post: anyone who founds a gang through it pays you a cut of every deposit they make.</p>
      </div>
    </div>
  );
}
