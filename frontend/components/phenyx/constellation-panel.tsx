"use client";

// PHE-74 / PHE-93 — Constellation detail panel.
//
// Three states: overview | pillar | cluster. Back always steps one level.
// Overview: "what you are made of" + one story row per point.
// Pillar: name, area count, pillar text, source tags, the line that says what
// the areas amount to when read together (held back on free), area cards.
// Cluster: observations with evidence traces (PHE-71 EvidenceTrace).

import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { EvidenceTrace } from "@/components/phenyx/evidence-trace";
import { useTier } from "@/lib/use-tier";
import {
  ALL_PILLARS,
  newObservationCount,
  pillarLabel,
  relativeTime,
  storyLine,
  synthesisLine,
  type Cluster,
  type ClusterObservation,
  type ConstellationData,
  type Pillar,
  type PillarDetail,
} from "@/lib/constellation";

export interface ConstellationPanelProps {
  data: ConstellationData;
  selectedPillar: Pillar | null;
  selectedClusterId: string | null;
  onSelectPillar: (pillar: Pillar) => void;
  onSelectCluster: (clusterId: string) => void;
  onBack: () => void;
}

export function ConstellationPanel({
  data,
  selectedPillar,
  selectedClusterId,
  onSelectPillar,
  onSelectCluster,
  onBack,
}: ConstellationPanelProps) {
  const { isPro } = useTier();

  if (selectedPillar && selectedClusterId) {
    const detail = data.pillars[selectedPillar];
    const cluster = detail.clusters.find((c) => c.id === selectedClusterId);
    if (cluster) {
      return (
        <ClusterDetail
          stellar={data.stellar_color}
          pillar={detail}
          cluster={cluster}
          onBack={onBack}
        />
      );
    }
  }
  if (selectedPillar) {
    return (
      <PillarDetailView
        stellar={data.stellar_color}
        detail={data.pillars[selectedPillar]}
        isPro={isPro}
        onBack={onBack}
        onSelectCluster={onSelectCluster}
      />
    );
  }
  return <Overview data={data} onSelectPillar={onSelectPillar} />;
}

