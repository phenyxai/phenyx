"use client";

import type { RecordTimeline } from "@/lib/constellation";

const YEAR_POS = [3, 32, 56, 78, 97];

function yearAt(span: string[], pct: number): string {
  const yrs = span.map(Number).filter((n) => Number.isFinite(n));
  if (yrs.length === 0) return "";
  if (yrs.length === 1) return String(yrs[0]);
  const pos = YEAR_POS.slice(0, yrs.length);
  if (pct <= pos[0]) return String(yrs[0]);
  for (let i = 0; i < pos.length - 1; i++) {
    if (pct <= pos[i + 1]) {
      const f = (pct - pos[i]) / (pos[i + 1] - pos[i]);
      return String(Math.round(yrs[i] + f * (yrs[i + 1] - yrs[i])));
    }
  }
  return String(yrs[yrs.length - 1]);
}

export function RecordTimelineView({ timeline }: { timeline: RecordTimeline }) {
  const hasSpan = timeline.span.length > 0;
  const hasEras = timeline.eras.length > 0;

  return (
    <section className="mb-14">
      <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#FFFDFD]/52">
        your timeline
      </p>
      {timeline.note && (
        <p className="mb-4 max-w-[62ch] text-[13px] font-light leading-relaxed text-[#FFFDFD]/45">
          {timeline.note}
        </p>
      )}

      {!hasSpan && !hasEras ? (
        <p className="text-[13px] font-light italic leading-relaxed text-[#FFFDFD]/35">
          eras have not been named yet. they will appear here from your connected accounts, from the first session.
        </p>
      ) : (
        <>
          {hasEras ? (
            <div className="mt-3.5 overflow-hidden rounded-xl border border-[#FFFDFD]/9">
              <div
                className="overflow-x-auto px-[26px] pb-[18px] pt-[34px]"
                role="img"
                aria-label={axisAlt(timeline)}
              >
                <div className="relative h-[288px] min-w-[720px]">
                  <div
                    className="absolute top-[128px] h-px bg-[rgba(var(--s-rgb),0.35)]"
                    style={{ left: "2%", right: "2%" }}
                  >
                    <i className="absolute top-[-3.5px] left-0 h-2 w-2 rounded-full bg-[var(--s)]" />
                    <i className="absolute top-[-3.5px] left-1/3 h-2 w-2 rounded-full bg-[var(--s)]" />
                    <i className="absolute top-[-3.5px] left-2/3 h-2 w-2 rounded-full bg-[var(--s)]" />
                    <i className="absolute top-[-3.5px] right-0 h-2 w-2 rounded-full bg-[var(--s)]" />
                  </div>
                  {timeline.return_line && (
                    <p className="absolute top-3.5 left-[4%] max-w-[26ch] text-[12px] leading-relaxed text-[#FFFDFD]/55">
                      {timeline.return_line}
                    </p>
                  )}
                  {timeline.eras.map((era) => (
                    <div
                      key={`${era.name}-${era.start}`}
                      className="absolute bottom-[60px] h-px bg-[rgba(var(--s-rgb),0.55)]"
                      style={{ left: `${era.start}%`, width: `${era.width}%` }}
                    >
                      <em className="absolute top-[-24px] left-0 whitespace-nowrap text-[12px] not-italic text-[#FFFDFD]/62">
                        {era.name}
                      </em>
                    </div>
                  ))}
                  {timeline.breaks.map((brk) => (
                    <div
                      key={brk.label}
                      className="absolute top-2 bottom-11 border-l border-dashed border-[#FFFDFD]/22"
                      style={{ left: `${brk.at}%` }}
                    >
                      <b className="absolute top-[-4px] left-2.5 whitespace-nowrap text-[12px] font-normal text-[var(--s)]">
                        {brk.label}
                      </b>
                    </div>
                  ))}
                  <div className="absolute right-0 bottom-11 left-0 h-px bg-[#FFFDFD]/18" />
                  {timeline.span.map((year, i) => (
                    <span
                      key={year}
                      className="absolute bottom-[18px] -translate-x-1/2 text-[12px] tabular-nums text-[#888]"
                      style={{ left: `${YEAR_POS[i] ?? 97}%` }}
                    >
                      {year}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[13px] font-light leading-relaxed text-[#FFFDFD]/45">
              {timeline.span.length === 1
                ? `the record that is here starts in ${timeline.span[0]}. eras have not been named yet.`
                : `the record that is here runs from ${timeline.span[0]} to ${timeline.span[timeline.span.length - 1]}. eras have not been named yet.`}
            </p>
          )}

          {hasEras && (
            <ol className="mt-5 flex flex-col gap-2 min-[700px]:hidden">
              {[
                ...timeline.eras.map((e) => ({
                  kind: "era" as const,
                  at: e.start,
                  name: e.name,
                  span: `${yearAt(timeline.span, e.start)} to ${yearAt(timeline.span, e.start + e.width)}`,
                })),
                ...timeline.breaks.map((b) => ({
                  kind: "break" as const,
                  at: b.at,
                  name: b.label,
                  span: "",
                })),
              ]
                .sort((a, b) => a.at - b.at)
                .map((row) => (
                  <li
                    key={`${row.kind}-${row.name}`}
                    className={`flex justify-between gap-3 text-[13px] ${
                      row.kind === "break" ? "text-[var(--s)]" : "text-[#FFFDFD]/70"
                    }`}
                  >
                    <span>{row.name}</span>
                    {row.span ? (
                      <span className="text-[12px] text-[#FFFDFD]/40">{row.span}</span>
                    ) : null}
                  </li>
                ))}
              {timeline.return_line && (
                <li className="mt-2 text-[12px] text-[#FFFDFD]/50">{timeline.return_line}</li>
              )}
            </ol>
          )}

          {timeline.card && (
            <div className="mt-6 rounded-xl border border-[#FFFDFD]/8 bg-[#FFFDFD]/[0.02] px-5 py-5">
              <span
                className="rounded-full px-3 py-1 text-[12px] lowercase text-[#0A0A0A]"
                style={{ background: "var(--s, #5599FF)" }}
              >
                {timeline.card.tag}
              </span>
              <h4 className="mt-3 text-[15px] font-light leading-relaxed text-[#FFFDFD]/85">
                {timeline.card.line}
              </h4>
              {timeline.card.evidence.length > 0 && (
                <>
                  <p className="mt-4 mb-2 text-[12px] text-[#FFFDFD]/40">what sat around it</p>
                  <ul className="flex flex-col gap-3">
                    {timeline.card.evidence.map((ev) => (
                      <li key={`${ev.when}-${ev.source}`} className="text-[13px] leading-relaxed">
                        <time className="text-[#FFFDFD]/45">{ev.when}</time>
                        <span className="mx-2 text-[11px] lowercase text-[rgba(var(--s-rgb),0.7)]">
                          {ev.source}
                        </span>
                        <p className="mt-0.5 text-[#FFFDFD]/70">{ev.text}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function axisAlt(timeline: RecordTimeline): string {
  const start = timeline.span[0] ?? "";
  const end = timeline.span[timeline.span.length - 1] ?? "";
  const eraBit = timeline.eras.length
    ? `, divided into ${timeline.eras.length} eras`
    : "";
  const breakBit = timeline.breaks.length
    ? ` with ${timeline.breaks.length} turning points: ${timeline.breaks.map((b) => b.label).join(" and ")}`
    : "";
  return `a timeline from ${start} to ${end}${eraBit}${breakBit}.`;
}
