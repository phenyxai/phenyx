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
import { IntroBanner } from "@/components/phenyx/intro-banner";
import { StillTrueToday } from "@/components/phenyx/still-true-today";
import {
  DailyFocus,
  useDailyFocus,
  type DailyFocusValue,
} from "@/components/phenyx/daily-focus";

// ============================================================================
// Daily tab: v67 quieter feed (PHE-70)
// ----------------------------------------------------------------------------
// Date, one line, ≤4 collapsed observation cards, still true today, Pro daily
// focus. Observation CONTENT comes from the engine via `apiFetch("/observations")`.
// The endpoint may not be live yet, so the read fails soft: any error renders
// the empty state.
//
// Gating: every tier reads every sentence (PHE-69). Free sees evidence traces
// on the first two of the local day (`observation.locked` = trace withheld).
// Polar tokens live on the Polaris tab. ✦ explore: Pro routes to Polaris with
// q + pillar; Free opens the upgrade modal and does not start a chat.
// ============================================================================

const DAILY_COUNT = 4;

interface DailyFeedResponse {
  observations?: Observation[];
}

function selectDailyObservations(
  observations: Observation[],
  dayNum: number,
  focus: DailyFocusValue,
): Observation[] {
  if (observations.length === 0) return [];

  const focusKey =
    focus && focus !== "everything" ? pillarKey(focus) : "";

  if (focusKey) {
    return observations
      .filter((o) => pillarKey(o.pillar_tag) === focusKey)
      .slice(0, DAILY_COUNT);
  }

  if (observations.length <= DAILY_COUNT) return [...observations];

  const headlines = observations.filter((o) => o.is_new);
  const rest = observations.filter((o) => !o.is_new);
  const ordered: Observation[] = [];
  if (headlines.length) {
    ordered.push(headlines[dayNum % headlines.length]);
  }
  const src = rest.length ? rest : observations;
  const fill = DAILY_COUNT - ordered.length;
  for (let i = 0; ordered.length < DAILY_COUNT && i < src.length; i++) {
    const o = src[((dayNum * Math.max(fill, 1)) + i) % src.length];
    if (!ordered.includes(o)) ordered.push(o);
  }
  return ordered;
}

export default function DailyTabPage() {
  const router = useRouter();
  const { isPro } = useTier();
  const { openModal, stellarColor } = useSettingsModals();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

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

  const openUpgrade = () => openModal("upgrade");

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
          {focus && focus !== "everything"
            ? "nothing on this pillar has surfaced yet. try another, or come back tomorrow."
            : "your constellation is still gathering. connect more platforms and come back tomorrow."}
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
            />
          ))}
        </div>
      )}

      <StillTrueToday accent={stellarColor} />
    </section>
  );
}
