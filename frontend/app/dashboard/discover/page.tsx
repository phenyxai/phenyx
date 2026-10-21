"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "@/lib/api-client";
import { trailDate, trailYears, type Discovery } from "@/lib/discover";
import { IntroBanner, INTRO_COPY } from "@/components/phenyx/intro-banner";
import { CardLink, DiscoverCarousel, StarIcon } from "@/components/phenyx/discover-carousel";
import { HeaderChip, PanelHeader } from "@/components/phenyx/panel-header";
import { Arrow } from "@/components/phenyx/constellation-panel";
import { Popup, PrimaryButton } from "@/components/phenyx/settings-modals/modal-host";

// ============================================================================
// Discover tab (PHE-103, PHE-129, spec doc 3)
// ----------------------------------------------------------------------------
// Seven outward discoveries from `GET /discover`, one card at a time. The
// first visit waits while the set is generated, which can take a minute. The
// read fails soft: any error renders the empty state. The ★ saves a card
// (`POST /discover/:id/save`), and the "★ n" chip opens the saved list. "Ask
// polaris" opens a chat seeded with the card's own question and the card as
// context; polaris enforces its own weekly allowance. "See the sources" opens
// "behind this discovery": the public story, then the person's dated sources.
// ============================================================================

const delay = (seconds: number) => ({ "--float-delay": `${seconds}s` }) as CSSProperties;

