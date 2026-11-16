/**
 * Gangster Box: the official trunk art (public/boxlogo.jpg), cut out from its background and served
 * from compressed copies in public/token/. `state` drives the CSS animation:
 * idle = bob + glow, still = dimmed (sealing), shake = before opening, open = burst of light.
 */
export default function CashBox({ state = "idle", light = "#ff2e88" }: { state?: "idle" | "shake" | "open" | "still"; light?: string }) {
  return (
    <span className={`cashbox cashbox--${state}`} style={{ "--light": light } as React.CSSProperties} aria-hidden>
      <span className="cashbox__beam" />
      <img
        className="cashbox__body"
        src="/token/box-192.webp"
        srcSet="/token/box-192.webp 192w, /token/box-512.webp 512w"
        sizes="(min-width: 700px) 360px, 192px"
        alt=""
        decoding="async"
        draggable={false}
      />
    </span>
  );
}
