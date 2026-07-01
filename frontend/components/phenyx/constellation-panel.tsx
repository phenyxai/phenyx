"use client";

// PHE-28 — Constellation detail panel (the 320px right column).
//
// Three states, driven entirely by `selectedPillar`:
//   - null              → default: "tap any node to explore" + IDENTITY PORTRAIT
//                         + a clickable pillars summary.
//   - a locked pillar   → a single static card, no per-user fetch.
//   - an active pillar  → node-detail: pill + count, synthesis, sources, and the
//                         OBSERVATIONS OVER TIME timeline (free = 2 + teasers).

import { useTier } from "@/lib/use-tier";
import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import {
  ALL_PILLARS,
  isLockedPillar,
  pillarLabel,
  relativeTime,
  type ConstellationData,
  type Pillar,
  type PillarDetail,
} from "@/lib/constellation";

const FREE_VISIBLE_ENTRIES = 2;

export interface ConstellationPanelProps {
  data: ConstellationData;
  selectedPillar: Pillar | null;
  onSelectPillar: (pillar: Pillar) => void;
  onBack: () => void;
}

export function ConstellationPanel({
  data,
  selectedPillar,
  onSelectPillar,
  onBack,
}: ConstellationPanelProps) {
  if (selectedPillar && isLockedPillar(selectedPillar)) {
    return <LockedCard onBack={onBack} />;
  }
  if (selectedPillar) {
    return (
      <NodeDetail
        stellar={data.stellar_color}
        detail={data.pillars[selectedPillar]}
        onBack={onBack}
      />
    );
  }
  return (
    <DefaultView
      data={data}
      onSelectPillar={onSelectPillar}
    />
  );
}

// ---------------------------------------------------------------------------
// Default view
// ---------------------------------------------------------------------------

