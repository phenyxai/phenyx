/**
 * PHE-97 — the circular stellar icon: the orbit ring (public/brand/orbit-mark.png,
 * used as a mask) with its star, painted by background-color so it can change
 * color in place. Brand blue on the sign-in screens; `revealed` switches it to
 * the person's accent (welcome reveals it, and it stays that way from there on).
 * The color change eases over 0.9s and is instant under reduced motion (CSS).
 */
export function StellarMark({
  revealed = false,
  size = 19,
}: {
  revealed?: boolean;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="ph-stellar-mark"
      data-revealed={revealed ? "true" : undefined}
      style={{ width: size, height: size }}
    />
  );
}
