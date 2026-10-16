"use client";

// PHE-102 — new signal banner.
//
// Shown only while the constellation payload carries an unseen signal, so with
// no new pattern nothing renders. Collapsed by default to one line: the tag and
// the point it belongs to. Opening it shows the summary, the points involved,
// the moments behind it with their source trail, and ideas for action, and
// marks the signal seen so it never comes back as new.

import { useId, useState } from "react";
import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { EvidenceTrace } from "@/components/phenyx/evidence-trace";
import {
  markSignalSeen,
  pillarLabel,
  type ClusterObservation,
  type ConstellationData,
  type NewSignal,
} from "@/lib/constellation";

export function NewSignalBanner({ data }: { data: ConstellationData }) {
  const signal = data.signal;
  const [open, setOpen] = useState(false);
  const [marked, setMarked] = useState(false);
  const bodyId = useId();
  if (!signal) return null;

  const toggle = () => {
    setOpen((o) => !o);
    if (!marked) {
      setMarked(true);
      void markSignalSeen();
    }
  };

  return (
    <section className="w-full rounded-[12px] border border-[rgba(var(--ph-accent-rgb),0.28)] bg-ph-white/[0.015]">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors duration-200 hover:text-[var(--ph-accent)] motion-reduce:transition-none"
      >
        <span className="rounded-full bg-[var(--ph-accent)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ph-black">
          new signal
        </span>
        <span className="text-[12px] font-light lowercase text-ph-white/60 group-hover:text-[var(--ph-accent)]">
          {pillarLabel(signal.pillar)}
        </span>
        <span aria-hidden="true" className="ml-auto text-[13px] text-ph-white/45 group-hover:text-[var(--ph-accent)]">
          {open ? "−" : "+"}
        </span>
      </button>

      <div id={bodyId} hidden={!open}>
        {open && <SignalBody signal={signal} moments={momentsFor(data, signal)} />}
      </div>
    </section>
  );
}

function SignalBody({ signal, moments }: { signal: NewSignal; moments: ClusterObservation[] }) {
  const { openModal } = useSettingsModals();
  return (
    <div className="flex flex-col gap-5 border-t border-ph-white/6 px-5 pb-5 pt-4 motion-safe:animate-fade-in-up">
      <p className="text-[14px] font-light leading-relaxed text-ph-white/80">{signal.summary}</p>

      {signal.points.length > 0 && (
        <div>
          <Label>points involved</Label>
          <div className="flex flex-wrap gap-2">
            {signal.points.map((point) => (
              <span
                key={point}
                className="rounded-full border border-[rgba(var(--ph-accent-rgb),0.4)] px-2.5 py-0.5 text-[11px] lowercase text-[var(--ph-accent)]"
              >
                {pillarLabel(point)}
              </span>
            ))}
          </div>
        </div>
      )}

      {moments.length > 0 && (
        <div>
          <Label>where it comes from</Label>
          <ol className="flex flex-col gap-4">
            {moments.map((moment) => (
              <li key={moment.id} className="flex flex-col gap-1.5">
                <SourceLine signal={signal} observationId={moment.id} />
                {moment.body && (
                  <p className="text-[13px] font-light leading-relaxed text-ph-white/70">{moment.body}</p>
                )}
                {moment.evidence && (
                  <EvidenceTrace
                    observationId={moment.id}
                    evidence={moment.evidence}
                    onUpgrade={() => openModal("upgrade")}
                  />
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {signal.ideas.length > 0 && (
        <div>
          <Label>ideas for action</Label>
          <ul className="flex flex-col gap-2">
            {signal.ideas.map((idea) => (
              <li key={idea} className="flex gap-2.5 text-[13px] font-light leading-relaxed text-ph-white/70">
                <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full border border-[rgba(var(--ph-accent-rgb),0.7)]" />
                {idea}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// The dated platforms the signal stored for one moment, e.g. "spotify, youtube · 2024 – 2025".
function SourceLine({ signal, observationId }: { signal: NewSignal; observationId: string }) {
  const sources = signal.sources.filter((s) => s.observation_id === observationId);
  if (sources.length === 0) return null;
  const span = sources.find((s) => s.span)?.span;
  return (
    <p className="text-[10.5px] lowercase tracking-wide text-[rgba(var(--ph-accent-rgb),0.75)]">
      {sources.map((s) => s.platform).join(", ")}
      {span && <span className="text-ph-white/35"> · {span}</span>}
    </p>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[11px] uppercase tracking-[0.15em] text-[rgba(var(--ph-accent-rgb),0.7)]">{children}</p>
  );
}

/** The signal's moments, resolved from the clusters already loaded (with their evidence). */
function momentsFor(data: ConstellationData, signal: NewSignal): ClusterObservation[] {
  const byId = new Map<string, ClusterObservation>();
  for (const detail of Object.values(data.pillars)) {
    for (const cluster of detail.clusters) {
      for (const observation of cluster.observations) byId.set(observation.id, observation);
    }
  }
  return signal.observation_ids.flatMap((id) => byId.get(id) ?? []);
}
