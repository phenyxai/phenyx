"use client";

// PHE-74 / PHE-93 / PHE-122 — Constellation detail panel.
//
// Two states: overview | point. Back always returns to the overview.
// Overview: "your life so far" (the portrait and when it was updated) and one
// story row per point.
// Point (spec doc 2): the name with previous/next arrows, years · era · place,
// a one-sentence story, platform filters, then the moments. Each moment opens
// in place as one column: what happened, why it matters, what connects from
// here, the platform and "see source trail →", "does this feel like you?",
// then "✦ ask polaris about this". The source trail opens "behind this moment".

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import {
  ALL_PILLARS,
  momentTitle,
  momentYear,
  pillarLabel,
  pointMetaLine,
  pointMoments,
  relativeTime,
  sendMomentFeedback,
  storyLine,
  type ClusterObservation,
  type ConstellationData,
  type MomentFeedback,
  type Pillar,
  type PillarDetail,
} from "@/lib/constellation";

export interface ConstellationPanelProps {
  data: ConstellationData;
  selectedPillar: Pillar | null;
  onSelectPillar: (pillar: Pillar) => void;
  onBack: () => void;
}

export function ConstellationPanel({ data, selectedPillar, onSelectPillar, onBack }: ConstellationPanelProps) {
  if (selectedPillar) {
    return (
      <PointView
        key={selectedPillar}
        detail={data.pillars[selectedPillar]}
        onBack={onBack}
        onSelectPillar={onSelectPillar}
      />
    );
  }
  return <Overview data={data} onSelectPillar={onSelectPillar} />;
}

/** Small, lowercase, accent: every section label in the panel. */
function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[12px] tracking-[0.02em] text-[var(--ph-accent)]">{children}</p>;
}

