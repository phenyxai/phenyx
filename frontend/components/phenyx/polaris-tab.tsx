"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useSearchParams } from "next/navigation";

import {
  askPolaris,
  getPolarisThread,
  getPolarisThreads,
  type PolarisAllowance,
  type PolarisMode,
  type PolarisStarter,
  type PolarisThreadSummary,
} from "@/lib/api-client";
import {
  V67_PRICING,
  polarisAllowanceLabel,
  polarisWeeklyQuestionsFor,
} from "@/lib/billing";
import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { trackPolarisMessage } from "@/lib/analytics";
import { useTier } from "@/lib/use-tier";

// ============================================================================
// PolarisTab: home + conversation (PHE-73, PHE-94, modes from PHE-123)
// ----------------------------------------------------------------------------
// Two views behind one flex-column panel (never display:block, which unpins
// the composer from the foot):
//
//   • HOME: "where would you like to begin?", the allowance badge, a free-text
//     box, the three modes (clarify, understand, decide), one starter question
//     per mode from the person's top pillars, and past conversations with
//     search. Picking a starter selects its mode and fills in the question.
//   • CONVERSATION: back to polaris, the mode tag, the allowance badge, then
//     the question as a full-width title with its topic line. Each run of
//     replies opens with a "✦ polaris" tag; three follow-ups sit under the
//     latest reply; "keep going…" stays pinned to the foot while only the
//     conversation scrolls.
//
// The weekly allowance is counted in QUESTIONS (3 on free, 40 on full) and both
// numbers on the badge come from the backend allowance. The badge, and the
// at-limit state, open the top-up sheet on full and the upgrade modal on free.
// Deep links `/dashboard/polaris?q=&mode=&context=` (a moment or a discovery)
// open a conversation with that question, mode and context and send it.
// ============================================================================

const ACCENT = "var(--ph-accent)";

/** Explains the allowance inside the top-up sheet (the old token popover is gone). */
const ALLOWANCE_NOTE =
  "questions reset every week. a top-up adds a few more before then and does not change the reset.";

const HOME_PLACEHOLDER = "what are you trying to clarify, understand or decide?";
const CHAT_PLACEHOLDER = "keep going…";

const MODES: ReadonlyArray<{ id: PolarisMode; blurb: string }> = [
  { id: "clarify", blurb: "untangle a question" },
  { id: "understand", blurb: "explore a recurring pattern" },
  { id: "decide", blurb: "choose a direction and shape next steps" },
];

// ponytail: fixed follow-ups per mode; generate them per reply if these start to feel generic.
const FOLLOW_UPS: Record<PolarisMode, readonly string[]> = {
  clarify: ["what am i really asking?", "where did this begin?", "what would make this clearer?"],
  understand: ["where did this begin?", "what keeps reinforcing it?", "what could i do with it now?"],
  decide: ["what does my history already support?", "what would i be giving up?", "what could the first step be?"],
};

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

/** Guard so a Strict-Mode remount does not double-send a deep-link question. */
const consumedDeepLinks = new Set<string>();

function datedLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toLowerCase();
}

/** The topic line under a conversation's title: the part of the constellation it drew on. */
function topicLine(pillar: string | null | undefined): string | null {
  return pillar ? `drawing on ${pillar.replace(/_/g, "-")}` : null;
}

