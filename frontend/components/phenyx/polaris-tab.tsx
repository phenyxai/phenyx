"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useSearchParams } from "next/navigation";

import {
  askPolaris,
  getPolarisThread,
  getPolarisThreads,
  setPolarisPlan,
  startPurchase,
  type PolarisAllowance,
  type PolarisMode,
  type PolarisPlanState,
  type PolarisReturnQuestion,
  type PolarisSavedPlan,
  type PolarisStarter,
  type PolarisThreadSummary,
} from "@/lib/api-client";
import { V67_PRICING, pointsPrice, polarisMonthlyPointsFor, turnCost } from "@/lib/billing";
import { parsePlan, resetLabel, type ParsedPlan } from "@/lib/polaris-plan";
import { AccentDot, Popup, PrimaryButton, QuietAction, useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { HeaderChip } from "@/components/phenyx/panel-header";
import { Arrow } from "@/components/phenyx/nav-icons";
import { trackPolarisMessage } from "@/lib/analytics";
import { useTier } from "@/lib/use-tier";

// ============================================================================
// PolarisTab: home + conversation (PHE-73, PHE-94, PHE-123, PHE-129)
// ----------------------------------------------------------------------------
// HOME: "past conversations" and "usage" chips, a lit dot, "where would you
// like to begin?", the question box, and three starting points (one per mode,
// from the person's top pillars). Picking one fills the box and its mode.
// "Your conversations" (questions to return to, saved plans, then past
// conversations with search) and "polaris usage" (the month's points as a
// ring, when they reset, bought points, and adding more) are pop-ups.
//
// CONVERSATION: the question as the title with its topic under it and "leave
// chat" beside it, then the replies, each run opening with a small lit
// "polaris" tag. The whole conversation scrolls as one flow, with the box
// pinned to the foot and an arrow back to the top once the title has gone.
// A reply with numbered steps shows them as a plan card: steps to check off and
// a save, both kept per reply (POST /api/polaris/plans/:messageId).
//
// Polaris runs on points (30 free, 300 full a month): 3, 4 or 5 for an opening
// question by its mode, 2 for a follow-up. Out of points, the question waits
// in the box and a quiet note in the thread links to buying more. Deep links
// `/dashboard/polaris?q=&mode=&context=` (a discovery) open a conversation
// with that question, mode and context and send it.
// ============================================================================

const HOME_PLACEHOLDER = "ask about a pattern, a decision, or something on your mind";
const CHAT_PLACEHOLDER = "say what’s on your mind…";

const MODES: readonly PolarisMode[] = ["clarify", "understand", "decide"];

/** The three follow-ups after an answer (rebuild doc, section 8). Each costs 2 points. */
const FOLLOW_UPS: readonly string[] = ["where did this begin?", "what keeps reinforcing it?", "what could i do with it now?"];

type View = "home" | "chat";

interface CrisisResources {
  us: string;
  text: string;
  international: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  isCrisis?: boolean;
  resources?: CrisisResources | null;
}

type Plans = Record<string, PolarisPlanState>;

/** Guard so a Strict-Mode remount does not double-send a deep-link question. */
const consumedDeepLinks = new Set<string>();

function datedLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toLowerCase();
}

/** The topic line under a conversation's title: the part of the constellation it drew on. */
function topicLine(pillar: string | null | undefined): string | null {
  return pillar ? `drawing on ${pillar.replace(/_/g, "-")}` : null;
}

function asMode(value: string | null | undefined): PolarisMode | null {
  return MODES.includes(value as PolarisMode) ? (value as PolarisMode) : null;
}