/** The outlined list dot; it fills with the accent (soft glow) on hover or when open. */
function ListDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-[6px] inline-block h-[7px] w-[7px] shrink-0 rounded-full border border-[var(--ph-accent)] transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none group-hover:bg-[var(--ph-accent)] group-hover:shadow-[0_0_8px_rgba(var(--ph-accent-rgb),0.6)] ${
        on ? "bg-[var(--ph-accent)] shadow-[0_0_8px_rgba(var(--ph-accent-rgb),0.6)]" : "bg-transparent"
      }`}
    />
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function Overview({ data, onSelectPillar }: { data: ConstellationData; onSelectPillar: (pillar: Pillar) => void }) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <SectionLabel>your life so far</SectionLabel>
        {data.portrait ? (
          <p className="text-[15px] font-light leading-[1.7] text-ph-white/85">{data.portrait}</p>
        ) : (
          <p className="text-[13px] font-light italic text-ph-white/30">forming.</p>
        )}
        {data.generated_at && (
          <p className="mt-3 text-[12px] font-light text-ph-white/40">
            updated {relativeTime(data.generated_at)} · this reading shifts as your constellation grows
          </p>
        )}
      </section>

      <ul className="flex flex-col gap-5">
        {ALL_PILLARS.map((pillar) => (
          <li key={pillar}>
            <button
              type="button"
              onClick={() => onSelectPillar(pillar)}
              className="group grid w-full grid-cols-[7px_1fr] gap-x-3.5 text-left"
            >
              <ListDot on={false} />
              <span>
                <span className="block text-[14px] text-ph-white/90">{pillarLabel(pillar)}</span>
                <span className="mt-1 block text-[13px] font-light leading-[1.55] text-ph-white/60">
                  {storyLine(data.pillars[pillar])}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Point
// ---------------------------------------------------------------------------

// A small outlined arrow with a 44px tap area. At either end of the story the
// button stays rendered but disabled (aria-disabled, so it keeps focus): a
// keyboard user who steps onto transcendence keeps their place instead of
// focus falling back to the page.
function StepButton({
  to,
  direction,
  onSelect,
}: {
  to: Pillar | undefined;
  direction: "previous" | "next";
  onSelect: (pillar: Pillar) => void;
}) {
  return (
    <button
      type="button"
      aria-disabled={!to}
      onClick={() => to && onSelect(to)}
      aria-label={to ? `${direction} point: ${pillarLabel(to)}` : `no ${direction} point`}
      className={`relative flex h-7 w-7 items-center justify-center rounded-full border border-ph-white/12 text-[13px] before:absolute before:-inset-2 before:content-[''] ${
        to ? "text-ph-white/55" : "cursor-default text-ph-white/20"
      }`}
    >
      <span aria-hidden="true">{direction === "previous" ? "‹" : "›"}</span>
    </button>
  );
}

const ALL_PLATFORMS = "all";

function PointView({
  detail,
  onBack,
  onSelectPillar,
}: {
  detail: PillarDetail;
  onBack: () => void;
  onSelectPillar: (pillar: Pillar) => void;
}) {
  const index = ALL_PILLARS.indexOf(detail.pillar);
  const moments = pointMoments(detail);
  const platforms = [...new Set(moments.map((m) => m.platform).filter((p): p is string => !!p))];
  const [platform, setPlatform] = useState(ALL_PLATFORMS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [trail, setTrail] = useState<ClusterObservation | null>(null);
  const shown = platform === ALL_PLATFORMS ? moments : moments.filter((m) => m.platform === platform);
  const meta = pointMetaLine(detail);

  return (
    <div className="flex flex-col gap-5">
      {/* The back arrow sits on the name's line, phones included. */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="back to all points"
          className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center text-[16px] text-ph-white/55"
        >
          ←
        </button>
        <h2 className="min-w-0 flex-1 text-[22px] font-light tracking-[-0.01em] text-ph-white/95">
          {pillarLabel(detail.pillar)}
        </h2>
        {/* Step through the points in story order without going back to the
            map, which on a phone sits above the fold once you read on. */}
        <div className="flex items-center gap-2">
          <StepButton to={ALL_PILLARS[index - 1]} direction="previous" onSelect={onSelectPillar} />
          <StepButton to={ALL_PILLARS[index + 1]} direction="next" onSelect={onSelectPillar} />
        </div>
      </div>

      <div className="-mt-2">
        {meta && <p className="text-[12.5px] font-light text-ph-white/50">{meta}</p>}
        <p className="mt-3 text-[15px] font-light leading-[1.7] text-ph-white/85">{storyLine(detail)}</p>
      </div>

      {platforms.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="filter moments by platform">
          {[ALL_PLATFORMS, ...platforms].map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={platform === p}
              onClick={() => setPlatform(p)}
              className={`rounded-full border px-3 py-1 text-[12px] lowercase ${
                platform === p
                  ? "border-[var(--ph-accent)] bg-[rgba(var(--ph-accent-rgb),0.1)] text-ph-white/90"
                  : "border-ph-white/12 text-ph-white/60"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-[13px] font-light italic text-ph-white/30">no moments yet.</p>
      ) : (
        <ol className="flex flex-col gap-5">
          {shown.map((moment) => (
            <MomentRow
              key={moment.id}
              moment={moment}
              open={openId === moment.id}
              onToggle={() => setOpenId((id) => (id === moment.id ? null : moment.id))}
              onSourceTrail={() => setTrail(moment)}
            />
          ))}
        </ol>
      )}

      {trail && <SourceTrail moment={trail} onClose={() => setTrail(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// A moment
// ---------------------------------------------------------------------------

function MomentRow({
  moment,
  open,
  onToggle,
  onSourceTrail,
}: {
  moment: ClusterObservation;
  open: boolean;
  onToggle: () => void;
  onSourceTrail: () => void;
}) {
  const title = momentTitle(moment);
  const year = momentYear(moment);
  const bodyId = `moment-${moment.id}`;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="group grid w-full grid-cols-[7px_44px_1fr] items-start gap-x-3.5 text-left"
      >
        <ListDot on={open} />
        <span className="text-[13px] tabular-nums text-ph-white/55">{year || "·"}</span>
        <span>
          {moment.platform && (
            <span className="block text-[11.5px] lowercase text-[var(--ph-accent)]">{moment.platform}</span>
          )}
          <span className={`block text-[14.5px] leading-[1.45] ${open ? "text-ph-white" : "text-ph-white/85"}`}>
            {title}
          </span>
        </span>
      </button>

      {open && (
        <div
          id={bodyId}
          className="mt-4 flex flex-col gap-4 motion-safe:animate-fade-in-up [@media(min-width:761px)]:pl-[79px]"
        >
          <MomentBody moment={moment} title={title} year={year} onSourceTrail={onSourceTrail} />
        </div>
      )}
    </li>
  );
}

function MomentBody({
  moment,
  title,
  year,
  onSourceTrail,
}: {
  moment: ClusterObservation;
  title: string;
  year: string;
  onSourceTrail: () => void;
}) {
  const router = useRouter();
  const happened = moment.what_happened || moment.body;

  const askPolaris = () => {
    const context = [
      [year, moment.platform, title].filter(Boolean).join(" · "),
      happened,
      moment.why_it_matters,
    ]
      .filter(Boolean)
      .join("\n");
    const params = new URLSearchParams({ q: `tell me more about ${title}.`, mode: "understand", context });
    router.push(`/dashboard/polaris?${params.toString()}`);
  };

  return (
    <>
      {happened && (
        <section>
          <SectionLabel>what happened</SectionLabel>
          <p className="text-[16px] font-light leading-[1.6] text-ph-white/92">{happened}</p>
        </section>
      )}
      {moment.why_it_matters && (
        <section>
          <SectionLabel>why it matters</SectionLabel>
          <p className="text-[13.5px] font-light leading-[1.65] text-ph-white/62">{moment.why_it_matters}</p>
        </section>
      )}
      {moment.what_connects && (
        <section>
          <SectionLabel>what connects from here</SectionLabel>
          <p className="text-[13.5px] font-light leading-[1.65] text-ph-white/62">{moment.what_connects}</p>
        </section>
      )}

      <div className="flex flex-col items-start gap-2">
        {moment.platform && <PlatformPill>{moment.platform}</PlatformPill>}
        <button type="button" onClick={onSourceTrail} className="text-[12.5px] text-ph-white/55">
          see source trail →
        </button>
      </div>

      <div className="h-px bg-ph-white/[0.06]" />

      <Reactions observationId={moment.id} initial={moment.feedback ?? null} />

      <button
        type="button"
        onClick={askPolaris}
        className="self-start rounded-full border border-[rgba(var(--ph-accent-rgb),0.5)] bg-[rgba(var(--ph-accent-rgb),0.08)] px-4 py-2 text-[13px] text-[var(--ph-accent)]"
      >
        ✦ ask polaris about this
      </button>
    </>
  );
}

/** Accent-tinted platform pill, flat (no gradient). */
function PlatformPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[rgba(var(--ph-accent-rgb),0.35)] bg-[rgba(var(--ph-accent-rgb),0.08)] px-2.5 py-0.5 text-[12px] lowercase text-[var(--ph-accent)]">
      {children}
    </span>
  );
}

