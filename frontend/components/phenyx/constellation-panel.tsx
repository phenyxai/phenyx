"use client";

// PHE-74 / PHE-93 / PHE-122 / PHE-129 — Constellation detail panel.
//
// Two states: overview | point.
// Overview: "explore what shaped you." and the seven names, one row each, with
// a quiet "new signal" note beside the point a fresh signal belongs to.
// Point (spec doc 2, Oct 20 demo): the name with previous/next arrows on one
// row and nothing under it (PHE-146), a one-sentence story, "moments" with filters by the part of life each
// moment sits in (or its platform on older rows), then the moments. Each opens
// in place as one column: what happened, why it matters, what connects from
// here, "see the sources →", "does this feel like you?" and "follow this
// thread ⓘ". Following lights the moment's own dot, and later moments on the
// same part of life carry "from your thread". The sources open "behind this
// moment". The signal's moments carry a lit dot until one of them is opened.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Popup } from "@/components/phenyx/settings-modals/modal-host";
import { Arrow } from "@/components/phenyx/nav-icons";
import {
  ALL_PILLARS,
  markSignalSeen,
  momentTitle,
  momentTopic,
  momentYear,
  pillarLabel,
  pointMoments,
  sendMomentFeedback,
  storyLine,
  threadAreas,
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
  /** Back to the seven names (the map's empty sky and esc do the same). */
  onClosePoint: () => void;
  /** A moment to open on arrival (insights' milestones link here). */
  openMomentId?: string | null;
}

const NO_FEEDBACK: MomentFeedback = { verdict: null, following: false };

/** Every moment's reaction, keyed by id, so a follow on one point can mark threads on the next. */
function initialFeedback(data: ConstellationData): Record<string, MomentFeedback> {
  const out: Record<string, MomentFeedback> = {};
  for (const pillar of ALL_PILLARS) {
    for (const moment of pointMoments(data.pillars[pillar])) out[moment.id] = moment.feedback ?? NO_FEEDBACK;
  }
  return out;
}

export function ConstellationPanel({ data, selectedPillar, onSelectPillar, onClosePoint, openMomentId = null }: ConstellationPanelProps) {
  const [feedback, setFeedback] = useState(() => initialFeedback(data));
  const [signalSeen, setSignalSeen] = useState(false);
  const signal = signalSeen ? null : data.signal;
  const signalIds = useMemo(() => new Set(signal?.observation_ids ?? []), [signal]);

  const seeSignal = () => {
    if (!signal) return;
    setSignalSeen(true);
    void markSignalSeen();
  };

  // A signal whose moments are not on its point (older rows) clears once that point is opened.
  useEffect(() => {
    if (!signal || selectedPillar !== signal.pillar) return;
    if (!pointMoments(data.pillars[signal.pillar]).some((m) => signalIds.has(m.id))) seeSignal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPillar, signal]);

  const react = (id: string, next: MomentFeedback, patch: Parameters<typeof sendMomentFeedback>[1]) => {
    const before = feedback[id] ?? NO_FEEDBACK;
    setFeedback((all) => ({ ...all, [id]: next }));
    sendMomentFeedback(id, patch).catch(() => setFeedback((all) => ({ ...all, [id]: before })));
  };

  if (selectedPillar) {
    return (
      <PointView
        key={selectedPillar}
        data={data}
        detail={data.pillars[selectedPillar]}
        feedback={feedback}
        signalIds={signal ? signalIds : null}
        onSeeSignal={seeSignal}
        onReact={react}
        onSelectPillar={onSelectPillar}
        onClose={onClosePoint}
        openMomentId={openMomentId}
      />
    );
  }
  return <Overview signalPillar={signal?.pillar ?? null} onSelectPillar={onSelectPillar} />;
}

/** Small, lowercase, accent: every reading label in the panel. */
function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-semibold text-[var(--ph-accent)]">{children}</p>;
}