function asMode(value: string | null | undefined): PolarisMode | null {
  return MODES.some((m) => m.id === value) ? (value as PolarisMode) : null;
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
  const { tier, isPro } = useTier();

  const [view, setView] = useState<View>("home");
  const [topupOpen, setTopupOpen] = useState(false);

  const [threads, setThreads] = useState<PolarisThreadSummary[]>([]);
  const [starters, setStarters] = useState<PolarisStarter[]>([]);
  // Backend allowance snapshot. Until it loads, the badge falls back to the
  // tier's full allowance so it never reads "0 of 0".
  const [allowance, setAllowance] = useState<Pick<
    PolarisAllowance,
    "remaining" | "limit"
  > | null>(null);

  // The mode picked on home (null until one is), and the open conversation's.
  const [mode, setMode] = useState<PolarisMode | null>(null);
  const [chatMode, setChatMode] = useState<PolarisMode>("clarify");
  const [chatTitle, setChatTitle] = useState<string | null>(null);
  const [chatTopic, setChatTopic] = useState<string | null>(null);
  const [usedFollowUps, setUsedFollowUps] = useState<string[]>([]);

  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const homeInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const threadIdRef = useRef<string | undefined>(undefined);
  threadIdRef.current = threadId;
  const sessionMessageCountRef = useRef(0);

  const tierLimit = polarisWeeklyQuestionsFor(tier);
  const limit = allowance?.limit ?? tierLimit;
  const remaining = allowance?.remaining ?? tierLimit;
  const allowanceLabel = polarisAllowanceLabel(remaining, tier, limit);

  const applyAllowance = useCallback((next: PolarisAllowance | undefined) => {
    if (
      next &&
      typeof next.remaining === "number" &&
      typeof next.limit === "number"
    ) {
      setAllowance({ remaining: next.remaining, limit: next.limit });
    }
  }, []);

  const openTopup = useCallback(() => setTopupOpen(true), []);
  const openUpgrade = useCallback(() => openModal("upgrade"), [openModal]);
  // The allowance badge and the at-limit state: full gets the top-up sheet,
  // free gets the upgrade modal (prototype `openPolarisAllowance`).
  const openAllowance = useCallback(() => {
    if (isPro) openTopup();
    else openUpgrade();
  }, [isPro, openTopup, openUpgrade]);

  const loadHome = useCallback(async () => {
    try {
      const data = await getPolarisThreads();
      setThreads(data.threads ?? []);
      setStarters(data.starters ?? []);
      applyAllowance(data.allowance);
      if (typeof data.allowance?.limit_reached === "boolean") {
        setLimitReached(data.allowance.limit_reached);
      }
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
    if (view === "chat") bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending, view]);

  const sendQuestion = useCallback(
    async (question: string, open?: { mode: PolarisMode; context?: string | null }) => {
      const q = question.trim();
      if (!q || sending) return;

      setSending(true);
      setError(null);
      setLimitReached(false);
      setMessages((prev) => [
        ...prev,
        { id: `local-user-${Date.now()}`, role: "user", body: q },
      ]);

      try {
        const res = await askPolaris(q, threadIdRef.current, open);
        setThreadId(res.thread_id);
        threadIdRef.current = res.thread_id;
        if (res.mode) setChatMode(res.mode);
        if (res.pillar_tag) setChatTopic(topicLine(res.pillar_tag));
        applyAllowance(res.allowance);

        if (res.limit_reached) {
          setLimitReached(true);
          setAllowance((prev) => ({
            remaining: 0,
            limit: res.allowance?.limit ?? prev?.limit ?? tierLimit,
          }));
          openAllowance();
        } else if (res.answer != null) {
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
            trackPolarisMessage({
              count: sessionMessageCountRef.current,
              pillar_tag: res.pillar_tag,
              message: q,
            });
          }
        }
      } catch {
        setError("polaris is unavailable right now. please try again.");
      } finally {
        setSending(false);
      }
    },
    [sending, openAllowance, applyAllowance, tierLimit]
  );

  /** Open a fresh conversation in `nextMode` and send its first question. */
  const startChat = useCallback(
    (question: string, nextMode: PolarisMode, context?: string | null) => {
      setMessages([]);
      setThreadId(undefined);
      threadIdRef.current = undefined;
      setLimitReached(false);
      setError(null);
      setInput("");
      setChatMode(nextMode);
      setChatTitle(question.trim());
      setChatTopic(null);
      setUsedFollowUps([]);
      setView("chat");
      void sendQuestion(question, { mode: nextMode, context });
    },
    [sendQuestion]
  );

  const openThread = useCallback(async (id: string) => {
    setError(null);
    setLimitReached(false);
    setThreadId(id);
    threadIdRef.current = id;
    setMessages([]);
    setChatTitle(null);
    setChatTopic(null);
    setUsedFollowUps([]);
    setView("chat");
    try {
      const detail = await getPolarisThread(id);
      setMessages(
        detail.messages.map((m) => ({
          id: m.id,
          role: m.role,
          body: m.body,
        }))
      );
      setChatMode(detail.mode ?? "clarify");
      setChatTitle(detail.messages.find((m) => m.role === "user")?.body ?? null);
      setChatTopic(topicLine(detail.messages.find((m) => m.pillar_tag)?.pillar_tag));
    } catch {
      setError("could not load this conversation. please try again.");
    }
  }, []);

  const backToHome = useCallback(() => {
    setView("home");
    setInput("");
    void loadHome();
  }, [loadHome]);

  const submitInput = useCallback(() => {
    const q = input.trim();
    if (!q) return;
    if (remaining <= 0) {
      openAllowance();
      return;
    }
    if (view !== "chat") {
      startChat(q, mode ?? "clarify");
      return;
    }
    setInput("");
    void sendQuestion(q);
  }, [input, remaining, openAllowance, view, startChat, mode, sendQuestion]);

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
      if (remaining <= 0) {
        openAllowance();
        return;
      }
      setUsedFollowUps((prev) => [...prev, question]);
      void sendQuestion(question);
    },
    [remaining, openAllowance, sendQuestion]
  );

  // Deep links (PHE-70, PHE-123) route here with ?q=&mode=&context=. Read the
  // query on the client so a client-side `router.push` from another tab is
  // picked up even if this tab was already in the tree. Strip the query with
  // history.replaceState (not router.replace) so Next does not remount the tab
  // and drop the conversation that just started. A link without a mode opens
  // in understand: it comes from a moment or a discovery to follow further.
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
    <div
      data-testid="polaris-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(var(--app-h, 100vh) - 210px)",
        minHeight: "min(600px, calc(var(--app-h, 100vh) - 210px))",
      }}
    >
      <style>{`
        @layer base {
          [data-testid="polaris-panel"] textarea[data-polaris-input]::placeholder {
            color: rgba(255,253,253,0.52) !important;
          }
          [data-testid="polaris-panel"] textarea[data-polaris-input],
          [data-testid="polaris-panel"] textarea[data-polaris-input]:focus,
          [data-testid="polaris-panel"] input[data-polaris-search],
          [data-testid="polaris-panel"] input[data-polaris-search]:focus {
            background: transparent !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 2px 0 !important;
          }
        }
        /* PHE-98: text and border warm to the accent through the shared
           hover rule in globals.css; only fills and inner marks live here. */
        @media (hover: hover) {
          [data-polaris-card]:hover {
            background: rgba(255,253,253,0.02) !important;
          }
          [data-polaris-allowance-badge]:hover [data-polaris-allowance-plus] {
            color: var(--ph-accent) !important;
          }
          [data-polaris-topup-cta]:hover {
            background: rgba(var(--ph-accent-rgb),0.16) !important;
          }
        }
      `}</style>
      {view === "home" ? (
        <HomeView
          starters={starters}
          threads={threads}
          mode={mode}
          allowanceLabel={allowanceLabel}
          input={input}
          sending={sending}
          inputRef={homeInputRef}
          onMode={setMode}
          onStarter={pickStarter}
          onInputChange={setInput}
          onSubmit={submitInput}
          onOpenThread={openThread}
          onAllowance={openAllowance}
        />
      ) : (
        <ChatView
          mode={chatMode}
          title={chatTitle}
          topic={chatTopic}
          followUps={FOLLOW_UPS[chatMode].filter((f) => !usedFollowUps.includes(f))}
          messages={messages}
          input={input}
          sending={sending}
          limitReached={limitReached}
          isPro={isPro}
          error={error}
          allowanceLabel={allowanceLabel}
          inputRef={chatInputRef}
          bottomRef={bottomRef}
          onBack={backToHome}
          onFollowUp={followUp}
          onInputChange={setInput}
          onSubmit={submitInput}
          onAllowance={openAllowance}
        />
      )}

      {topupOpen && (
        <TopupSheet
          allowanceLabel={allowanceLabel}
          onClose={() => setTopupOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

/** Small, lowercase, accent: the label above a group on polaris home. */
function GroupLabel({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 12, letterSpacing: "0.04em", color: ACCENT, margin: "0 0 10px" }}>
      {children}
    </p>
  );
}

function HomeView({
  starters,
  threads,
  mode,
  allowanceLabel,
  input,
  sending,
  inputRef,
  onMode,
  onStarter,
  onInputChange,
  onSubmit,
  onOpenThread,
  onAllowance,
}: {
  starters: PolarisStarter[];
  threads: PolarisThreadSummary[];
  mode: PolarisMode | null;
  allowanceLabel: string;
  input: string;
  sending: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onMode: (mode: PolarisMode) => void;
  onStarter: (starter: PolarisStarter) => void;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onOpenThread: (id: string) => void;
  onAllowance: () => void;
}) {
  const [search, setSearch] = useState("");
  const needle = search.trim().toLowerCase();
  const shown = needle
    ? threads.filter((t) => `${t.title ?? ""} ${t.preview ?? ""}`.toLowerCase().includes(needle))
    : threads;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: "24px 24px 40px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto" }}>
        <div
          data-polaris-hero
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 10,
            marginBottom: 26,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 30, color: ACCENT }}>
            ✦
          </span>
          <h1
            style={{
              fontSize: "clamp(18px, 1.8vw, 22px)",
              fontWeight: 300,
              color: "rgba(255,253,253,0.94)",
              lineHeight: 1.35,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            where would you like to begin?
          </h1>
          <AllowanceBadge
            label={allowanceLabel}
            onClick={onAllowance}
            style={{ margin: "6px auto 0" }}
          />
        </div>

        <Composer
          value={input}
          placeholder={HOME_PLACEHOLDER}
          disabled={sending}
          inputRef={inputRef}
          onChange={onInputChange}
          onSubmit={onSubmit}
        />

        <div
          role="group"
          aria-label="modes"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            margin: "22px 0 34px",
          }}
        >
          {MODES.map((m) => {
            const selected = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onMode(m.id)}
                data-polaris-card
                style={{
                  ...cardStyle,
                  borderColor: selected ? ACCENT : "rgba(255,253,253,0.08)",
                  background: selected ? "rgba(var(--ph-accent-rgb),0.08)" : "transparent",
                }}
              >
                <span style={{ display: "block", fontSize: 14, color: selected ? ACCENT : "rgba(255,253,253,0.88)" }}>
                  {m.id}
                </span>
                <span style={{ display: "block", marginTop: 4, fontSize: 12.5, fontWeight: 300, color: "rgba(255,253,253,0.5)" }}>
                  {m.blurb}
                </span>
              </button>
            );
          })}
        </div>

        {starters.length > 0 && (
          <div style={{ marginBottom: 34 }}>
            <GroupLabel>start with one of these</GroupLabel>
            {starters.map((s) => (
              <button
                key={s.mode}
                type="button"
                onClick={() => onStarter(s)}
                data-polaris-card
                style={{ ...cardStyle, width: "100%", marginBottom: 8 }}
              >
                <span style={{ display: "block", fontSize: 12, color: ACCENT, marginBottom: 4 }}>{s.mode}</span>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 300, lineHeight: 1.5, color: "rgba(255,253,253,0.8)" }}>
                  {s.text}
                </span>
              </button>
            ))}
          </div>
        )}

        {threads.length > 0 && (
          <div>
            <GroupLabel>past conversations</GroupLabel>
            <div
              style={{
                borderBottom: "1px solid rgba(255,253,253,0.08)",
                padding: "4px 0 8px",
                marginBottom: 10,
              }}
            >
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="search past conversations"
                placeholder="search"
                data-polaris-search
                style={{ ...textareaStyle, fontSize: 13 }}
              />
            </div>
            {shown.length === 0 ? (
              <p style={{ fontSize: 13, fontWeight: 300, color: "rgba(255,253,253,0.4)", margin: 0 }}>
                nothing matches that yet.
              </p>
            ) : (
              shown.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenThread(t.id)}
                  data-polaris-card
                  style={{ ...cardStyle, width: "100%", marginBottom: 6, padding: "12px 16px" }}
                >
                  <span style={{ display: "block", fontSize: 11, color: "rgba(255,253,253,0.5)", letterSpacing: "0.04em", marginBottom: 4 }}>
                    {datedLabel(t.updated_at)}
                    {t.mode && <span style={{ color: ACCENT }}> · {t.mode}</span>}
                  </span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 300,
                      color: "rgba(255,253,253,0.75)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.title ?? t.preview ?? "conversation"}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The question box: home's and the conversation's. Its border brightens while you type. */
function Composer({
  value,
  placeholder,
  disabled,
  inputRef,
  onChange,
  onSubmit,
}: {
  value: string;
  placeholder: string;
  disabled: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const typing = value.trim().length > 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 10,
        background: "rgba(255,253,253,0.02)",
        border: `1px solid ${typing ? "rgba(var(--ph-accent-rgb),0.5)" : "rgba(255,253,253,0.1)"}`,
        borderRadius: 14,
        padding: "12px 14px",
        transition: "border-color var(--ph-hover-duration, 0.2s) ease",
      }}
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
        data-polaris-input
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
        style={{ ...textareaStyle, maxHeight: 140 }}
      />
      <SendButton onClick={onSubmit} disabled={disabled || !typing} testId="polaris-send" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

function ChatView({
  mode,
  title,
  topic,
  followUps,
  messages,
  input,
  sending,
  limitReached,
  isPro,
  error,
  allowanceLabel,
  inputRef,
  bottomRef,
  onBack,
  onFollowUp,
  onInputChange,
  onSubmit,
  onAllowance,
}: {
  mode: PolarisMode;
  title: string | null;
  topic: string | null;
  followUps: string[];
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  limitReached: boolean;
  isPro: boolean;
  error: string | null;
  allowanceLabel: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onFollowUp: (question: string) => void;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onAllowance: () => void;
}) {
  const last = messages[messages.length - 1];
  const showFollowUps =
    !sending && !limitReached && !error && last?.role === "assistant" && !last.isCrisis && followUps.length > 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        maxWidth: 760,
        width: "100%",
        margin: "0 auto",
        padding: "20px 24px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          paddingBottom: 14,
          flexShrink: 0,
          gap: 12,
        }}
      >
        <button type="button" onClick={onBack} aria-label="back to polaris" style={headerTextBtn}>
          ← polaris
        </button>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 11.5,
            color: ACCENT,
            border: "1px solid rgba(var(--ph-accent-rgb),0.4)",
            borderRadius: 999,
            padding: "3px 10px",
          }}
        >
          {mode}
        </span>
        <AllowanceBadge label={allowanceLabel} onClick={onAllowance} />
      </div>

      {title && (
        <header style={{ flexShrink: 0, paddingBottom: 16 }}>
          <h2
            style={{
              fontSize: "clamp(18px, 1.9vw, 22px)",
              fontWeight: 300,
              lineHeight: 1.35,
              color: "rgba(255,253,253,0.94)",
              margin: 0,
              textWrap: "pretty",
            }}
          >
            {title}
          </h2>
          {topic && <p style={{ fontSize: 12.5, color: ACCENT, margin: "6px 0 0" }}>{topic}</p>}
        </header>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "4px 0 12px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              opensRun={m.role === "assistant" && messages[i - 1]?.role !== "assistant"}
            />
          ))}

          {showFollowUps && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              {followUps.map((f) => (
                <button key={f} type="button" onClick={() => onFollowUp(f)} style={followUpStyle}>
                  {f}
                </button>
              ))}
            </div>
          )}

          {sending && (
            <p
              style={{
                alignSelf: "flex-start",
                fontSize: 14,
                fontWeight: 300,
                color: "rgba(255,253,253,0.35)",
                margin: 0,
                padding: "10px 14px",
              }}
            >
              polaris is looking…
            </p>
          )}

          {limitReached && (
            <div
              style={{
                alignSelf: "stretch",
                border: "1px solid rgba(255,253,253,0.12)",
                borderRadius: 14,
                padding: "16px 18px",
                marginTop: 4,
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 300,
                  lineHeight: 1.55,
                  color: "rgba(255,253,253,0.7)",
                  margin: 0,
                }}
              >
                {isPro
                  ? "you’ve reached this week’s polaris limit. add more to keep going."
                  : "you’ve reached this week’s polaris limit. upgrade for more."}
              </p>
              <button
                type="button"
                onClick={onAllowance}
                style={{
                  marginTop: 12,
                  minHeight: 24,
                  background: "none",
                  border: "none",
                  padding: "2px 0",
                  fontSize: 13,
                  color: ACCENT,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                {isPro
                  ? `add a little more for $${V67_PRICING.topup}`
                  : `continue with full, $${V67_PRICING.monthly}/month`}
              </button>
            </div>
          )}

          {error && (
            <p
              style={{
                alignSelf: "flex-start",
                fontSize: 13,
                fontWeight: 300,
                color: "var(--ph-red)",
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div style={{ paddingTop: 12, paddingBottom: 20, flexShrink: 0 }}>
        <Composer
          value={input}
          placeholder={CHAT_PLACEHOLDER}
          disabled={sending}
          inputRef={inputRef}
          onChange={onInputChange}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

/**
 * One turn. The person's turns sit right in a neutral bubble; polaris's replies
 * carry a faint warm tint and border, and each run of them opens with an accent
 * "✦ polaris" tag.
 */
function MessageBubble({ message, opensRun }: { message: ChatMessage; opensRun: boolean }) {
  const isUser = message.role === "user";
  return (
    <div style={{ alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "88%" }}>
      {opensRun && (
        <p style={{ fontSize: 11.5, letterSpacing: "0.04em", color: ACCENT, margin: "6px 0 6px 2px" }}>
          ✦ polaris
        </p>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "14px 18px",
          fontSize: 14,
          lineHeight: 1.7,
          fontWeight: 300,
          color: isUser ? "rgba(255,253,253,0.9)" : "rgba(255,253,253,0.78)",
          background: isUser ? "rgba(255,253,253,0.03)" : "rgba(var(--ph-accent-rgb),0.045)",
          border: isUser
            ? "1px solid rgba(255,253,253,0.08)"
            : "1px solid rgba(var(--ph-accent-rgb),0.16)",
          borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
          textAlign: "left",
          whiteSpace: "pre-wrap",
        }}
      >
        {message.body}
        {message.isCrisis && message.resources && (
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              fontSize: 13,
              fontWeight: 300,
              color: "rgba(255,253,253,0.6)",
            }}
          >
            <span>{message.resources.us}</span>
            <span>{message.resources.text}</span>
            <span>{message.resources.international}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Allowance badge + top-up sheet
// ---------------------------------------------------------------------------

/**
 * "<n> of <limit> questions left this week" pill, shared by the idle hero and
 * the chat header. A plain button: full opens the top-up sheet, free opens the
 * upgrade modal (the parent decides via `onClick`).
 */
function AllowanceBadge({
  label,
  onClick,
  style,
}: {
  label: string;
  onClick: () => void;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title="how many polaris questions you have left this week"
      className="motion-reduce:transition-none"
      data-polaris-allowance-badge
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        minHeight: 24,
        minWidth: 24,
        fontFamily: "inherit",
        fontSize: 11,
        lineHeight: 1,
        letterSpacing: "0.02em",
        color: "rgba(255,253,253,0.5)",
        padding: "4px 5px 4px 11px",
        border: "1px solid rgba(255,253,253,0.12)",
        borderRadius: 20,
        whiteSpace: "nowrap",
        background: "transparent",
        cursor: "pointer",
        transition: "border-color 0.2s ease, color 0.2s ease",
        ...style,
      }}
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        data-polaris-allowance-plus
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          color: "rgba(255,253,253,0.6)",
          flexShrink: 0,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
    </button>
  );
}

/**
 * Top-up sheet (full only). Same chrome as the settings modals (v240): dimmed,
 * blurred overlay; flat black box with an accent-tinted border (PHE-98: no
 * gradient); tinted primary button. The CTA has no backend yet — it only
 * closes the sheet.
 */
function TopupSheet({
  allowanceLabel,
  onClose,
}: {
  allowanceLabel: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="polaris-topup-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(8,8,8,0.78)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, calc(100vw - 40px))",
          background: "var(--ph-black)",
          border: "1px solid rgba(var(--ph-accent-rgb),0.20)",
          borderRadius: 16,
          boxShadow:
            "0 0 0 1px rgba(255,253,253,0.03), 0 30px 80px -20px rgba(0,0,0,0.75)",
          padding: 28,
          color: "var(--ph-white)",
        }}
      >
        <p
          id="polaris-topup-title"
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "var(--ph-white)",
            margin: "0 0 10px",
          }}
        >
          add more this week
        </p>
        <p
          style={{
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "rgba(255,253,253,0.52)",
            margin: "0 0 12px",
          }}
        >
          your weekly amount resets on its own. if you want more room before then, you can add a little extra.
        </p>
        <p
          style={{
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "rgba(255,253,253,0.65)",
            margin: "0 0 18px",
          }}
        >
          {ALLOWANCE_NOTE}
        </p>
        <p
          style={{
            fontSize: 12,
            color: "rgba(255,253,253,0.4)",
            margin: "0 0 18px",
          }}
        >
          {allowanceLabel}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="motion-reduce:transition-none"
          data-polaris-topup-cta
          style={{
            width: "100%",
            border: "1px solid rgba(var(--ph-accent-rgb),0.38)",
            borderRadius: 10,
            padding: "12px 16px",
            background: "rgba(var(--ph-accent-rgb),0.10)",
            color: "var(--ph-white)",
            fontSize: 13,
            fontWeight: 500,
            fontFamily: "inherit",
            cursor: "pointer",
            transition: "border-color 0.2s ease, background 0.2s ease",
          }}
        >
          add a little more for ${V67_PRICING.topup}
        </button>
        <p
          style={{
            fontSize: 11.5,
            color: "rgba(255,253,253,0.52)",
            textAlign: "center",
            marginTop: 10,
            lineHeight: 1.6,
          }}
        >
          one time only. your usual weekly amount will still reset as normal.
        </p>
      </div>
    </div>
  );
}

function SendButton({
  onClick,
  disabled,
  testId,
}: {
  onClick: () => void;
  disabled: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-label="send"
      // Filled with the accent: accent text on hover would vanish.
      data-ph-hover="off"
      style={{
        background: ACCENT,
        border: "none",
        borderRadius: "50%",
        width: 30,
        height: 30,
        color: "var(--ph-black)",
        fontSize: 14,
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 900,
        lineHeight: 1,
        opacity: disabled ? 0.4 : 1,
        fontFamily: "inherit",
      }}
    >
      ✦
    </button>
  );
}

const textareaStyle: CSSProperties = {
  width: "100%",
  background: "none",
  border: "none",
  outline: "none",
  resize: "none",
  fontFamily: "inherit",
  fontSize: 14,
  color: "rgba(255,253,253,0.92)",
  lineHeight: 1.5,
  maxHeight: 200,
  overflowY: "auto",
  padding: "2px 0",
};

const cardStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  padding: "14px 16px",
  border: "1px solid rgba(255,253,253,0.08)",
  borderRadius: 12,
  background: "transparent",
  color: "rgba(255,253,253,0.8)",
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
  transition: "border-color 0.2s ease, background 0.2s ease",
};

const followUpStyle: CSSProperties = {
  fontFamily: "inherit",
  fontSize: 12.5,
  padding: "6px 13px",
  border: "1px solid rgba(var(--ph-accent-rgb),0.4)",
  borderRadius: 999,
  background: "transparent",
  color: ACCENT,
  cursor: "pointer",
};

const headerTextBtn: CSSProperties = {
  background: "none",
  border: "none",
  fontFamily: "inherit",
  fontSize: 11,
  color: "rgba(255,253,253,0.5)",
  cursor: "pointer",
  minWidth: 24,
  minHeight: 24,
  padding: 0,
  letterSpacing: "0.04em",
};

export default PolarisTab;
