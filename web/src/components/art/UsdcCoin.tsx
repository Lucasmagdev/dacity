/**
 * USDC logo as a spinning coin with the game's neon-pink rim (Vault card).
 * Source: public/USDC_Logo.png, served from a round compressed copy in public/token/.
 */
export default function UsdcCoin({ size = 120, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <span className={`usdccoin${spin ? " usdccoin--spin" : ""}`} style={{ width: size, height: size }} aria-hidden>
      <img src="/token/usdc-256.webp" width={size} height={size} alt="" decoding="async" draggable={false} />
    </span>
  );
}