/** The outlined list dot; it fills with the accent (soft glow) on hover, when open, or when lit. */
function ListDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-[7px] inline-block h-[7px] w-[7px] shrink-0 rounded-full border border-[rgba(var(--ph-accent-rgb),0.8)] transition-[background-color,box-shadow] duration-200 motion-reduce:transition-none group-hover:bg-[var(--ph-accent)] group-hover:shadow-[0_0_8px_rgba(var(--ph-accent-rgb),0.6)] ${
        on ? "bg-[var(--ph-accent)] shadow-[0_0_10px_rgba(var(--ph-accent-rgb),0.6)]" : "bg-transparent"
      }`}
    />
  );
}

/** "new signal": a glowing dot and the words, no frame. */
function SignalNote() {
  return (
    <span className="ml-3 inline-flex items-center gap-1.5 align-middle text-[11px] font-semibold tracking-[0.02em] text-[var(--ph-accent)]">
      <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-[var(--ph-accent)] shadow-[0_0_8px_rgba(var(--ph-accent-rgb),0.8)]" />
      new signal
    </span>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

function Overview({
  signalPillar,
  onSelectPillar,
}: {
  signalPillar: Pillar | null;
  onSelectPillar: (pillar: Pillar) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12.5px] font-light text-ph-white/45">explore what shaped you.</p>
      <ul className="-mx-3.5 flex flex-col">
        {ALL_PILLARS.map((pillar) => (
          <li key={pillar}>
            <button
              type="button"
              onClick={() => onSelectPillar(pillar)}
              className="group flex w-full items-start gap-[15px] rounded-xl px-3.5 py-[13px] text-left text-[16px] font-light text-ph-white/92 transition-colors duration-200 hover:text-[var(--ph-accent)] motion-reduce:transition-none"
            >
              <ListDot on={pillar === signalPillar} />
              <span>
                {pillarLabel(pillar)}
                {pillar === signalPillar && <SignalNote />}
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

// A plain arrow with a 44px tap area. At either end of the story the button
// stays rendered but disabled (aria-disabled, so it keeps focus): a keyboard
// user who steps onto transcendence keeps their place instead of focus falling
// back to the page.
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
      className={`relative flex h-[26px] w-[26px] items-center justify-center transition-colors duration-200 before:absolute before:-inset-2 before:content-[''] ${
        to ? "text-ph-white/65 hover:text-[var(--ph-accent)]" : "cursor-default text-ph-white/20"
      }`}
    >
      <Arrow direction={direction === "previous" ? "left" : "right"} />
    </button>
  );
}

const ALL_TOPICS = "all";

function PointView({
  data,
  detail,
  feedback,
  signalIds,
  onSeeSignal,
  onReact,
  onSelectPillar,
  onClose,
  openMomentId,
}: {
  data: ConstellationData;
  detail: PillarDetail;
  feedback: Record<string, MomentFeedback>;
  signalIds: Set<string> | null;
  onSeeSignal: () => void;
  onReact: (id: string, next: MomentFeedback, patch: Parameters<typeof sendMomentFeedback>[1]) => void;
  onSelectPillar: (pillar: Pillar) => void;
  onClose: () => void;
  openMomentId: string | null;
}) {
  const index = ALL_PILLARS.indexOf(detail.pillar);
  const moments = pointMoments(detail);
  const topics = [...new Set(moments.map(momentTopic).filter(Boolean))];
  const [topic, setTopic] = useState(ALL_TOPICS);
  const [openId, setOpenId] = useState<string | null>(() =>
    openMomentId && moments.some((m) => m.id === openMomentId) ? openMomentId : null,
  );
  const [trail, setTrail] = useState<ClusterObservation | null>(null);
  const shown = topic === ALL_TOPICS ? moments : moments.filter((m) => momentTopic(m) === topic);
  // Undated moments (older imports) leave the year column out rather than fill it with a mark.
  const dated = shown.some((m) => momentYear(m));
  const threads = threadAreas(data, ALL_PILLARS, (id) => !!feedback[id]?.following);

  const toggle = (moment: ClusterObservation) => {
    setOpenId((id) => (id === moment.id ? null : moment.id));
    if (signalIds?.has(moment.id)) onSeeSignal();
  };

  return (
    <div className="flex flex-col">
      {/* The name, the step arrows and the way back to the seven names share one row. */}
      <div className="flex items-center gap-3">
        <h2 className="min-w-0 flex-1 text-[18px] font-medium tracking-[-0.012em] text-ph-white/94">
          {pillarLabel(detail.pillar)}
        </h2>
        <div className="flex items-center gap-1.5">
          <StepButton to={ALL_PILLARS[index - 1]} direction="previous" onSelect={onSelectPillar} />
          <StepButton to={ALL_PILLARS[index + 1]} direction="next" onSelect={onSelectPillar} />
          <button
            type="button"
            onClick={onClose}
            aria-label="close, back to all points"
            className="relative ml-2 flex h-[26px] w-[26px] items-center justify-center text-ph-white/65 transition-colors duration-200 before:absolute before:-inset-2 before:content-[''] hover:text-[var(--ph-accent)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <p className="mt-[19px] text-[15px] font-light leading-[1.65] text-ph-white/78">{storyLine(detail)}</p>

      <h3 className="mt-6 text-[14px] font-medium text-ph-white/90">moments</h3>
      {topics.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="filter moments">
          {[ALL_TOPICS, ...topics].map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={topic === t}
              onClick={() => setTopic(t)}
              className={`rounded-full border px-[11px] py-1.5 text-[12px] font-medium lowercase transition-colors duration-200 ${
                topic === t
                  ? "border-[rgba(var(--ph-accent-rgb),0.5)] bg-[rgba(var(--ph-accent-rgb),0.16)] text-[var(--ph-accent)]"
                  : "border-ph-white/10 text-ph-white/65 hover:border-[rgba(var(--ph-accent-rgb),0.5)] hover:text-[var(--ph-accent)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="mt-4 text-[13px] font-light italic text-ph-white/30">no moments yet.</p>
      ) : (
        <ol className="mt-3.5 flex flex-col gap-1.5">
          {shown.map((moment) => {
            const reaction = feedback[moment.id] ?? NO_FEEDBACK;
            const area = moment.area?.trim();
            const fromThread = !reaction.following && !!area && (threads.get(area) ?? Infinity) < index;
            return (
              <MomentRow
                key={moment.id}
                moment={moment}
                dated={dated}
                open={openId === moment.id}
                lit={reaction.following || !!signalIds?.has(moment.id)}
                signal={!!signalIds?.has(moment.id)}
                fromThread={fromThread}
                onToggle={() => toggle(moment)}
                onSources={() => setTrail(moment)}
              >
                <Reactions
                  state={reaction}
                  onChange={(next, patch) => onReact(moment.id, next, patch)}
                />
              </MomentRow>
            );
          })}
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
  dated,
  open,
  lit,
  signal,
  fromThread,
  onToggle,
  onSources,
  children,
}: {
  moment: ClusterObservation;
  /** Whether the list shows a year column. */
  dated: boolean;
  open: boolean;
  lit: boolean;
  signal: boolean;
  fromThread: boolean;
  onToggle: () => void;
  onSources: () => void;
  children: ReactNode;
}) {
  const title = momentTitle(moment);
  const year = momentYear(moment);
  const bodyId = `moment-${moment.id}`;
  const happened = moment.what_happened || moment.body;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        aria-label={signal ? `new signal: ${[year, title].filter(Boolean).join(" ")}` : undefined}
        className={`group grid w-full items-start gap-x-3.5 py-3.5 pr-4 pl-2.5 text-left ${
          dated ? "grid-cols-[7px_66px_1fr_15px]" : "grid-cols-[7px_1fr_15px]"
        }`}
      >
        <ListDot on={open || lit} />
        {dated && <span className="pt-px text-[12px] font-medium tabular-nums text-ph-white/74">{year}</span>}
        <span>
          <span
            className={`block text-[15px] font-medium leading-[1.5] transition-colors duration-200 group-hover:text-[var(--ph-accent)] ${
              open ? "text-ph-white" : "text-ph-white/88"
            }`}
          >
            {title}
            {fromThread && (
              <span className="ml-2 inline-block rounded-full border border-[rgba(var(--ph-accent-rgb),0.4)] px-2 py-px align-middle text-[10.5px] font-medium text-[var(--ph-accent)]">
                from your thread
              </span>
            )}
          </span>
          {moment.platform && (
            <span className="mt-[7px] block text-[12.5px] font-medium lowercase text-ph-white/72">{moment.platform}</span>
          )}
        </span>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`mt-0.5 text-ph-white/55 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id={bodyId}
          className={`flex flex-col gap-3 pb-4 pr-6 motion-safe:animate-fade-in-up [@media(max-width:640px)]:pl-[34px] ${
            dated ? "[@media(min-width:641px)]:pl-[111px]" : "[@media(min-width:641px)]:pl-[31px]"
          }`}
        >
          {happened && (
            <section>
              <SectionLabel>what happened</SectionLabel>
              <p className="mt-1 text-[15.5px] leading-[1.6] text-ph-white/93">{happened}</p>
            </section>
          )}
          {moment.why_it_matters && (
            <section>
              <SectionLabel>why it matters</SectionLabel>
              <p className="mt-1 text-[14.5px] font-medium leading-[1.62] text-ph-white/89">{moment.why_it_matters}</p>
            </section>
          )}
          {moment.what_connects && (
            <section>
              <SectionLabel>what connects from here</SectionLabel>
              <p className="mt-1 text-[14.5px] font-medium leading-[1.62] text-ph-white/89">{moment.what_connects}</p>
            </section>
          )}
          <button
            type="button"
            onClick={onSources}
            className="flex h-8 items-center gap-1.5 self-start text-[13px] font-semibold text-ph-white/88 transition-colors duration-200 hover:text-[var(--ph-accent)]"
          >
            see the sources <Arrow size={12} />
          </button>
          {children}
        </div>
      )}
    </li>
  );
}

const FOLLOW_NOTE =
  "follow this moment to highlight related moments in your timeline and help surface related discoveries. click again to unfollow.";

/**
 * "does this feel like you?": this feels true / not quite (one per moment),
 * then follow this thread with its ⓘ. Reaction pills fill with the accent and
 * get a ✓ when chosen; following turns the label to "following this thread" in
 * the accent and lights the moment's dot. The ⓘ shows the note on its own line.
 */
function Reactions({
  state,
  onChange,
}: {
  state: MomentFeedback;
  onChange: (next: MomentFeedback, patch: Parameters<typeof sendMomentFeedback>[1]) => void;
}) {
  const [note, setNote] = useState(false);
  const verdict = (v: "new" | "reading") => {
    const next = state.verdict === v ? null : v;
    onChange({ ...state, verdict: next }, { verdict: next });
  };
  // Tapping follow closes the note it explains (rebuild doc, section 7).
  const follow = () => {
    setNote(false);
    onChange({ ...state, following: !state.following }, { following: !state.following });
  };

  return (
    <section className="mt-2">
      <p className="text-[11.5px] font-semibold text-ph-white/70">does this feel like you?</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <ReactionPill on={state.verdict === "new"} onClick={() => verdict("new")}>
          this feels true
        </ReactionPill>
        <ReactionPill on={state.verdict === "reading"} onClick={() => verdict("reading")}>
          not quite
        </ReactionPill>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-pressed={state.following}
          onClick={follow}
          className={`py-1 text-[12.5px] transition-colors duration-200 hover:text-[var(--ph-accent)] ${
            state.following ? "font-medium text-[var(--ph-accent)]" : "text-ph-white/70"
          }`}
        >
          {state.following ? "following this thread" : "follow this thread"}
        </button>
        <button
          type="button"
          aria-expanded={note}
          aria-label="what following does"
          onClick={() => setNote((n) => !n)}
          className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-ph-white/38 text-[10.5px] font-medium italic text-ph-white/75 transition-colors duration-200 hover:border-[var(--ph-accent)] hover:text-[var(--ph-accent)]"
        >
          i
        </button>
      </div>
      {note && (
        <p className="mt-2 rounded-[9px] border border-ph-white/[0.075] bg-ph-white/[0.02] px-2.5 py-2 text-[12px] leading-[1.55] text-ph-white/78">
          {FOLLOW_NOTE}
        </p>
      )}
    </section>
  );
}

function ReactionPill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-[34px] rounded-full border px-3.5 text-[12.5px] transition-colors duration-200 ${
        on
          ? "border-[var(--ph-accent)] bg-[rgba(var(--ph-accent-rgb),0.14)] text-ph-white/95"
          : "border-ph-white/13 text-ph-white/72 hover:border-[rgba(var(--ph-accent-rgb),0.5)] hover:text-[var(--ph-accent)]"
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
 * "behind this moment": the date, the moment, each dated source entry on an
 * accent bar, and why it matters (full). Both plans see the sources (PHE-129).
 */
function SourceTrail({ moment, onClose }: { moment: ClusterObservation; onClose: () => void }) {
  const entries = moment.evidence?.entries ?? [];
  const year = momentYear(moment);
  const fallback = [year, moment.platform].filter(Boolean).join(" · ");

  return (
    <Popup title="behind this moment" onClose={onClose}>
      <div>
        {year && <p className="text-[12.5px] text-[var(--ph-accent)]">{year}</p>}
        <p className="mt-2.5 text-[15px] font-semibold text-ph-white/95">{momentTitle(moment)}</p>
        {(moment.what_happened || moment.body) && (
          <p className="mt-1 text-[14px] font-light leading-[1.6] text-ph-white/65">
            {moment.what_happened || moment.body}
          </p>
        )}

        <ol className="mt-5 flex flex-col gap-3">
          {(entries.length ? entries : fallback ? [{ t: fallback, s: "", w: "" }] : []).map((entry, i) => (
            <li
              key={`${entry.t}-${i}`}
              className="rounded-r-lg border-l-2 border-[var(--ph-accent)] bg-[rgba(var(--ph-accent-rgb),0.04)] px-4 py-3"
            >
              <p className="text-[12.5px] text-[rgba(var(--ph-accent-rgb),0.9)]">{[entry.t, entry.s].filter(Boolean).join(" · ")}</p>
              {entry.w && <p className="mt-1 text-[13px] font-light leading-[1.6] text-ph-white/70">{entry.w}</p>}
            </li>
          ))}
        </ol>

        {moment.why_it_matters && (
          <section className="mt-5">
            <p className="text-[12px] text-[var(--ph-accent)]">why it matters</p>
            <p className="mt-2 text-[14px] font-light leading-[1.65] text-ph-white/65">{moment.why_it_matters}</p>
          </section>
        )}
      </div>
    </Popup>
  );
}
