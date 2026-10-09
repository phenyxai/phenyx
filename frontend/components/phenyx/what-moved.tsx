"use client";

import type { MovedPair, YearlyRecapEntry } from "@/lib/constellation";

export const WHAT_MOVED_CLOSING = "none of it is a verdict. it is only the distance.";

export function WhatMoved({
  moved,
  yearlyRecap,
}: {
  moved: MovedPair[];
  yearlyRecap: YearlyRecapEntry[] | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-16 gap-y-11 min-[1100px]:grid-cols-[repeat(auto-fit,minmax(340px,1fr))]">
      <section>
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/52">
          what moved
        </p>
        {moved.length === 0 ? (
          <p className="text-[13px] font-light italic leading-relaxed text-white/35">
            distance will show here as the record lengthens.
          </p>
        ) : (
          <div>
            {moved.map((pair) => (
              <div
                key={pair.label}
                className="flex flex-col items-baseline justify-between gap-1.5 border-b border-white/7 py-[17px] last:border-b-0 min-[700px]:flex-row min-[700px]:gap-6"
              >
                <p className="flex-1 text-[13px] leading-relaxed text-white/50">{pair.label}</p>
                <div className="flex flex-[1.35] flex-wrap items-baseline gap-2.5">
                  <span className="text-[13px] text-white/52">{pair.then}</span>
                  <span className="text-[12px] text-white/52" aria-hidden="true">
                    →
                  </span>
                  <span className="text-[13px] text-white">{pair.now}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3.5 text-[12.5px] leading-relaxed text-white/50">{WHAT_MOVED_CLOSING}</p>
      </section>

      {yearlyRecap && yearlyRecap.length > 0 ? (
        <section>
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/52">
            development timeline
          </p>
          <div className="flex flex-col gap-4">
            {yearlyRecap.map((entry, i) => (
              <div key={`${entry.when}-${i}`} className="flex gap-3">
                <div
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: i === 0 ? "var(--s)" : "rgba(var(--white-rgb), .25)" }}
                />
                <div>
                  <p className="text-[12px] lowercase text-white/40">{entry.when}</p>
                  <p className="text-[13px] font-light leading-relaxed text-white/75">
                    {entry.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
