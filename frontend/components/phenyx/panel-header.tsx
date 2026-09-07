/**
 * Shared header for the you and settings panels (PHE-95 / v244, prototype
 * `.you-intro`): an accent eyebrow, a light display title, and an optional
 * sub. Sits in a 640px column so it reads with the 820px content below it.
 */
export function PanelHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mb-[clamp(26px,3vw,40px)] max-w-[640px]">
      <p className="mb-[14px] text-[11px] font-semibold tracking-[0.18em] text-[rgba(var(--s-rgb),0.9)] uppercase">
        {eyebrow}
      </p>
      <h1
        className={`text-[clamp(24px,2.6vw,34px)] font-light leading-[1.16] tracking-[-0.02em] text-[rgba(255,253,253,0.96)] ${
          sub ? "mb-3" : ""
        }`}
      >
        {title}
      </h1>
      {sub && (
        <p className="max-w-[52ch] text-[15px] leading-[1.7] text-[rgba(255,253,253,0.6)]">
          {sub}
        </p>
      )}
    </div>
  );
}

export default PanelHeader;
