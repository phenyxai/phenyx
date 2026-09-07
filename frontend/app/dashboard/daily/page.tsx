"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api-client";
import { useTier } from "@/lib/use-tier";
import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { DailyHeader, localDayNumber } from "@/components/phenyx/daily-header";
import {
  ObservationCard,
  observationExplorePrompt,
  pillarKey,
  type Observation,
} from "@/components/phenyx/observation-card";
import { consumeProReturn, peekProReturn } from "@/components/phenyx/evidence-trace";
import { IntroBanner } from "@/components/phenyx/intro-banner";
import { DailyFocus, useDailyFocus } from "@/components/phenyx/daily-focus";
import { selectDailyObservations } from "./select-daily";

// ============================================================================
// Daily tab: v244 feed (PHE-92, on the v67 quieter feed from PHE-70)
// ----------------------------------------------------------------------------
// Date, the mantra of the day with its attribution, four collapsed observation
// cards, full daily focus. Observation CONTENT comes from the engine via
// `apiFetch("/observations")`. The read fails soft: any error renders the
// empty state.
//
// Which four: `selectDailyObservations` (one headline leads, one per pillar,
// a seeded deck dealt through before it repeats). The same four on free and
// full; what differs is how far into an observation you can go, not how many
// you are allowed to see. Nothing opens by default except the focused card.
//
// Gating: every tier reads every sentence and the time span it rests on. The
// evidence trace, the underneath reading and ✦ explore are full;
// `observation.locked` means the trace is withheld and the door opens the
// upgrade modal. The `still true today` line left this page in v244 (the you
// tab still carries the held constants).
// ============================================================================

interface DailyFeedResponse {
  observations?: Observation[];
}

export default function DailyTabPage() {
  const router = useRouter();
  const { isPro } = useTier();
  const { openModal, stellarColor } = useSettingsModals();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [observations, setObservations] = useState<Observation[]>([]);
  // Nothing opens by default; the focus effect below opens the focused card.
  const [openId, setOpenId] = useState<string | null>(null);
  const [proReturnId, setProReturnId] = useState<string | null>(null);

  const { focus, setFocus } = useDailyFocus(isPro ? userId : null);
  const dayNum = localDayNumber();

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (active) setUserId(user?.id ?? null);
      })
      .catch(() => {
        if (active) setUserId(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch("/observations");
        if (!res.ok) throw new Error(`observations ${res.status}`);
        const data = (await res.json()) as DailyFeedResponse | Observation[];
        const list = Array.isArray(data) ? data : data.observations ?? [];
        if (!active) return;
        setObservations(list);
      } catch {
        if (active) setObservations([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const feed = useMemo(
    () => selectDailyObservations(observations, dayNum, isPro ? focus : ""),
    [observations, dayNum, isPro, focus],
  );

  useEffect(() => {
    if (!focus || focus === "everything") return;
    const first = feed.find((o) => pillarKey(o.pillar_tag) === pillarKey(focus));
    if (first) setOpenId(first.id);
  }, [focus, feed]);

  useEffect(() => {
    if (!isPro) return;
    const id = peekProReturn();
    if (!id) return;
    if (!feed.some((o) => o.id === id)) return;
    consumeProReturn();
    setOpenId(id);
    setProReturnId(id);
  }, [isPro, feed]);

  const openUpgrade = () => openModal("upgrade");
  const openExport = () => openModal("data-management");

  const explore = (obs: Observation) => {
    if (!isPro) {
      openUpgrade();
      return;
    }
    const q = observationExplorePrompt(obs);
    const pillar = pillarKey(obs.pillar_tag);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (pillar) params.set("pillar", pillar);
    const qs = params.toString();
    router.push(qs ? `/dashboard/polaris?${qs}` : "/dashboard/polaris");
  };

  return (
    <section style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px 80px" }}>
      <IntroBanner
        tab="daily"
        copy="four lines from what surfaced. open one to see what holds it."
        className="mb-6"
      />

      <DailyHeader />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 4,
          marginBottom: 26,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <h2
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(255,253,253,0.5)",
            margin: 0,
          }}
        >
          observations
        </h2>
        {isPro && userId ? (
          <DailyFocus accent={stellarColor} value={focus} onChange={setFocus} />
        ) : null}
      </div>

      {loading ? (
        <p style={{ fontSize: 14, fontWeight: 300, color: "rgba(255,253,253,0.35)" }}>
          loading…
        </p>
      ) : feed.length === 0 ? (
        <p style={{ fontSize: 15, fontWeight: 300, lineHeight: 1.55, color: "rgba(255,253,253,0.4)" }}>
          your constellation is still gathering. connect more platforms and come back tomorrow.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {feed.map((obs) => (
            <ObservationCard
              key={obs.id}
              observation={obs}
              expanded={openId === obs.id}
              focused={
                isPro && focus !== "" && focus !== "everything"
                  ? pillarKey(obs.pillar_tag) === pillarKey(focus)
                  : false
              }
              accent={stellarColor}
              onToggle={() => setOpenId((id) => (id === obs.id ? null : obs.id))}
              onExplore={() => explore(obs)}
              onUpgrade={openUpgrade}
              onExport={openExport}
              autoExpandEvidence={proReturnId === obs.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}