export default function DiscoverTabPage() {
  const router = useRouter();
  const [discoveries, setDiscoveries] = useState<Discovery[] | null>(null);
  const [saved, setSaved] = useState<Discovery[]>([]);
  const [sources, setSources] = useState<Discovery | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch("/discover");
        if (!res.ok) throw new Error(`discover ${res.status}`);
        const data = (await res.json()) as { discoveries?: Discovery[]; saved?: Discovery[] };
        if (!active) return;
        setDiscoveries(data.discoveries ?? []);
        setSaved(data.saved ?? []);
      } catch {
        if (active) setDiscoveries([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Saved optimistically in both lists, put back if the save fails.
  const toggleSave = (card: Discovery) => {
    const next = !saved.some((s) => s.id === card.id);
    const apply = (on: boolean) => {
      setDiscoveries((all) => all?.map((d) => (d.id === card.id ? { ...d, saved: on } : d)) ?? all);
      setSaved((all) => (on ? [{ ...card, saved: true }, ...all.filter((s) => s.id !== card.id)] : all.filter((s) => s.id !== card.id)));
    };
    apply(next);
    apiFetch(`/discover/${card.id}/save`, { method: "POST", body: JSON.stringify({ saved: next }) })
      .then((res) => {
        if (!res.ok) throw new Error(`save ${res.status}`);
      })
      .catch(() => apply(!next));
  };

  const ask = (card: Discovery) => {
    const params = new URLSearchParams({
      q: card.question,
      mode: "understand",
      context: [card.headline, card.detail, card.reason].join("\n"),
    });
    router.push(`/dashboard/polaris?${params.toString()}`);
  };

  return (
    <section className="flex min-h-screen flex-col px-6 pb-20 pt-6 lg:px-10">
      <IntroBanner tab="discover" copy={INTRO_COPY.discover} className="mb-2 shrink-0" />

      <header className="float-in pt-8">
        <PanelHeader title="discover what’s next.">
          <HeaderChip
            onClick={() => setSavedOpen(true)}
            aria-label={`saved discoveries, ${saved.length} saved`}
            className={saved.length ? "text-ph-white/90" : ""}
          >
            <StarIcon filled={saved.length > 0} />
            {saved.length}
          </HeaderChip>
        </PanelHeader>
      </header>

      {discoveries === null ? (
        <p className="float-in text-[13px] font-light text-ph-white/35" style={delay(0.12)}>
          looking across your platforms for what could be next. the first set can take a minute.
        </p>
      ) : discoveries.length === 0 ? (
        <p className="float-in max-w-[52ch] text-[15px] font-light leading-[1.55] text-ph-white/40" style={delay(0.12)}>
          nothing has surfaced yet. connect more platforms and come back soon.
        </p>
      ) : (
        <div className="float-in" style={delay(0.12)}>
          <DiscoverCarousel discoveries={discoveries} onSave={toggleSave} onSources={setSources} onAsk={ask} />
        </div>
      )}

      {sources && (
        <BehindDiscovery
          card={sources}
          onClose={() => setSources(null)}
          onAsk={() => {
            setSources(null);
            ask(sources);
          }}
        />
      )}
      {savedOpen && (
        <SavedDiscoveries
          saved={saved}
          onClose={() => setSavedOpen(false)}
          onRemove={toggleSave}
          onSources={(card) => {
            setSavedOpen(false);
            setSources(card);
          }}
          onAsk={ask}
        />
      )}
    </section>
  );
}

/** "behind this discovery": the public story, a divider, then each dated source of the reason. */
function BehindDiscovery({ card, onClose, onAsk }: { card: Discovery; onClose: () => void; onAsk: () => void }) {
  const years = trailYears(card.trail);
  return (
    <Popup title="behind this discovery" onClose={onClose}>
      <div className="flex flex-col gap-5">
        {card.story && (
          <section className="border-b border-ph-white/[0.08] pb-5">
            <p className="text-[12px] text-[var(--ph-accent)]">public story · {card.story.label}</p>
            <p className="mt-2 text-[14.5px] text-ph-white/92">{card.story.title}</p>
            <p className="mt-1 text-[13.5px] font-light leading-[1.6] text-ph-white/62">{card.story.detail}</p>
          </section>
        )}
        <section>
          <p className="text-[12px] text-[var(--ph-accent)]">
            {[years, card.sources.join(" + ")].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 text-[14.5px] text-ph-white/92">{card.reason}</p>
          <ul className="mt-3 flex flex-col gap-2.5">
            {card.trail.map((entry, i) => (
              <li key={`${entry.platform}-${entry.date}-${i}`} className="text-[13.5px] font-light leading-[1.55] text-ph-white/62">
                <span className="text-ph-white/45">
                  {trailDate(entry.date)} · {entry.platform}
                </span>{" "}
                {entry.detail}
              </li>
            ))}
          </ul>
        </section>
        <PrimaryButton onClick={onAsk}>explore this in polaris</PrimaryButton>
      </div>
    </Popup>
  );
}

/** The saved list, then one saved card with its sources, polaris and remove. */
function SavedDiscoveries({
  saved,
  onClose,
  onRemove,
  onSources,
  onAsk,
}: {
  saved: Discovery[];
  onClose: () => void;
  onRemove: (card: Discovery) => void;
  onSources: (card: Discovery) => void;
  onAsk: (card: Discovery) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const card = saved.find((s) => s.id === openId);

  if (card) {
    return (
      <Popup title="saved discovery" onClose={onClose}>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="flex items-center gap-1.5 self-start text-[12.5px] text-ph-white/60 transition-colors duration-200 hover:text-[var(--ph-accent)]"
          >
            <Arrow direction="left" size={12} /> saved
          </button>
          <h3 className="text-[17px] leading-[1.4] text-ph-white/95">{card.headline}</h3>
          <p className="text-[14px] font-light leading-[1.6] text-ph-white/75">{card.detail}</p>
          <p className="text-[13.5px] italic leading-[1.55] text-[rgba(var(--ph-accent-rgb),0.94)]">{card.reason}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <CardLink onClick={() => onSources(card)}>see the sources</CardLink>
            <CardLink onClick={() => onAsk(card)}>ask polaris</CardLink>
          </div>
          <button
            type="button"
            onClick={() => {
              onRemove(card);
              setOpenId(null);
            }}
            className="mt-2 self-start text-[12.5px] text-ph-white/50 transition-colors duration-200 hover:text-[var(--ph-accent)]"
          >
            remove from saved
          </button>
        </div>
      </Popup>
    );
  }

  return (
    <Popup title="saved discoveries" onClose={onClose}>
      {saved.length === 0 ? (
        <p className="text-[13.5px] font-light text-ph-white/55">discoveries you save will appear here.</p>
      ) : (
        <ul className="flex flex-col">
          {saved.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setOpenId(s.id)}
                className="group flex w-full items-center gap-4 border-b border-ph-white/[0.06] py-3 text-left last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] text-ph-white/92 transition-colors duration-200 group-hover:text-[var(--ph-accent)]">
                    {s.headline}
                  </span>
                  <span className="mt-1 block text-[12.5px] font-light leading-[1.5] text-ph-white/55">{s.reason}</span>
                </span>
                <span className="text-ph-white/50 group-hover:text-[var(--ph-accent)]">
                  <Arrow size={12} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popup>
  );
}
