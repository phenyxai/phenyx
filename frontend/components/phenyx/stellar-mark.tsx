/**
 * PHE-97 — the circular stellar icon: the orbit ring (public/brand/orbit-mark.png,
 * used as a mask) with its star, painted brand blue by background-color.
 */
export function StellarMark({ size = 19 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="ph-stellar-mark"
      style={{ width: size, height: size }}
    />
  );
}