function readDeepLink(searchParams: { get: (key: string) => string | null }): {
  q: string;
  mode: PolarisMode | null;
  context: string | null;
} {
  const read = (key: string) => {
    let value = searchParams.get(key)?.trim() ?? "";
    if (!value && typeof window !== "undefined") {
      value = new URLSearchParams(window.location.search).get(key)?.trim() ?? "";
    }
    return value;
  };
  return { q: read("q"), mode: asMode(read("mode")), context: read("context") || null };
}

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function PolarisTab() {
  const searchParams = useSearchParams();
  const { openModal } = useSettingsModals();
  const { tier } = useTier();

  const [view, setView] = useState<View>("home");
  const [popup, setPopup] = useState<"conversations" | "usage" | "add-points" | null>(null);

  const [threads, setThreads] = useState<PolarisThreadSummary[]>([]);
  const [starters, setStarters] = useState<PolarisStarter[]>([]);
  const [savedPlans, setSavedPlans] = useState<PolarisSavedPlan[]>([]);
  const [returns, setReturns] = useState<PolarisReturnQuestion[] | null>(null);
  // Backend points snapshot. Until it loads, the tier's monthly points stand
  // in so the ring never reads "0 of 0".
  const [allowance, setAllowance] = useState<PolarisAllowance | null>(null);

  // The mode a starting point picked; null for a typed question, whose mode polaris reads.
  const [mode, setMode] = useState<PolarisMode | null>(null);
  const [chatTitle, setChatTitle] = useState<string | null>(null);
  const [chatTopic, setChatTopic] = useState<string | null>(null);
  const [usedFollowUps, setUsedFollowUps] = useState<string[]>([]);

  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [plans, setPlans] = useState<Plans>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The turn that failed, kept so "try again" can resend it at no cost.
  const [failed, setFailed] = useState<{ question: string; followUp: boolean } | null>(null);

  const homeInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const threadIdRef = useRef<string | undefined>(undefined);
  threadIdRef.current = threadId;
  // How the open conversation opens: sent with its first question only.
  const openRef = useRef<{ mode: PolarisMode | null; context?: string | null }>({ mode: null });
  const sessionMessageCountRef = useRef(0);

  const tierLimit = polarisMonthlyPointsFor(tier);
  const remaining = allowance?.remaining ?? tierLimit;

  const applyAllowance = useCallback((next: PolarisAllowance | undefined) => {
    if (next && typeof next.remaining === "number" && typeof next.limit === "number") setAllowance(next);
  }, []);

  const openUsage = useCallback(() => setPopup("usage"), []);

  const loadHome = useCallback(async () => {
    try {
      const data = await getPolarisThreads();
      setThreads(data.threads ?? []);
      setStarters(data.starters ?? []);
      setSavedPlans(data.plans ?? []);
      setReturns(data.returns ?? null);
      applyAllowance(data.allowance);
    } catch {
      setThreads([]);
      setStarters([]);
    }
  }, [applyAllowance]);

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    if (view === "chat") {
      chatInputRef.current?.focus();
      autosize(chatInputRef.current);
    } else {
      autosize(homeInputRef.current);
    }
  }, [view]);

  useEffect(() => {
    if (view === "chat" && messages.length > 1) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending, view]);

  /**
   * Send one turn. Out of points, nothing is sent: the question waits in the
   * box and the note shows in the thread. A failed reply costs nothing and
   * keeps the turn for "try again" (`retry` resends it without a second bubble).
   */
  const sendQuestion = useCallback(
    async (question: string, followUp = false, retry = false) => {
      const q = question.trim();
      if (!q || sending) return;
      const opening = !threadIdRef.current;
      if (remaining < turnCost(!opening, opening ? openRef.current.mode : null)) {
        setInput(q);
        setLimitReached(true);
        return;
      }

      setSending(true);
      setError(null);
      setFailed(null);
      setLimitReached(false);
      if (!retry) setMessages((prev) => [...prev, { id: `local-user-${Date.now()}`, role: "user", body: q }]);

      try {
        const res = await askPolaris(q, threadIdRef.current, opening ? openRef.current : undefined, followUp);
        applyAllowance(res.allowance);

        if (res.limit_reached) {
          setMessages((prev) => prev.slice(0, -1));
          setInput(q);
          setLimitReached(true);
          return;
        }
        if (res.thread_id) {
          setThreadId(res.thread_id);
          threadIdRef.current = res.thread_id;
        }
        if (res.pillar_tag) setChatTopic(topicLine(res.pillar_tag));
        if (res.answer != null) {
          setMessages((prev) => [
            ...prev,
            {
              id: res.message_id ?? `local-ai-${Date.now()}`,
              role: "assistant",
              body: res.answer as string,
              isCrisis: res.is_crisis ?? false,
              resources: (res.resources as CrisisResources | undefined) ?? null,
            },
          ]);

          if (!res.is_crisis) {
            sessionMessageCountRef.current += 1;
            trackPolarisMessage({ count: sessionMessageCountRef.current, pillar_tag: res.pillar_tag, message: q });
          }
        }
      } catch {
        setError("polaris couldn’t answer just now. this one costs nothing.");
        setFailed({ question: q, followUp });
      } finally {
        setSending(false);
      }
    },
    [sending, remaining, applyAllowance],
  );

  /** Open a fresh conversation (a starting point's mode, or null for a typed question) and send its first question. */
  const startChat = useCallback(
    (question: string, nextMode: PolarisMode | null, context?: string | null) => {
      setMessages([]);
      setPlans({});
      setThreadId(undefined);
      threadIdRef.current = undefined;
      openRef.current = { mode: nextMode, context };
      setLimitReached(false);
      setError(null);
      setFailed(null);
      setInput("");
      setChatTitle(question.trim());
      setChatTopic(null);
      setUsedFollowUps([]);
      setMode(null);
      setView("chat");
      void sendQuestion(question);
    },
    [sendQuestion],
  );

  const openThread = useCallback(async (id: string) => {
    setPopup(null);
    setError(null);
    setFailed(null);
    setLimitReached(false);
    setThreadId(id);
    threadIdRef.current = id;
    setMessages([]);
    setPlans({});
    setChatTitle(null);
    setChatTopic(null);
    setUsedFollowUps([]);
    setView("chat");
    try {
      const detail = await getPolarisThread(id);
      setMessages(detail.messages.map((m) => ({ id: m.id, role: m.role, body: m.body })));
      setPlans(Object.fromEntries((detail.plans ?? []).map((p) => [p.message_id, p])));
      setChatTitle(detail.messages.find((m) => m.role === "user")?.body ?? null);
      setChatTopic(topicLine(detail.messages.find((m) => m.pillar_tag)?.pillar_tag));
    } catch {
      setError("could not load this conversation. please try again.");
    }
  }, []);

  const leaveChat = useCallback(() => {
    setView("home");
    setInput("");
    void loadHome();
  }, [loadHome]);

  const submitInput = useCallback(() => {
    const q = input.trim();
    if (!q) return;
    if (view !== "chat") {
      startChat(q, mode);
      return;
    }
    setInput("");
    void sendQuestion(q);
  }, [input, view, startChat, mode, sendQuestion]);

  const retry = useCallback(() => {
    if (failed) void sendQuestion(failed.question, failed.followUp, true);
  }, [failed, sendQuestion]);

  const pickStarter = useCallback((starter: PolarisStarter) => {
    setMode(starter.mode);
    setInput(starter.text);
    requestAnimationFrame(() => {
      autosize(homeInputRef.current);
      homeInputRef.current?.focus();
    });
  }, []);

  const followUp = useCallback(
    (question: string) => {
      setUsedFollowUps((prev) => [...prev, question]);
      void sendQuestion(question, true);
    },
    [sendQuestion],
  );

  // A plan's check-offs and save, kept optimistically and put back if the save fails.
  const updatePlan = useCallback((messageId: string, patch: { done?: number[]; saved?: boolean }) => {
    let before: PolarisPlanState | undefined;
    setPlans((all) => {
      before = all[messageId];
      const current = before ?? { message_id: messageId, done: [], saved: false };
      return { ...all, [messageId]: { ...current, ...patch } };
    });
    setSavedPlans((all) =>
      patch.done ? all.map((p) => (p.message_id === messageId ? { ...p, done: patch.done! } : p)) : all,
    );
    setPolarisPlan(messageId, patch).catch(() =>
      setPlans((all) => {
        const { [messageId]: _dropped, ...rest } = all;
        return before ? { ...rest, [messageId]: before } : rest;
      }),
    );
  }, []);

  // Deep links (PHE-70, PHE-123) route here with ?q=&mode=&context=. Read the
  // query on the client so a client-side `router.push` from another tab is
  // picked up even if this tab was already in the tree. Strip the query with
  // history.replaceState (not router.replace) so Next does not remount the tab
  // and drop the conversation that just started. A link without a mode opens
  // in understand: it comes from a discovery to follow further.
  useEffect(() => {
    const { q, mode: linkMode, context } = readDeepLink(searchParams);
    if (!q) return;
    const key = `${q}|${linkMode ?? ""}|${context ?? ""}`;
    if (consumedDeepLinks.has(key)) return;
    consumedDeepLinks.add(key);
    startChat(q, linkMode ?? "understand", context);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/dashboard/polaris");
    }
  }, [searchParams, startChat]);

  return (
    <div data-testid="polaris-panel" className="flex min-h-0 flex-1 flex-col">
      {view === "home" ? (
        <HomeView
          starters={starters}
          input={input}
          sending={sending}
          inputRef={homeInputRef}
          onStarter={pickStarter}
          onInputChange={(v) => {
            setInput(v);
            if (!v.trim()) setMode(null);
          }}
          onSubmit={submitInput}
          onConversations={() => setPopup("conversations")}
          onUsage={openUsage}
        />
      ) : (
        <ChatView
          title={chatTitle}
          topic={chatTopic}
          followUps={FOLLOW_UPS.filter((f) => !usedFollowUps.includes(f))}
          messages={messages}
          plans={plans}
          input={input}
          sending={sending}
          limitReached={limitReached}
          resets={resetLabel(allowance?.resets)}
          error={error}
          onRetry={failed ? retry : undefined}
          inputRef={chatInputRef}
          bottomRef={bottomRef}
          onLeave={leaveChat}
          onFollowUp={followUp}
          onPlan={updatePlan}
          onInputChange={setInput}
          onSubmit={submitInput}
          onBuyPoints={() => setPopup("add-points")}
        />
      )}

      {popup === "conversations" && (
        <ConversationsPopup
          threads={threads}
          plans={savedPlans}
          returns={returns}
          onUpgrade={() => {
            setPopup(null);
            openModal("subscription");
          }}
          onOpenThread={openThread}
          onPlan={updatePlan}
          onClose={() => setPopup(null)}
        />
      )}
      {(popup === "usage" || popup === "add-points") && (
        <UsagePopup
          allowance={allowance}
          fallbackLimit={tierLimit}
          adding={popup === "add-points"}
          onAdd={() => setPopup("add-points")}
          onUpgrade={() => {
            setPopup(null);
            openModal("subscription");
          }}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5v3.6h3.6M12 7.5V12l3 2" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

function HomeView({
  starters,
  input,
  sending,
  inputRef,
  onStarter,
  onInputChange,
  onSubmit,
  onConversations,
  onUsage,
}: {
  starters: PolarisStarter[];
  input: string;
  sending: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onStarter: (starter: PolarisStarter) => void;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onConversations: () => void;
  onUsage: () => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto [@media(max-width:640px)]:px-6 [@media(max-width:640px)]:pt-8 [@media(max-width:640px)]:pb-10 [@media(min-width:641px)]:pb-16">
      {/* From 641px the question and its starting points sit just above the middle of the screen, under the chips. */}
      <div className="mx-auto flex min-h-full w-full max-w-[780px] flex-col">
        <div className="flex items-center justify-between gap-3">
          <HeaderChip onClick={onConversations} className="text-ph-white/62">
            <HistoryIcon />
            past conversations
          </HeaderChip>
          <HeaderChip onClick={onUsage} aria-label="view polaris usage">
            <ClockIcon />
            usage
          </HeaderChip>
        </div>

        <div className="pt-9 [@media(min-width:641px)]:my-auto [@media(min-width:641px)]:pb-24">
          <div className="flex flex-col items-center gap-5 text-center">
            <span
              aria-hidden="true"
              className="h-[18px] w-[18px] rounded-full shadow-[0_0_14px_2px_rgba(var(--ph-accent-rgb),0.32)]"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, #fffaf2 0%, var(--ph-accent) 38%, color-mix(in srgb, var(--ph-accent) 40%, transparent) 70%, transparent 100%)",
              }}
            />
            <h1 className="text-[20px] font-normal leading-[1.35] text-ph-white/80">where would you like to begin?</h1>
          </div>

          <div className="mt-[30px]">
            <Composer
              value={input}
              placeholder={HOME_PLACEHOLDER}
              disabled={sending}
              inputRef={inputRef}
              onChange={onInputChange}
              onSubmit={onSubmit}
            />
          </div>

          {starters.length > 0 && (
            <div className="mt-[30px]">
              <p className="mb-2 text-[12.5px] font-semibold text-ph-white/84">starting points</p>
              <ul className="flex flex-col">
                {starters.map((s) => (
                  <li key={s.mode}>
                    <button
                      type="button"
                      onClick={() => onStarter(s)}
                      className="group flex min-h-[46px] w-full items-center gap-4 px-0.5 py-[7px] text-left"
                    >
                      <span className="min-w-0 flex-1 text-[14.5px] font-light leading-[1.5] text-ph-white/80 transition-colors duration-200 group-hover:text-[var(--ph-accent)]">
                        {s.text}
                      </span>
                      <span className="text-ph-white/76 transition-colors duration-200 group-hover:text-[var(--ph-accent)]">
                        <Arrow size={14} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The question box: home's and the conversation's. The send arrow shows once something is typed. */
function Composer({
  value,
  placeholder,
  disabled,
  inputRef,
  onChange,
  onSubmit,
  solid = false,
}: {
  value: string;
  placeholder: string;
  disabled: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (v: string) => void;
  onSubmit: () => void;
  /** The conversation's box sits over the thread, so it is opaque. */
  solid?: boolean;
}) {
  const typing = value.trim().length > 0;
  return (
    <div
      className={`relative min-h-[90px] rounded-[14px] border py-3.5 pr-[46px] pl-4 transition-colors duration-200 ${
        typing || solid ? "border-[rgba(var(--ph-accent-rgb),0.58)]" : "border-[rgba(var(--ph-accent-rgb),0.26)]"
      } ${solid ? "bg-[color-mix(in_srgb,var(--ph-accent)_3%,var(--ph-black))]" : "bg-[rgba(var(--ph-accent-rgb),0.02)]"}`}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          autosize(e.currentTarget);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        aria-label="ask polaris"
        placeholder={placeholder}
        rows={2}
        disabled={disabled}
        className="ph-bare-field block max-h-[200px] w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-[15px] font-light leading-6 text-ph-white/92 outline-none placeholder:text-ph-white/52"
      />
      {typing && (
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          data-testid="polaris-send"
          aria-label="send"
          className="absolute right-3 bottom-3 flex h-[30px] w-[30px] items-center justify-center rounded-full border border-[rgba(var(--ph-accent-rgb),0.3)] bg-[rgba(var(--ph-accent-rgb),0.067)] text-[var(--ph-accent)] transition-colors duration-200 hover:border-[var(--ph-accent)] disabled:opacity-40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

function ChatView({
  title,
  topic,
  followUps,
  messages,
  plans,
  input,
  sending,
  limitReached,
  resets,
  error,
  onRetry,
  inputRef,
  bottomRef,
  onLeave,
  onFollowUp,
  onPlan,
  onInputChange,
  onSubmit,
  onBuyPoints,
}: {
  title: string | null;
  topic: string | null;
  followUps: string[];
  messages: ChatMessage[];
  plans: Plans;
  input: string;
  sending: boolean;
  limitReached: boolean;
  /** When the monthly points come back, "nov 1". */
  resets: string;
  error: string | null;
  /** Set while a failed turn can be resent. */
  onRetry?: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  onLeave: () => void;
  onFollowUp: (question: string) => void;
  onPlan: (messageId: string, patch: { done?: number[]; saved?: boolean }) => void;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onBuyPoints: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLElement | null>(null);
  const [headGone, setHeadGone] = useState(false);
  const last = messages[messages.length - 1];
  const showFollowUps =
    !sending && !limitReached && !error && last?.role === "assistant" && !last.isCrisis && followUps.length > 0;
  // The opening question is the title, so its bubble is not repeated.
  const shown = title && messages[0]?.role === "user" && messages[0].body === title ? messages.slice(1) : messages;

  // The arrow back to the top shows once the title has scrolled away.
  useEffect(() => {
    const root = scrollRef.current;
    const head = headRef.current;
    if (!root || !head) return;
    const observer = new IntersectionObserver(([entry]) => setHeadGone(!entry.isIntersecting), { root });
    observer.observe(head);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto [@media(max-width:640px)]:px-6">
      <div className="mx-auto flex min-h-full w-full max-w-[900px] flex-col [@media(max-width:640px)]:pt-8">
        <header ref={headRef} className="flex items-start gap-4 pt-[3px] pb-5">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-[22px] font-medium leading-[1.38] text-ph-white/95 [text-wrap:pretty]">{title}</h2>
            )}
            {topic && <p className="mt-2 text-[12.5px] font-semibold text-[var(--ph-accent)]">{topic}</p>}
          </div>
          <button
            type="button"
            onClick={onLeave}
            className="h-9 shrink-0 rounded-full border border-ph-white/24 bg-ph-white/[0.024] px-[15px] text-[12px] font-medium text-ph-white/84 transition-colors duration-200 hover:border-[rgba(var(--ph-accent-rgb),0.5)] hover:text-[var(--ph-accent)]"
          >
            leave chat
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-3 pt-2 pb-6">
          {shown.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              opensRun={m.role === "assistant" && shown[i - 1]?.role !== "assistant"}
              plan={plans[m.id]}
              onPlan={(patch) => onPlan(m.id, patch)}
            />
          ))}

          {showFollowUps && (
            <div className="mt-1 flex flex-wrap gap-2">
              {followUps.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFollowUp(f)}
                  className="rounded-full bg-ph-white/[0.06] px-[13px] py-1.5 text-[12.5px] text-ph-white/82 transition-colors duration-200 hover:bg-[rgba(var(--ph-accent-rgb),0.14)] hover:text-ph-white"
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          {sending && (
            <span role="status" aria-label="polaris is thinking" className="ml-1 mt-2 flex h-6 items-center">
              <AccentDot className="motion-safe:animate-pulse" />
            </span>
          )}

          {limitReached && (
            <p role="status" className="mt-1 text-[14px] font-light leading-[1.6] text-ph-white/70">
              you need more points to continue. your monthly points refresh {resets}, or you can{" "}
              <button type="button" onClick={onBuyPoints} className="text-[var(--ph-accent)] underline underline-offset-[3px]">
                purchase more points
              </button>
              .
            </p>
          )}

          {error && (
            <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] font-light text-ph-white/70">
              {error}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="text-[var(--ph-accent)] underline underline-offset-[3px]"
                >
                  try again
                </button>
              )}
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="sticky bottom-0 bg-[var(--ph-black)] pt-2 pb-6">
          <Composer
            value={input}
            placeholder={CHAT_PLACEHOLDER}
            disabled={sending}
            inputRef={inputRef}
            onChange={onInputChange}
            onSubmit={onSubmit}
            solid
          />
        </div>
      </div>

      {headGone && (
        <button
          type="button"
          aria-label="back to top"
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed right-8 bottom-[140px] z-10 flex h-[34px] w-[34px] items-center justify-center rounded-full border border-ph-white/14 bg-[var(--ph-black)] text-ph-white/70 transition-colors duration-200 hover:border-[rgba(var(--ph-accent-rgb),0.5)] hover:text-[var(--ph-accent)] [@media(max-width:640px)]:bottom-[200px] [@media(max-width:640px)]:right-4"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 14.5l6-6 6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * One turn. The person's later turns sit right in a neutral bubble; polaris's
 * replies sit in a card with a faint accent edge, each run opening with a
 * small lit "polaris" tag. A reply with numbered steps shows them as a plan.
 */
function MessageBubble({
  message,
  opensRun,
  plan,
  onPlan,
}: {
  message: ChatMessage;
  opensRun: boolean;
  plan: PolarisPlanState | undefined;
  onPlan: (patch: { done?: number[]; saved?: boolean }) => void;
}) {
  const isUser = message.role === "user";
  const parsed = isUser || message.isCrisis ? null : parsePlan(message.body);
  const reply = (body: string) => (
    <div
      className={`whitespace-pre-wrap rounded-[13px] border px-3.5 py-3 text-[15.5px] font-medium leading-[1.68] ${
        isUser
          ? "border-ph-white/[0.08] bg-ph-white/[0.03] text-ph-white/90"
          : "border-[rgba(var(--ph-accent-rgb),0.22)] text-[#eee9e3]"
      }`}
    >
      {body}
      {message.isCrisis && message.resources && (
        <span className="mt-2 flex flex-col gap-1 text-[13px] font-light text-ph-white/60">
          <span>{message.resources.us}</span>
          <span>{message.resources.text}</span>
          <span>{message.resources.international}</span>
        </span>
      )}
    </div>
  );

  return (
    <div className={`flex max-w-[min(642px,92%)] flex-col gap-3 ${isUser ? "self-end" : "self-start"}`}>
      {opensRun && (
        <p className="ml-0.5 flex items-center gap-2 text-[11.5px] tracking-[0.04em] text-[var(--ph-accent)]">
          <AccentDot className="h-[5px] w-[5px]" /> polaris
        </p>
      )}
      {parsed ? (
        <>
          {parsed.before && reply(parsed.before)}
          <PlanCard plan={parsed} state={plan} onChange={onPlan} />
          {parsed.after && reply(parsed.after)}
        </>
      ) : (
        reply(message.body)
      )}
    </div>
  );
}

function BookmarkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4.5h10v15l-5-3.6-5 3.6z" />
    </svg>
  );
}

/** "your plan": its name, then steps to check off, and a save. */
function PlanCard({
  plan,
  state,
  onChange,
}: {
  plan: ParsedPlan;
  state: PolarisPlanState | undefined;
  onChange: (patch: { done?: number[]; saved?: boolean }) => void;
}) {
  const done = new Set(state?.done ?? []);
  const saved = state?.saved ?? false;
  const toggle = (i: number) => {
    const next = new Set(done);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    onChange({ done: [...next].sort((a, b) => a - b) });
  };

  return (
    <div className="w-[min(634px,100%)] rounded-2xl border border-ph-white/10 bg-ph-white/[0.02] px-[22px] py-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11.5px] font-medium text-[var(--ph-accent)]">your plan</span>
        <button
          type="button"
          aria-pressed={saved}
          onClick={() => onChange({ saved: !saved })}
          className={`flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors duration-200 hover:border-[rgba(var(--ph-accent-rgb),0.5)] hover:text-[var(--ph-accent)] ${
            saved
              ? "border-[rgba(var(--ph-accent-rgb),0.5)] bg-[rgba(var(--ph-accent-rgb),0.1)] text-[var(--ph-accent)]"
              : "border-ph-white/12 bg-ph-white/[0.02] text-ph-white/68"
          }`}
        >
          <BookmarkIcon />
          {saved ? "saved" : "save"}
        </button>
      </div>
      <h4 className="mt-2 text-[17px] font-medium leading-[1.68] text-ph-white/95">{plan.title}</h4>
      <ol className="mt-1">
        {plan.steps.map((step, i) => (
          <li key={i} className="flex items-start gap-4 border-b border-ph-white/[0.06] py-3.5 last:border-b-0">
            <button
              type="button"
              role="checkbox"
              aria-checked={done.has(i)}
              aria-label={`mark this step done: ${step.text}`}
              onClick={() => toggle(i)}
              className={`mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200 hover:border-[var(--ph-accent)] ${
                done.has(i) ? "border-[var(--ph-accent)] bg-[rgba(var(--ph-accent-rgb),0.2)] text-[var(--ph-accent)]" : "border-ph-white/28 text-transparent"
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </button>
            <div className="min-w-0">
              {step.meta && <small className="block text-[11.5px] font-medium text-ph-white/50">{step.meta}</small>}
              <p className={`text-[14.5px] font-medium leading-[1.55] ${done.has(i) ? "text-ph-white/45 line-through" : "text-ph-white/88"}`}>
                {step.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pop-ups
// ---------------------------------------------------------------------------

/** "your conversations": questions to return to, saved plans, then past conversations with search. */
function ConversationsPopup({
  threads,
  plans,
  returns,
  onUpgrade,
  onOpenThread,
  onPlan,
  onClose,
}: {
  threads: PolarisThreadSummary[];
  plans: PolarisSavedPlan[];
  /** Full: up to three open questions. Free: null, so the line to full shows instead. */
  returns: PolarisReturnQuestion[] | null;
  onUpgrade: () => void;
  onOpenThread: (id: string) => void;
  onPlan: (messageId: string, patch: { done?: number[]; saved?: boolean }) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [planId, setPlanId] = useState<string | null>(null);
  const needle = search.trim().toLowerCase();
  const shown = needle
    ? threads.filter((t) => `${t.title ?? ""} ${t.preview ?? ""}`.toLowerCase().includes(needle))
    : threads;
  const readable = plans.flatMap((p) => {
    const parsed = parsePlan(p.body);
    return parsed ? [{ ...p, parsed }] : [];
  });
  const open = readable.find((p) => p.message_id === planId);

  if (open) {
    return (
      <Popup title="saved plan" onClose={onClose} className="w-[min(680px,calc(100vw-40px))]">
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setPlanId(null)}
            className="flex items-center gap-1.5 self-start text-[12.5px] text-ph-white/60 transition-colors duration-200 hover:text-[var(--ph-accent)]"
          >
            <Arrow direction="left" size={12} /> your conversations
          </button>
          <PlanCard plan={open.parsed} state={open} onChange={(patch) => onPlan(open.message_id, patch)} />
          <QuietAction onClick={() => onOpenThread(open.thread_id)} className="self-start">
            open the conversation
          </QuietAction>
        </div>
      </Popup>
    );
  }

  return (
    <Popup title="your conversations" onClose={onClose} className="w-[min(680px,calc(100vw-40px))]">
      <div className="flex flex-col gap-6">
        {returns === null ? (
          <section>
            <SectionLabel>questions to return to</SectionLabel>
            <p className="text-[13.5px] font-light text-ph-white/62">return to unfinished questions with full</p>
            <QuietAction onClick={onUpgrade} className="mt-2">
              upgrade plan
            </QuietAction>
          </section>
        ) : (
          returns.length > 0 && (
            <section>
              <SectionLabel>questions to return to</SectionLabel>
              <ul className="flex flex-col">
                {returns.map((r) => (
                  <li key={r.thread_id}>
                    <ListRow onClick={() => onOpenThread(r.thread_id)} title={r.line} meta={r.title} />
                  </li>
                ))}
              </ul>
            </section>
          )
        )}
        {readable.length > 0 && (
          <section>
            <SectionLabel>saved plans</SectionLabel>
            <ul className="flex flex-col">
              {readable.map((p) => (
                <li key={p.message_id}>
                  <ListRow onClick={() => setPlanId(p.message_id)} title={p.parsed.title} meta={datedLabel(p.saved_at)} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <SectionLabel>past conversations</SectionLabel>
          {threads.length === 0 ? (
            <p className="text-[13.5px] font-light text-ph-white/55">your conversations with polaris will appear here.</p>
          ) : (
            <>
              <label className="mb-2 flex h-[38px] items-center gap-2.5 rounded-full border border-ph-white/12 px-4 focus-within:border-[rgba(var(--ph-accent-rgb),0.5)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" className="text-ph-white/50">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="M16 16l4 4" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="search conversations"
                  placeholder="search conversations"
                  className="ph-bare-field min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] text-ph-white/90 outline-none placeholder:text-ph-white/45"
                />
              </label>
              {shown.length === 0 ? (
                <p className="py-3 text-[13px] font-light text-ph-white/45">nothing matches that yet.</p>
              ) : (
                <ul className="flex flex-col">
                  {shown.map((t) => (
                    <li key={t.id}>
                      <ListRow onClick={() => onOpenThread(t.id)} title={t.title ?? t.preview ?? "conversation"} meta={datedLabel(t.updated_at)} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </Popup>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2.5 text-[11px] font-semibold tracking-[0.08em] text-[var(--ph-accent)]">{children}</p>;
}

function ListRow({ onClick, title, meta }: { onClick: () => void; title: string; meta: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-4 border-b border-ph-white/[0.06] py-3 text-left"
    >
      <span className="min-w-0 flex-1 truncate text-[14.5px] text-ph-white/88 transition-colors duration-200 group-hover:text-[var(--ph-accent)]">
        {title}
      </span>
      <span className="max-w-[14rem] shrink-0 truncate text-[12px] text-ph-white/55">{meta}</span>
    </button>
  );
}

const POINT_STEPS = Array.from(
  { length: V67_PRICING.pointsMax / V67_PRICING.pointsStep },
  (_, i) => (i + 1) * V67_PRICING.pointsStep,
);

/**
 * "polaris usage": the month's points as a ring that fills as they are used,
 * how many are left, when they reset, bought points still available, "add
 * points" (100 to 2,000, then checkout) and "upgrade plan".
 */
function UsagePopup({
  allowance,
  fallbackLimit,
  adding,
  onAdd,
  onUpgrade,
  onClose,
}: {
  allowance: PolarisAllowance | null;
  /** The tier's monthly points, until the backend snapshot loads. */
  fallbackLimit: number;
  /** Open on the points picker (from "purchase more points"). */
  adding: boolean;
  onAdd: () => void;
  onUpgrade: () => void;
  onClose: () => void;
}) {
  const [points, setPoints] = useState<number>(V67_PRICING.pointsStep);
  const [checkout, setCheckout] = useState<"idle" | "loading" | "failed">("idle");
  const limit = allowance?.limit ?? fallbackLimit;
  const left = allowance?.monthly_left ?? limit;
  const used = Math.max(0, limit - left);
  const purchased = allowance?.purchased ?? 0;
  const circumference = 2 * Math.PI * 42;

  const buy = async () => {
    setCheckout("loading");
    try {
      await startPurchase("points", points);
    } catch {
      setCheckout("failed");
    }
  };

  return (
    <Popup title="polaris usage" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="text-[14px] font-light leading-[1.6] text-ph-white/75">polaris runs on points. buy more to keep chatting.</p>
        <div className="flex items-center gap-6">
          <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,253,253,0.08)" strokeWidth="6" />
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="var(--ph-accent)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={limit > 0 ? circumference * (1 - used / limit) : circumference}
              />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center text-[20px] leading-none text-ph-white/92">
              {left}
              <small className="mt-1 text-[11px] text-ph-white/60">left</small>
            </span>
          </div>
          <div>
            <p className="text-[15.5px] text-ph-white/90">
              {used} of {limit} points used this month
            </p>
            <p className="mt-1 text-[13px] text-ph-white/52">resets {resetLabel(allowance?.resets)}</p>
            {purchased > 0 && <p className="mt-1 text-[13px] text-ph-white/52">plus {purchased} purchased points</p>}
          </div>
        </div>
        {adding ? (
          <div className="flex flex-col gap-3">
            <label className="flex h-11 items-center justify-between gap-3 rounded-full border border-ph-white/14 px-4 focus-within:border-[rgba(var(--ph-accent-rgb),0.5)]">
              <select
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                aria-label="how many points"
                className="ph-bare-field min-w-0 flex-1 cursor-pointer appearance-none border-0 bg-transparent p-0 text-[14px] text-ph-white/90 outline-none"
              >
                {POINT_STEPS.map((n) => (
                  <option key={n} value={n} className="bg-[var(--ph-black)]">
                    {n.toLocaleString("en-US")} points
                  </option>
                ))}
              </select>
              <span className="shrink-0 text-[13px] text-ph-white/62">{pointsPrice(points)}</span>
            </label>
            <PrimaryButton onClick={buy} disabled={checkout === "loading"}>
              continue to checkout
            </PrimaryButton>
            {checkout === "failed" && (
              <p className="text-[13px] font-light text-ph-white/62">checkout could not be started. please try again.</p>
            )}
          </div>
        ) : (
          <PrimaryButton onClick={onAdd}>add points</PrimaryButton>
        )}
        <QuietAction onClick={onUpgrade} className="self-center">
          upgrade plan
        </QuietAction>
      </div>
    </Popup>
  );
}

export default PolarisTab;
