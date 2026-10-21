"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, startPurchase } from "@/lib/api-client";
import { V67_PRICING } from "@/lib/billing";
import {
  discoveriesLabel,
  refreshLabel,
  trailLine,
  trailYears,
  type Discovery,
  type DiscoveryAllowance,
} from "@/lib/discover";
import { IntroBanner, INTRO_COPY } from "@/components/phenyx/intro-banner";
import { CardLink, DiscoverCarousel, StarIcon } from "@/components/phenyx/discover-carousel";
import { HeaderChip, PanelHeader } from "@/components/phenyx/panel-header";
import { Arrow } from "@/components/phenyx/nav-icons";
import { Popup, PrimaryButton, QuietAction, useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";

// ============================================================================
// Discover tab (PHE-103, PHE-129, spec doc 3, rebuild doc 9)
// ----------------------------------------------------------------------------
// The deck from `GET /discover`, one card at a time: every card the person has
// revealed, newest first. The first visit waits while the starting deck is
// generated, which can take a minute. The read fails soft: any error renders
// the empty state.
//
// New cards come through the week's allowance (1 free, 10 full, opening monday
// 9am local) and bought discoveries. "n new discoveries" opens "use
// discoveries", which adds them (`POST /discover/reveal`) with a brief "added
// to your deck"; with none left it opens "more discoveries" (packs of 1, 3 or
// 10, then checkout). A new card joins the deck with a "new" tag and never
// replaces one; when nothing new turns up the pop-up says "all caught up" and
// nothing is used.
//
// The ★ saves a card (`POST /discover/:id/save`) and the ★ pill opens the
// saved list. "Ask polaris" opens a chat seeded with the card's own question
// and the card as context. "See the sources" opens "behind this discovery".
// ============================================================================

const delay = (seconds: number) => ({ "--float-delay": `${seconds}s` }) as CSSProperties;
const TOAST_MS = 2400;

/** The browser's time zone: the week opens monday 9am there. */
function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function DiscoverTabPage() {
  const router = useRouter();
  const { openModal } = useSettingsModals();
  const [deck, setDeck] = useState<Discovery[] | null>(null);
  const [saved, setSaved] = useState<Discovery[]>([]);
  const [allowance, setAllowance] = useState<DiscoveryAllowance | null>(null);
  const [sources, setSources] = useState<Discovery | null>(null);
  const [popup, setPopup] = useState<"saved" | "use" | "more" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiFetch(`/discover?tz=${encodeURIComponent(timeZone())}`);
        if (!res.ok) throw new Error(`discover ${res.status}`);
        const data = (await res.json()) as { deck?: Discovery[]; saved?: Discovery[]; allowance?: DiscoveryAllowance };
        if (!active) return;
        setDeck(data.deck ?? []);
        setSaved(data.saved ?? []);
        setAllowance(data.allowance ?? null);
      } catch {
        if (active) setDeck([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // Saved optimistically in both lists, put back if the save fails.
  const toggleSave = (card: Discovery) => {
    const next = !saved.some((s) => s.id === card.id);
    const apply = (on: boolean) => {
      setDeck((all) => all?.map((d) => (d.id === card.id ? { ...d, saved: on } : d)) ?? all);
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

  /** Add `count` to the deck. Resolves "caught-up" when nothing new turned up (nothing used). */
  const reveal = async (count: number): Promise<"added" | "caught-up" | "failed"> => {
    try {
      const res = await apiFetch("/discover/reveal", { method: "POST", body: JSON.stringify({ count, tz: timeZone() }) });
      if (!res.ok) throw new Error(`reveal ${res.status}`);
      const data = (await res.json()) as { added: Discovery[]; caught_up: boolean; short: boolean; allowance: DiscoveryAllowance };
      setAllowance(data.allowance);
      if (data.short) {
        setPopup("more");
        return "failed";
      }
      if (data.caught_up || data.added.length === 0) return "caught-up";
      const added = new Set(data.added.map((d) => d.id));
      setDeck((all) => [...data.added, ...(all ?? []).filter((d) => !added.has(d.id))]);
      setPopup(null);
      setToast("added to your deck");
      return "added";
    } catch {
      return "failed";
    }
  };

  const available = allowance?.available ?? 0;
  const upgrade = () => {
    setPopup(null);
    openModal("subscription");
  };

  return (
    <section className="flex min-h-screen flex-col px-6 pb-20 pt-6 lg:px-10">
      <IntroBanner tab="discover" copy={INTRO_COPY.discover} className="mb-2 shrink-0" />

      <header className="float-in pt-8">
        <PanelHeader title="discover what’s next.">
          {allowance && (
            <HeaderChip
              onClick={() => setPopup(available > 0 ? "use" : "more")}
              className={available > 0 ? "border-[rgba(var(--ph-accent-rgb),0.5)] text-[var(--ph-accent)]" : ""}
            >
              {available > 0 ? `${available} new ${available === 1 ? "discovery" : "discoveries"}` : "new discovery"}
            </HeaderChip>
          )}
          <HeaderChip
            onClick={() => setPopup("saved")}
            aria-label={`saved discoveries, ${saved.length} saved`}
            className={saved.length ? "text-ph-white/90" : ""}
          >
            <StarIcon filled={saved.length > 0} />
            {saved.length}
          </HeaderChip>
        </PanelHeader>
      </header>

      {deck === null ? (
        <p className="float-in text-[13px] font-light text-ph-white/35" style={delay(0.12)}>
          looking across your platforms for what could be next. the first set can take a minute.
        </p>
      ) : deck.length === 0 ? (
        <p className="float-in max-w-[52ch] text-[15px] font-light leading-[1.55] text-ph-white/40" style={delay(0.12)}>
          nothing has surfaced yet. connect more platforms and come back soon.
        </p>
      ) : (
        <div className="float-in" style={delay(0.12)}>
          <DiscoverCarousel discoveries={deck} onSave={toggleSave} onSources={setSources} onAsk={ask} />
        </div>
      )}

      {toast && (
        <p
          role="status"
          className="fixed bottom-8 left-1/2 z-20 -translate-x-1/2 rounded-full border border-[rgba(var(--ph-accent-rgb),0.4)] bg-[var(--ph-black)] px-4 py-2 text-[12.5px] text-[var(--ph-accent)]"
        >
          {toast}
        </p>
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
      {popup === "saved" && (
        <SavedDiscoveries
          saved={saved}
          onClose={() => setPopup(null)}
          onRemove={toggleSave}
          onSources={(card) => {
            setPopup(null);
            setSources(card);
          }}
          onAsk={ask}
        />
      )}
      {popup === "use" && allowance && (
        <UseDiscoveries allowance={allowance} onUse={reveal} onClose={() => setPopup(null)} />
      )}
      {popup === "more" && allowance && (
        <MoreDiscoveries allowance={allowance} onUpgrade={upgrade} onClose={() => setPopup(null)} />
      )}
    </section>
  );
}

/**
 * "use your free weekly discovery" (one from the week) or "use discoveries"
 * with a count: what a discovery is, what this uses and leaves, and when the
 * week refreshes. Nothing is used when nothing new turns up.
 */
function UseDiscoveries({
  allowance,
  onUse,
  onClose,
}: {
  allowance: DiscoveryAllowance;
  onUse: (count: number) => Promise<"added" | "caught-up" | "failed">;
  onClose: () => void;
}) {
  const most = Math.min(allowance.available, 10);
  const [count, setCount] = useState(1);
  const [state, setState] = useState<"idle" | "loading" | "caught-up" | "failed">("idle");
  const weekly = allowance.available === 1 && allowance.weekly_left === 1;
  const title = most > 1 ? "use discoveries" : weekly ? "use your free weekly discovery" : "use a discovery";

  const use = async () => {
    setState("loading");
    const result = await onUse(count);
    if (result !== "added") setState(result);
  };

  if (state === "caught-up") {
    return (
      <Popup title="all caught up" onClose={onClose}>
        <div className="flex flex-col gap-4">
          <p className="text-[14px] font-light leading-[1.6] text-ph-white/75">
            you’ve seen every discovery there is for now, so nothing was used. new ones arrive as your platforms do.
          </p>
          <PrimaryButton onClick={onClose}>done</PrimaryButton>
        </div>
      </Popup>
    );
  }

  return (
    <Popup title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-[14px] font-light leading-[1.6] text-ph-white/75">
          find facts, people, places, or things to try, chosen from your interests.
        </p>
        {most > 1 && (
          <label className="flex h-11 items-center rounded-full border border-ph-white/14 px-4 focus-within:border-[rgba(var(--ph-accent-rgb),0.5)]">
            <select
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              aria-label="how many discoveries"
              className="ph-bare-field min-w-0 flex-1 cursor-pointer appearance-none border-0 bg-transparent p-0 text-[14px] text-ph-white/90 outline-none"
            >
              {Array.from({ length: most }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n} className="bg-[var(--ph-black)]">
                  {discoveriesLabel(n)}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="text-[13px] leading-[1.55] text-ph-white/58">
          this uses {discoveriesLabel(count)}, and {allowance.available - count} will remain. your next weekly refresh arrives{" "}
          {refreshLabel(allowance.resets)}.
        </p>
        <PrimaryButton onClick={use} disabled={state === "loading"}>
          {state === "loading" ? "finding your discoveries…" : `use ${discoveriesLabel(count)}`}
        </PrimaryButton>
        {state === "failed" && (
          <p className="text-[13px] font-light text-ph-white/62">that didn’t go through, and nothing was used. please try again.</p>
        )}
      </div>
    </Popup>
  );
}

/** "more discoveries": what was used, three packs, checkout, and the plan. */
function MoreDiscoveries({
  allowance,
  onUpgrade,
  onClose,
}: {
  allowance: DiscoveryAllowance;
  onUpgrade: () => void;
  onClose: () => void;
}) {
  const [pack, setPack] = useState<number>(V67_PRICING.discoveryPacks[0].size);
  const [checkout, setCheckout] = useState<"idle" | "loading" | "failed">("idle");
  const buy = async () => {
    setCheckout("loading");
    try {
      await startPurchase("discoveries", pack);
    } catch {
      setCheckout("failed");
    }
  };

  return (
    <Popup title="more discoveries" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-[14px] font-light leading-[1.6] text-ph-white/75">
          you’ve used this week’s {discoveriesLabel(allowance.limit)}. purchased discoveries stay until you use them, and
          your next weekly refresh arrives {refreshLabel(allowance.resets)}.
        </p>
        <div role="radiogroup" aria-label="discovery packs" className="grid grid-cols-3 gap-2">
          {V67_PRICING.discoveryPacks.map((p) => (
            <button
              key={p.size}
              type="button"
              role="radio"
              aria-checked={pack === p.size}
              onClick={() => setPack(p.size)}
              className={`flex flex-col items-center gap-1 rounded-[14px] border px-2 py-3 transition-colors duration-200 hover:border-[var(--ph-accent)] ${
                pack === p.size
                  ? "border-[var(--ph-accent)] bg-[rgba(var(--ph-accent-rgb),0.08)] text-[var(--ph-accent)]"
                  : "border-ph-white/12 text-ph-white/80"
              }`}
            >
              <span className="text-[15px]">{p.size}</span>
              <span className="text-[12px] text-ph-white/58">${p.price.toFixed(2)}</span>
            </button>
          ))}
        </div>
        <PrimaryButton onClick={buy} disabled={checkout === "loading"}>
          continue to checkout
        </PrimaryButton>
        {checkout === "failed" && (
          <p className="text-[13px] font-light text-ph-white/62">checkout could not be started. please try again.</p>
        )}
        <QuietAction onClick={onUpgrade} className="self-center">
          upgrade plan
        </QuietAction>
      </div>
    </Popup>
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
          <ul className="mt-3 flex flex-col gap-3">
            {card.trail.map((entry, i) => (
              <li key={`${entry.platform}-${entry.date}-${i}`} className="text-[13.5px] leading-[1.55]">
                <span className="block text-[12.5px] text-ph-white/52">{trailLine(entry)}</span>
                <span className="block font-light text-ph-white/72">{entry.detail}</span>
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
