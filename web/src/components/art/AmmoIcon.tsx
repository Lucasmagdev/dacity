/**
 * $AMMO token logo (public/tokenlogo.png), served from round, compressed copies in public/token/.
 * Picks the smallest file that stays sharp on retina screens.
 */
export default function AmmoIcon({ size = 18 }: { size?: number }) {
  const file = size <= 32 ? 64 : size <= 64 ? 128 : 512;
  return (
    <img
      className="ammoicon"
      src={`/token/ammo-${file}.webp`}
      width={size}
      height={size}
      alt=""
      aria-hidden
      decoding="async"
      draggable={false}
    />
  );
}
