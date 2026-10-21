import type { ComponentProps, ReactNode } from "react";

/**
 * PHE-129 — one quiet header, in the same place on every tab (Oct 20 demo):
 * a short line on the left, an optional note under it, and the tab's chips on
 * the right (saved discoveries, past conversations, usage). On phones the
 * chips drop under the line.
 */
export function PanelHeader({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-7 flex min-h-9 w-full flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[13px] font-medium leading-[1.4] text-ph-white/62">{title}</h1>
        {sub && <p className="mt-1.5 text-[12px] leading-[1.5] text-ph-white/52">{sub}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-3">{children}</div>}
    </div>
  );
}

/** A header chip: one pill shape for every tab's indicator and icon buttons. */
export function HeaderChip({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={`inline-flex h-[34px] items-center justify-center gap-2 rounded-full border border-ph-white/12 bg-ph-white/[0.02] px-3.5 text-[12.5px] font-medium text-ph-white/68 transition-colors duration-200 hover:border-[rgba(var(--ph-accent-rgb),0.5)] hover:text-ph-white/95 [&_svg]:size-4 ${className}`}
      {...props}
    />
  );
}

export default PanelHeader;