const FOLLOW_HINT = "keeps this moment close and brings related discoveries back when they appear.";

/**
 * "does this feel like you?": this feels true / not quite (one per moment) and
 * follow this thread. Outlined pills; the chosen one fills with the accent and
 * gets a ✓. Saved optimistically, put back if the save fails.
 */
function Reactions({ observationId, initial }: { observationId: string; initial: MomentFeedback | null }) {
  const [state, setState] = useState<MomentFeedback>(initial ?? { verdict: null, following: false });

  const save = (next: MomentFeedback, patch: Parameters<typeof sendMomentFeedback>[1]) => {
    const before = state;
    setState(next);
    sendMomentFeedback(observationId, patch).catch(() => setState(before));
  };
  const verdict = (v: "new" | "reading") => {
    const nextVerdict = state.verdict === v ? null : v;
    save({ ...state, verdict: nextVerdict }, { verdict: nextVerdict });
  };
  const follow = () => save({ ...state, following: !state.following }, { following: !state.following });

  return (
    <section>
      <SectionLabel>does this feel like you?</SectionLabel>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <ReactionPill on={state.verdict === "new"} onClick={() => verdict("new")}>
          this feels true
        </ReactionPill>
        <ReactionPill on={state.verdict === "reading"} onClick={() => verdict("reading")}>
          not quite
        </ReactionPill>
        <ReactionPill on={state.following} onClick={follow}>
          follow this thread
        </ReactionPill>
        <span
          role="img"
          tabIndex={0}
          aria-label={FOLLOW_HINT}
          title={FOLLOW_HINT}
          className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-ph-white/25 text-[10px] text-ph-white/55"
        >
          i
        </span>
      </div>
    </section>
  );
}

function ReactionPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[12.5px] ${
        on
          ? "border-[var(--ph-accent)] bg-[rgba(var(--ph-accent-rgb),0.14)] text-ph-white/95"
          : "border-ph-white/15 text-ph-white/70"
      }`}
    >
      {on && <span aria-hidden="true">✓ </span>}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Source trail
// ---------------------------------------------------------------------------

/**
 * "✦ behind this moment": the date, the moment, its platform, each dated
 * source entry on an accent bar, and what connects. On free the entries are
 * held back and the upgrade opens instead (the evidence chain never ships).
 * Portalled to the body: the panel's swap transform would otherwise trap the
 * fixed overlay inside the panel column.
 */
function SourceTrail({ moment, onClose }: { moment: ClusterObservation; onClose: () => void }) {
  const { openModal } = useSettingsModals();
  const closeRef = useRef<HTMLButtonElement>(null);
  const entries = moment.evidence?.entries ?? [];
  const connects = moment.what_connects || moment.why_it_matters;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-trail-title"
      onClick={onClose}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-[rgba(8,8,8,0.78)] p-5 backdrop-blur-[6px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[calc(100svh-40px)] w-[min(460px,calc(100vw-40px))] overflow-y-auto rounded-2xl border border-[rgba(var(--ph-accent-rgb),0.2)] bg-ph-black p-7 motion-safe:animate-fade-in-up"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h3 id="source-trail-title" className="text-[17px] font-normal text-ph-white">
            <span className="text-[var(--ph-accent)]">✦</span> behind this moment
          </h3>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="close" className="text-[16px] text-ph-white/60">
            ×
          </button>
        </div>

        {moment.occurred_at && <p className="text-[12.5px] text-[var(--ph-accent)]">{momentYear(moment)}</p>}
        <p className="mt-2 text-[15px] font-medium text-ph-white/95">{momentTitle(moment)}</p>
        {(moment.what_happened || moment.body) && (
          <p className="mt-1.5 text-[13.5px] font-light leading-[1.6] text-ph-white/65">
            {moment.what_happened || moment.body}
          </p>
        )}
        {moment.platform && (
          <div className="mt-4">
            <PlatformPill>{moment.platform}</PlatformPill>
          </div>
        )}

        {moment.locked ? (
          <div className="mt-5 rounded-lg border border-ph-white/10 p-4">
            <p className="text-[13px] font-light leading-[1.6] text-ph-white/65">
              the dated sources behind each moment come with full.
            </p>
            <button type="button" onClick={() => openModal("upgrade")} className="mt-2 text-[13px] text-[var(--ph-accent)]">
              see full →
            </button>
          </div>
        ) : (
          entries.length > 0 && (
            <ol className="mt-5 flex flex-col gap-3">
              {entries.map((entry, i) => (
                <li
                  key={`${entry.t}-${i}`}
                  className="rounded-r-lg border-l-2 border-[var(--ph-accent)] bg-ph-white/[0.025] px-4 py-3"
                >
                  <p className="text-[12px] text-[var(--ph-accent)]">{[entry.t, entry.s].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1 text-[13px] font-light leading-[1.6] text-ph-white/70">{entry.w}</p>
                </li>
              ))}
            </ol>
          )
        )}

        {connects && (
          <section className="mt-5">
            <SectionLabel>what connects</SectionLabel>
            <p className="text-[13.5px] font-light leading-[1.65] text-ph-white/65">{connects}</p>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}