function Overview({
  data,
  onSelectPillar,
}: {
  data: ConstellationData;
  onSelectPillar: (pillar: Pillar) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <SectionLabel>what you are made of</SectionLabel>
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

      <ul className="flex flex-col gap-1.5 border-t border-[#FFFDFD]/6 pt-5">
        {ALL_PILLARS.map((pillar) => (
          <li key={pillar}>
            <StoryRow
              detail={data.pillars[pillar]}
              stellar={data.stellar_color}
              onOpen={() => onSelectPillar(pillar)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

// One point, read as a line of story rather than a tally: the point's name,
// how many of its observations are new, and the first sentence of what it
// holds (its lens while it has nothing of its own yet).
function StoryRow({
  detail,
  stellar,
  onOpen,
}: {
  detail: PillarDetail;
  stellar: string;
  onOpen: () => void;
}) {
  const newCount = newObservationCount(detail);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[12px] border border-[rgba(255,253,253,0.045)] px-5 py-[18px] text-left transition-colors hover:border-[rgba(var(--s-rgb),0.35)] hover:bg-[#0e0e0e] motion-reduce:transition-none max-[760px]:px-[18px] max-[760px]:py-4"
    >
      <div className="mb-1.5 flex items-center gap-2.5">
        <span
          className={`text-[10.5px] font-semibold uppercase tracking-[0.14em] ${
            detail.active
              ? "text-[rgba(var(--s-rgb),0.9)]"
              : "text-[rgba(var(--s-rgb),0.5)]"
          }`}
        >
          {pillarLabel(detail.pillar)}
        </span>
        {newCount > 0 && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-[rgba(var(--s-rgb),0.28)] px-[7px] py-[2px] text-[9.5px] uppercase tracking-[0.08em] text-[rgba(var(--s-rgb),0.75)]">
            <PulsingDot color={stellar} />
            {newCount} new
          </span>
        )}
      </div>
      <p
        className={`text-[13px] font-light leading-[1.55] ${
          detail.active ? "text-[#FFFDFD]/72" : "text-[#FFFDFD]/45"
        }`}
      >
        {storyLine(detail)}
      </p>
    </button>
  );
}

function PillarDetailView({
  stellar,
  detail,
  isPro,
  onBack,
  onSelectCluster,
}: {
  stellar: string;
  detail: PillarDetail;
  isPro: boolean;
  onBack: () => void;
  onSelectCluster: (clusterId: string) => void;
}) {
  const areaCount = detail.clusters.length;
  const hasSources = detail.source_platforms.length > 0;
  const readTogether = synthesisLine(detail, isPro);

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-[12px] font-light lowercase text-[#FFFDFD]/45 transition-colors hover:text-[#FFFDFD]/80 motion-reduce:transition-none"
      >
        ← all pillars
      </button>

      <div className="flex items-center justify-between gap-3">
        <span
          className="rounded-full px-3 py-1 text-[12px] lowercase text-[#0A0A0A]"
          style={{ background: stellar }}
        >
          {pillarLabel(detail.pillar)}
        </span>
        <span className="text-[12px] font-light tabular-nums text-[#FFFDFD]/40">
          {areaCount} {areaCount === 1 ? "area" : "areas"}
        </span>
      </div>

      {detail.synthesis ? (
        <p className="text-[14px] font-light leading-relaxed text-[#FFFDFD]/80">
          {detail.synthesis}
        </p>
      ) : (
        <p className="text-[13px] font-light italic text-[#FFFDFD]/30">
          forming.
        </p>
      )}

      {hasSources && (
        <section>
          <SectionLabel>sources</SectionLabel>
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
        </section>
      )}

      {/* What the areas amount to when read together, composed from the areas
          themselves so it cannot drift from what sits underneath. On free the
          point shows its areas and only says that a full reading exists. */}
      {readTogether && (
        <p
          className={
            readTogether.locked
              ? "text-[11.5px] font-light italic tracking-[0.04em] text-[rgba(var(--s-rgb),0.62)]"
              : "text-[13px] font-light italic leading-[1.75] text-[#FFFDFD]/50"
          }
        >
          {readTogether.text}
        </p>
      )}

      <section>
        <SectionLabel>areas</SectionLabel>
        {detail.clusters.length === 0 ? (
          <p className="text-[13px] font-light italic text-[#FFFDFD]/30">
            no observations yet.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {detail.clusters.map((cluster) => (
              <ClusterCard
                key={cluster.id}
                cluster={cluster}
                onOpen={() => onSelectCluster(cluster.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ClusterCard({
  cluster,
  onOpen,
}: {
  cluster: Cluster;
  onOpen: () => void;
}) {
  const count = cluster.observation_count;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`rounded-[10px] border bg-[#0c0c0c] px-4 py-3.5 text-left transition-colors hover:border-[rgba(var(--s-rgb),0.35)] hover:bg-[#0f0f0f] motion-reduce:transition-none ${
        cluster.has_new
          ? "border-l-2 border-[#1e1e1e] border-l-[var(--s)]"
          : "border-[#1e1e1e]"
      }`}
    >
      <p className="mb-1 text-[13px] font-medium lowercase tracking-wide text-[#FFFDFD]/80">
        {cluster.label}
      </p>
      {cluster.preview && (
        <p className="mt-1 max-w-[62ch] text-[13px] font-light leading-relaxed text-[#FFFDFD]/50">
          {cluster.preview}
        </p>
      )}
      <p className="mt-2 text-[11px] tracking-wide text-[rgba(var(--s-rgb),0.6)]">
        {count} {count === 1 ? "signal" : "signals"}
      </p>
    </button>
  );
}

function ClusterDetail({
  stellar,
  pillar,
  cluster,
  onBack,
}: {
  stellar: string;
  pillar: PillarDetail;
  cluster: Cluster;
  onBack: () => void;
}) {
  const { openModal } = useSettingsModals();
  const hasSources = cluster.source_platforms.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-[12px] font-light lowercase text-[#FFFDFD]/45 transition-colors hover:text-[#FFFDFD]/80 motion-reduce:transition-none"
      >
        ← {pillarLabel(pillar.pillar)}
      </button>

      <div className="flex items-center justify-between gap-3">
        <span
          className="rounded-full px-3 py-1 text-[12px] lowercase text-[#0A0A0A]"
          style={{ background: stellar }}
        >
          {pillarLabel(pillar.pillar)}
        </span>
        <span className="text-[12px] font-light lowercase text-[#FFFDFD]/40">
          {cluster.label}
        </span>
      </div>

      {cluster.preview ? (
        <p className="text-[14px] font-light leading-relaxed text-[#FFFDFD]/80">
          {cluster.preview}
        </p>
      ) : null}

      {hasSources && (
        <div className="flex flex-wrap gap-2" aria-label={`drawn from ${cluster.source_platforms.join(", ")}`}>
          {cluster.source_platforms.map((platform) => (
            <span
              key={platform}
              className="rounded-full border border-[#FFFDFD]/12 px-2.5 py-0.5 text-[11px] lowercase text-[#FFFDFD]/55"
            >
              {platform}
            </span>
          ))}
        </div>
      )}

      <section>
        {cluster.observations.length === 0 ? (
          <p className="text-[13px] font-light italic text-[#FFFDFD]/30">
            no observations yet.
          </p>
        ) : (
          <ol className="flex flex-col gap-5">
            {cluster.observations.map((entry, index) => (
              <ClusterObservationRow
                key={entry.id}
                entry={entry}
                stellar={stellar}
                isFirst={index === 0}
                onUpgrade={() => openModal("upgrade")}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function ClusterObservationRow({
  entry,
  stellar,
  isFirst,
  onUpgrade,
}: {
  entry: ClusterObservation;
  stellar: string;
  isFirst: boolean;
  onUpgrade: () => void;
}) {
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {entry.surfaced_at && (
          <span className="text-[11px] font-light lowercase text-[#FFFDFD]/35">
            {relativeTime(entry.surfaced_at)}
          </span>
        )}
        {isFirst && entry.is_new && (
          <span
            className="text-[10px] font-medium uppercase tracking-[0.15em]"
            style={{ color: stellar }}
          >
            new signal
          </span>
        )}
      </div>
      {entry.body && (
        <p className="text-[13px] font-light leading-relaxed text-[#FFFDFD]/75">
          {entry.body}
        </p>
      )}
      {entry.points && entry.points.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1 pl-0">
          {entry.points.map((point) => (
            <li key={point} className="text-[12px] font-light text-[#FFFDFD]/50">
              {point}
            </li>
          ))}
        </ul>
      )}
      {entry.sources && entry.sources.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {entry.sources.map((platform) => (
            <span
              key={platform}
              className="text-[10px] lowercase tracking-wide text-[rgba(var(--s-rgb),0.7)]"
            >
              {platform}
            </span>
          ))}
          {entry.span && (
            <span className="text-[10px] text-[#FFFDFD]/35">{entry.span}</span>
          )}
        </div>
      )}
      {entry.evidence && (
        <EvidenceTrace
          observationId={entry.id}
          evidence={entry.evidence}
          onUpgrade={onUpgrade}
        />
      )}
    </li>
  );
}

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