function DefaultView({
  data,
  onSelectPillar,
}: {
  data: ConstellationData;
  onSelectPillar: (pillar: Pillar) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-[13px] font-light lowercase text-[#FFFDFD]/45">
        tap any node to explore
      </p>

      <section>
        <SectionLabel>identity portrait</SectionLabel>
        {data.portrait ? (
          <p className="text-[14px] font-light leading-relaxed text-[#FFFDFD]/80">
            {data.portrait}
          </p>
        ) : (
          <p className="text-[13px] font-light italic text-[#FFFDFD]/30">
            forming.
          </p>
        )}
      </section>

      <section>
        <SectionLabel>pillars</SectionLabel>
        <ul className="flex flex-col">
          {ALL_PILLARS.map((pillar) => {
            const detail = data.pillars[pillar];
            const clickable = detail.active;
            return (
              <li key={pillar}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onSelectPillar(pillar)}
                  className={`flex w-full items-center justify-between gap-3 border-b border-[#FFFDFD]/6 py-3 text-left transition-colors motion-reduce:transition-none ${
                    clickable
                      ? "cursor-pointer hover:text-[#FFFDFD]"
                      : "cursor-default"
                  }`}
                >
                  <span
                    className={`flex items-center gap-2 text-[13px] font-light lowercase ${
                      detail.active ? "text-[#FFFDFD]/75" : "text-[#FFFDFD]/30"
                    }`}
                  >
                    {pillarLabel(pillar)}
                    {detail.active && detail.has_new && (
                      <PulsingDot color={data.stellar_color} />
                    )}
                  </span>
                  <span className="text-[12px] font-light tabular-nums text-[#FFFDFD]/35">
                    {detail.observation_count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node detail (active pillar)
// ---------------------------------------------------------------------------

function NodeDetail({
  stellar,
  detail,
  onBack,
}: {
  stellar: string;
  detail: PillarDetail;
  onBack: () => void;
}) {
  const { isPro } = useTier();
  const { openModal } = useSettingsModals();

  const timeline = detail.timeline;
  const hasSources =
    detail.source_platforms.length > 0 || Boolean(detail.source_insight);

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-[12px] font-light lowercase text-[#FFFDFD]/45 transition-colors hover:text-[#FFFDFD]/80 motion-reduce:transition-none"
      >
        ← all pillars
      </button>

      {/* Pillar header: colored pill + observation count. */}
      <div className="flex items-center justify-between gap-3">
        <span
          className="rounded-full px-3 py-1 text-[12px] lowercase text-[#0A0A0A]"
          style={{ background: stellar }}
        >
          {pillarLabel(detail.pillar)}
        </span>
        <span className="text-[12px] font-light tabular-nums text-[#FFFDFD]/40">
          {detail.observation_count}{" "}
          {detail.observation_count === 1 ? "observation" : "observations"}
        </span>
      </div>

      {/* Synthesis. */}
      {detail.synthesis ? (
        <p className="text-[14px] font-light leading-relaxed text-[#FFFDFD]/80">
          {detail.synthesis}
        </p>
      ) : (
        <p className="text-[13px] font-light italic text-[#FFFDFD]/30">
          forming.
        </p>
      )}

      {/* Sources block. */}
      {hasSources && (
        <section>
          <SectionLabel>sources</SectionLabel>
          {detail.source_platforms.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {detail.source_platforms.map((platform) => (
                <span
                  key={platform}
                  className="rounded-full border border-[#FFFDFD]/12 px-2.5 py-0.5 text-[11px] lowercase text-[#FFFDFD]/55"
                >
                  {platform}
                </span>
              ))}
            </div>
          )}
          {detail.source_insight && (
            <p className="text-[13px] font-light leading-relaxed text-[#FFFDFD]/60">
              {detail.source_insight}
            </p>
          )}
        </section>
      )}

      {/* Observations over time. */}
      <section>
        <SectionLabel>observations over time</SectionLabel>
        {timeline.length === 0 ? (
          <p className="text-[13px] font-light italic text-[#FFFDFD]/30">
            no observations yet.
          </p>
        ) : (
          <ol className="flex flex-col gap-4">
            {timeline.map((entry, index) => {
              const unlocked =
                (isPro || index < FREE_VISIBLE_ENTRIES) && entry.body != null;
              return (
                <li key={entry.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-light lowercase text-[#FFFDFD]/35">
                      {relativeTime(entry.surfaced_at)}
                    </span>
                    {index === 0 && (
                      <span
                        className="text-[10px] font-medium uppercase tracking-[0.15em]"
                        style={{ color: stellar }}
                      >
                        new signal
                      </span>
                    )}
                  </div>
                  {unlocked ? (
                    <p className="text-[13px] font-light leading-relaxed text-[#FFFDFD]/75">
                      {entry.body}
                    </p>
                  ) : (
                    <LockedTeaser onUpgrade={() => openModal("upgrade")} />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function LockedTeaser({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <button
      type="button"
      onClick={onUpgrade}
      className="group flex flex-col items-start gap-1.5 text-left"
    >
      <span className="h-2 w-full max-w-[220px] rounded-full bg-[#FFFDFD]/10" />
      <span className="h-2 w-full max-w-[160px] rounded-full bg-[#FFFDFD]/10" />
      <span className="mt-1 text-[11px] font-light lowercase text-[#FFFDFD]/40 transition-colors group-hover:text-[#FFFDFD]/70 motion-reduce:transition-none">
        unlock all observations →
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Locked pillar static card
// ---------------------------------------------------------------------------

function LockedCard({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-[12px] font-light lowercase text-[#FFFDFD]/45 transition-colors hover:text-[#FFFDFD]/80 motion-reduce:transition-none"
      >
        ← all pillars
      </button>
      <div className="rounded-xl border border-[#FFFDFD]/8 bg-[#FFFDFD]/2 px-5 py-6">
        <p className="text-[13px] font-light lowercase leading-relaxed text-[#FFFDFD]/40">
          these form over time — keep returning
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[11px] uppercase tracking-[0.15em] text-[#FFFDFD]/30">
      {children}
    </p>
  );
}

function PulsingDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full motion-safe:animate-pulse"
      style={{ background: color }}
      aria-hidden
    />
  );
}
