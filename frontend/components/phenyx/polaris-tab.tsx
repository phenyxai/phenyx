"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useSearchParams } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";

import {
  askPolaris,
  getPolarisThread,
  getPolarisThreads,
  type PolarisThreadSummary,
  type SuggestedQuestion,
} from "@/lib/api-client";
import { V67_PRICING } from "@/lib/billing";
import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { trackPolarisMessage } from "@/lib/analytics";
import { useTier } from "@/lib/use-tier";

// ============================================================================
// PolarisTab: v67 idle + chat surfaces (PHE-73)
// ----------------------------------------------------------------------------
// Two views behind one flex-column panel (never display:block, which unpins
// the composer from the foot):
//
//   • IDLE: hero + live composer + three explore tabs (questions from your
//     record, starting points, your chats). Token pill sits on the hero row.
//   • CHAT: ← · polaris · <pillar> · token pill · new. Messages fill the
//     panel; composer is pinned to the foot.
//
// Free users see a lock that opens the Pro modal. Threads and askPolaris are
// not fetched or called. Deep-link `/dashboard/polaris?q=...&pillar=...`
// starts chat with that as the first user turn.
// ============================================================================

const ACCENT = "var(--s, #5599FF)";

const TOKEN_NOTE =
  "tokens are a shared weekly amount, not a count of questions — longer conversations use more. the amount resets on its own; a top-up is one-time and does not change the reset.";

const COMPOSER_PLACEHOLDER = "ask anything. it already has your context.";

/** v67 starting-point chips (verbatim). Each seeds a chat with its label + pillar. */
const STARTING_CHIPS: ReadonlyArray<{ label: string; pillar: string }> = [
  { label: "my work", pillar: "self-creation" },
  { label: "how i come across", pillar: "recognition" },
  { label: "where i am going", pillar: "transcendence" },
  { label: "what lands", pillar: "recognition" },
  { label: "what i hold back", pillar: "self-creation" },
  { label: "2am", pillar: "becoming" },
  { label: "what i keep starting", pillar: "becoming" },
  { label: "what i return to", pillar: "origin" },
  { label: "the year it changed", pillar: "origin" },
  { label: "what i finish", pillar: "self-creation" },
  { label: "who i sound like", pillar: "recognition" },
  { label: "what i am circling", pillar: "convergence" },
];

type ExploreTab = "record" | "starts" | "chats";
type View = "idle" | "chat";

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

function displayPillar(pillar: string | null | undefined): string {
  if (!pillar) return "";
  return pillar.replace(/_/g, "-");
}

function weeklyTokenCopy(n: number): string {
  return `${n} weekly tokens`;
}

function readExploreDeepLink(searchParams: { get: (key: string) => string | null }): {
  q: string;
  pillar: string | null;
} {
  let q = searchParams.get("q")?.trim() ?? "";
  let pillar = searchParams.get("pillar")?.trim() || null;
  if (!q && typeof window !== "undefined") {
    const live = new URLSearchParams(window.location.search);
    q = live.get("q")?.trim() ?? "";
    if (!pillar) pillar = live.get("pillar")?.trim() || null;
  }
  return { q, pillar };
}

function autosize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function PolarisTab() {
  const searchParams = useSearchParams();
  const { openModal } = useSettingsModals();
  const { isPro } = useTier();

  const [view, setView] = useState<View>("idle");
  const [explore, setExplore] = useState<ExploreTab>("record");
  const [topupOpen, setTopupOpen] = useState(false);

  const [threads, setThreads] = useState<PolarisThreadSummary[]>([]);
  const [suggested, setSuggested] = useState<SuggestedQuestion[]>([]);
  const [remaining, setRemaining] = useState<number>(V67_PRICING.polarisWeeklyTokens);

  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatFocus, setChatFocus] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const threadIdRef = useRef<string | undefined>(undefined);
  threadIdRef.current = threadId;
  const sessionMessageCountRef = useRef(0);

  const openTopup = useCallback(() => setTopupOpen(true), []);
  const openUpgrade = useCallback(() => openModal("upgrade"), [openModal]);

  const loadIdle = useCallback(async () => {
    try {
      const data = await getPolarisThreads();
      setThreads(data.threads ?? []);
      setSuggested(data.suggested_questions ?? []);
      if (typeof data.allowance?.remaining === "number") {
        setRemaining(data.allowance.remaining);
        setLimitReached(data.allowance.limit_reached);
      }
    } catch {
      setThreads([]);
      setSuggested([]);
    }
  }, []);

  useEffect(() => {
    if (!isPro) return;
    void loadIdle();
  }, [loadIdle, isPro]);

  useEffect(() => {
    if (view === "chat") {
      chatInputRef.current?.focus();
      autosize(chatInputRef.current);
    } else {
      autosize(idleInputRef.current);
    }
  }, [view]);

  useEffect(() => {
    if (view === "chat") bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending, view]);

  const sendQuestion = useCallback(
    async (question: string, seedThreadId?: string) => {
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
        const res = await askPolaris(q, seedThreadId ?? threadIdRef.current);
        setThreadId(res.thread_id);
        threadIdRef.current = res.thread_id;
        if (res.pillar_tag) setChatFocus(displayPillar(res.pillar_tag));
        if (typeof res.allowance?.remaining === "number") {
          setRemaining(res.allowance.remaining);
        }

        if (res.limit_reached) {
          setLimitReached(true);
          setRemaining(0);
          openTopup();
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
    [sending, openTopup]
  );

  const openChat = useCallback(
    (seed?: string, pillar?: string | null) => {
      setMessages([]);
      setThreadId(undefined);
      threadIdRef.current = undefined;
      setLimitReached(false);
      setError(null);
      setInput("");
      setChatFocus(displayPillar(pillar) || null);
      setView("chat");
      if (seed) void sendQuestion(seed, undefined);
    },
    [sendQuestion]
  );

  const openThread = useCallback(async (id: string) => {
    setError(null);
    setLimitReached(false);
    setThreadId(id);
    threadIdRef.current = id;
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
      const tagged = detail.messages.find((m) => m.pillar_tag);
      setChatFocus(displayPillar(tagged?.pillar_tag) || null);
    } catch {
      setMessages([]);
      setChatFocus(null);
      setError("could not load this conversation. please try again.");
    }
  }, []);

  const backToIdle = useCallback(() => {
    setView("idle");
    setChatFocus(null);
    setInput("");
    void loadIdle();
  }, [loadIdle]);

  const submitInput = useCallback(() => {
    const q = input.trim();
    if (!q) return;
    if (remaining <= 0) {
      openTopup();
      return;
    }
    setInput("");
    if (view !== "chat") {
      setMessages([]);
      setThreadId(undefined);
      threadIdRef.current = undefined;
      setError(null);
      setChatFocus(null);
      setView("chat");
    }
    void sendQuestion(q);
  }, [input, sendQuestion, remaining, openTopup, view]);

  // Daily ✦ explore (PHE-70) routes Pro users here with ?q=&pillar=. Read the
  // query on the client so a client-side `router.push` from Daily is picked up
  // even if this tab was already in the tree. Strip the query with
  // history.replaceState (not router.replace) so Next does not remount the
  // tab and drop the chat that just started.
  useEffect(() => {
    if (!isPro) return;
    const { q, pillar } = readExploreDeepLink(searchParams);
    if (!q) return;
    const key = `${q}|${pillar ?? ""}`;
    if (consumedDeepLinks.has(key)) return;
    consumedDeepLinks.add(key);
    openChat(q, pillar);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/dashboard/polaris");
    }
  }, [isPro, searchParams, openChat]);

  if (!isPro) {
    return <PolarisLock onUpgrade={openUpgrade} />;
  }

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
          [data-testid="polaris-panel"] textarea[aria-label="ask polaris"]::placeholder {
            color: rgba(255,253,253,0.52) !important;
          }
          [data-testid="polaris-panel"] textarea[aria-label="ask polaris"],
          [data-testid="polaris-panel"] textarea[aria-label="ask polaris"]:focus {
            background: transparent !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 2px 0 !important;
          }
        }
        [data-polaris-hero-row] {
          padding-right: 150px;
        }
        [data-polaris-hero-token] {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
        }
        @media (max-width: 760px) {
          [data-polaris-hero-row] {
            flex-wrap: wrap;
            padding-right: 0;
          }
          [data-polaris-hero-token] {
            position: static;
            transform: none;
          }
        }
        @media (hover: hover) {
          [data-polaris-question-card]:hover {
            border-color: rgba(var(--s-rgb, 85,153,255),0.4) !important;
            background: #0c0c0c !important;
          }
          [data-polaris-chip]:hover {
            border-color: rgba(var(--s-rgb, 85,153,255),0.4) !important;
            color: rgba(255,253,253,0.78) !important;
          }
          [data-polaris-thread]:hover {
            border-color: #242424 !important;
          }
          [data-polaris-explore-tab][data-active="false"]:hover {
            color: rgba(255,253,253,0.72) !important;
          }
          [data-polaris-token-trigger]:hover {
            border-color: rgba(var(--s-rgb, 85,153,255),0.4) !important;
            color: rgba(255,253,253,0.8) !important;
          }
          [data-polaris-token-trigger]:hover [data-polaris-token-plus] {
            color: var(--s, #5599FF) !important;
          }
        }
      `}</style>
      {view === "idle" ? (
        <IdleView
          suggested={suggested}
          threads={threads}
          remaining={remaining}
          input={input}
          sending={sending}
          explore={explore}
          inputRef={idleInputRef}
          onExplore={setExplore}
          onInputChange={setInput}
          onSubmit={submitInput}
          onOpenChat={openChat}
          onOpenThread={openThread}
          onTopup={openTopup}
        />
      ) : (
        <ChatView
          messages={messages}
          input={input}
          sending={sending}
          limitReached={limitReached}
          error={error}
          remaining={remaining}
          chatFocus={chatFocus}
          inputRef={chatInputRef}
          bottomRef={bottomRef}
          onBack={backToIdle}
          onInputChange={setInput}
          onSubmit={submitInput}
          onTopup={openTopup}
        />
      )}

      {topupOpen && (
        <TopupSheet remaining={remaining} onClose={() => setTopupOpen(false)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Free lock
// ---------------------------------------------------------------------------

function PolarisLock({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        maxWidth: 480,
        margin: "0 auto",
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <span aria-hidden="true" style={{ color: ACCENT, fontSize: 22, marginBottom: 16 }}>
        ✦
      </span>
      <p
        style={{
          fontSize: 21,
          fontWeight: 300,
          letterSpacing: "-0.02em",
          color: "#FFFDFD",
          margin: 0,
          marginBottom: 18,
        }}
      >
        polaris
      </p>
      <button
        type="button"
        onClick={onUpgrade}
        aria-label="polaris is on pro"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          background: "transparent",
          border: "1px solid rgba(255,253,253,0.12)",
          borderRadius: 16,
          padding: "28px 32px",
          cursor: "pointer",
          fontFamily: "inherit",
          width: "100%",
        }}
      >
        <LockIcon />
        <span
          style={{
            fontSize: 14,
            fontWeight: 300,
            lineHeight: 1.6,
            color: "rgba(255,253,253,0.55)",
          }}
        >
          polaris is on pro. ask about any observation, grounded in your own record.
        </span>
      </button>
      <button
        type="button"
        onClick={onUpgrade}
        style={{
          marginTop: 22,
          background: "transparent",
          border: "0.5px solid rgba(255,253,253,0.35)",
          borderRadius: 999,
          padding: "10px 18px",
          fontSize: 13,
          color: "#FFFDFD",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        go pro, ${V67_PRICING.monthly}/month
      </button>
    </section>
  );
}

function LockIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="rgba(255,253,253,0.45)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Idle
// ---------------------------------------------------------------------------

function IdleView({
  suggested,
  threads,
  remaining,
  input,
  sending,
  explore,
  inputRef,
  onExplore,
  onInputChange,
  onSubmit,
  onOpenChat,
  onOpenThread,
  onTopup,
}: {
  suggested: SuggestedQuestion[];
  threads: PolarisThreadSummary[];
  remaining: number;
  input: string;
  sending: boolean;
  explore: ExploreTab;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onExplore: (tab: ExploreTab) => void;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onOpenChat: (seed?: string, pillar?: string | null) => void;
  onOpenThread: (id: string) => void;
  onTopup: () => void;
}) {
  const showChats = threads.length > 0;
  const active = explore === "chats" && !showChats ? "record" : explore;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "24px 24px 40px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto" }}>
        <div
          data-polaris-hero-row
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 14,
            marginBottom: 26,
            position: "relative",
            rowGap: 10,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 26, color: ACCENT, flexShrink: 0 }}>
            ✦
          </span>
          <p
            style={{
              fontSize: "clamp(15px, 1.5vw, 19px)",
              fontWeight: 300,
              color: "rgba(255,253,253,0.94)",
              lineHeight: 1.35,
              letterSpacing: "-0.01em",
              margin: 0,
              flex: 1,
              minWidth: 0,
            }}
          >
            what do you want to understand today?
          </p>
          <div data-polaris-hero-token>
            <TokenPill remaining={remaining} onTopup={onTopup} />
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,253,253,0.018)",
            border: "1px solid #232323",
            borderRadius: 18,
            padding: "18px 20px 12px",
            marginBottom: 26,
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              onInputChange(e.target.value);
              autosize(e.currentTarget);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            aria-label="ask polaris"
            placeholder={COMPOSER_PLACEHOLDER}
            rows={1}
            disabled={sending}
            style={textareaStyle}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              marginTop: 8,
            }}
          >
            <SendButton onClick={onSubmit} disabled={sending || !input.trim()} />
          </div>
        </div>

        <div style={{ marginTop: 4 }}>
          <div
            style={{
              display: "flex",
              gap: 2,
              justifyContent: "flex-start",
              marginBottom: 20,
              marginLeft: -14,
            }}
          >
            <ExploreTabButton
              active={active === "record"}
              onClick={() => onExplore("record")}
            >
              questions from your record
            </ExploreTabButton>
            <ExploreTabButton
              active={active === "starts"}
              onClick={() => onExplore("starts")}
            >
              starting points
            </ExploreTabButton>
            {showChats && (
              <ExploreTabButton
                active={active === "chats"}
                onClick={() => onExplore("chats")}
              >
                your chats
              </ExploreTabButton>
            )}
          </div>

          {active === "record" && (
            <div>
              {suggested.map((s) => (
                <button
                  key={s.pillar_tag + s.text}
                  type="button"
                  onClick={() => onOpenChat(s.text, s.pillar_tag)}
                  className="motion-reduce:transition-none"
                  data-polaris-question-card
                  style={questionCardStyle}
                >
                  <p
                    style={{
                      fontSize: 11.5,
                      letterSpacing: "0.1em",
                      color: ACCENT,
                      textTransform: "uppercase",
                      margin: "0 0 5px",
                      fontWeight: 600,
                    }}
                  >
                    {displayPillar(s.pillar_tag)}
                  </p>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: "rgba(255,253,253,0.8)",
                      lineHeight: 1.5,
                      fontWeight: 300,
                      margin: 0,
                    }}
                  >
                    {s.text}
                  </p>
                </button>
              ))}
            </div>
          )}

          {active === "starts" && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 7,
                justifyContent: "flex-start",
              }}
            >
              {STARTING_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => onOpenChat(chip.label, chip.pillar)}
                  className="motion-reduce:transition-none"
                  data-polaris-chip
                  style={chipStyle}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {active === "chats" && showChats && (
            <div>
              {threads.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenThread(t.id)}
                  className="motion-reduce:transition-none"
                  data-polaris-thread
                  style={threadRowStyle}
                >
                  <p
                    style={{
                      fontSize: 11,
                      color: "rgba(255,253,253,0.5)",
                      letterSpacing: "0.06em",
                      margin: "0 0 4px",
                    }}
                  >
                    {datedLabel(t.updated_at)}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: "rgba(255,253,253,0.5)",
                      fontWeight: 300,
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.title ?? t.preview ?? "conversation"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExploreTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="motion-reduce:transition-none"
      data-polaris-explore-tab
      data-active={active}
      style={{
        fontFamily: "inherit",
        fontSize: 12,
        letterSpacing: "0.02em",
        color: active ? ACCENT : "rgba(255,253,253,0.52)",
        background: "none",
        border: "none",
        padding: "7px 14px",
        cursor: "pointer",
        borderRadius: 16,
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

function ChatView({
  messages,
  input,
  sending,
  limitReached,
  error,
  remaining,
  chatFocus,
  inputRef,
  bottomRef,
  onBack,
  onInputChange,
  onSubmit,
  onTopup,
}: {
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  limitReached: boolean;
  error: string | null;
  remaining: number;
  chatFocus: string | null;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  bottomRef: RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onTopup: () => void;
}) {
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
          justifyContent: "space-between",
          paddingBottom: 16,
          flexShrink: 0,
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="back to polaris"
          style={headerTextBtn}
        >
          ←
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            minWidth: 0,
            flexWrap: "wrap",
            flex: 1,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 12, color: ACCENT }}>
            ✦
          </span>
          <span
            style={{
              fontSize: 11.5,
              letterSpacing: "0.14em",
              color: ACCENT,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            polaris
          </span>
          {chatFocus && (
            <span
              style={{
                fontSize: 11,
                color: ACCENT,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontWeight: 600,
                minWidth: 0,
                overflowWrap: "anywhere",
              }}
            >
              · {chatFocus}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexShrink: 0,
          }}
        >
          <TokenPill remaining={remaining} onTopup={onTopup} />
          <button type="button" onClick={onBack} style={headerTextBtn}>
            new
          </button>
        </div>
      </div>

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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 14,
          }}
        >
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

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
                you&apos;ve reached this week&apos;s polaris limit. add more to keep going.
              </p>
              <button
                type="button"
                onClick={onTopup}
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
                add more for ${V67_PRICING.topup}
              </button>
            </div>
          )}

          {error && (
            <p
              style={{
                alignSelf: "flex-start",
                fontSize: 13,
                fontWeight: 300,
                color: "rgba(255,120,120,0.8)",
                margin: 0,
              }}
            >
              {error}
            </p>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid #141414",
          paddingTop: 16,
          paddingBottom: 20,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#0c0c0c",
            border: "1px solid #1e1e1e",
            borderRadius: 14,
            padding: "10px 14px",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              onInputChange(e.target.value);
              autosize(e.currentTarget);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            aria-label="ask polaris"
            placeholder={COMPOSER_PLACEHOLDER}
            rows={1}
            disabled={sending}
            style={{ ...textareaStyle, maxHeight: 110 }}
          />
          <SendButton
            onClick={onSubmit}
            disabled={sending || !input.trim()}
            testId="polaris-send"
          />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "88%",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "14px 18px",
        fontSize: 14,
        lineHeight: 1.7,
        fontWeight: 300,
        color: isUser ? "rgba(255,253,253,0.9)" : "rgba(255,253,253,0.72)",
        background: isUser ? "rgba(85,153,255,0.08)" : "#0c0c0c",
        border: isUser
          ? "1px solid rgba(85,153,255,0.18)"
          : "1px solid #1e1e1e",
        borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
        textAlign: isUser ? "right" : "left",
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
            textAlign: "left",
          }}
        >
          <span>{message.resources.us}</span>
          <span>{message.resources.text}</span>
          <span>{message.resources.international}</span>
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Token pill + top-up sheet
// ---------------------------------------------------------------------------

function TokenPill({
  remaining,
  onTopup,
}: {
  remaining: number;
  onTopup: () => void;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`${weeklyTokenCopy(remaining)}. learn how polaris tokens work`}
          className="motion-reduce:transition-none"
          data-polaris-token-trigger
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
            border: "1px solid #242424",
            borderRadius: 20,
            whiteSpace: "nowrap",
            background: "transparent",
            cursor: "pointer",
          }}
        >
          <span>{weeklyTokenCopy(remaining)}</span>
          <span
            aria-hidden="true"
            data-polaris-token-plus
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
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          aria-label="polaris token details"
          style={{
            zIndex: 60,
            width: "min(320px, calc(100vw - 32px))",
            border: "1px solid #242424",
            borderRadius: 12,
            background: "#0e0e0e",
            padding: 14,
            color: "rgba(255,253,253,0.72)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 300,
              lineHeight: 1.65,
            }}
          >
            {TOKEN_NOTE}
          </p>
          <Popover.Close asChild>
            <button
              type="button"
              onClick={onTopup}
              style={{
                minHeight: 24,
                marginTop: 10,
                border: "none",
                background: "transparent",
                padding: "4px 0",
                color: ACCENT,
                fontFamily: "inherit",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              add more for ${V67_PRICING.topup}
            </button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function TopupSheet({
  remaining,
  onClose,
}: {
  remaining: number;
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
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#0E0E0E",
          border: "1px solid #1C1C1C",
          borderRadius: 14,
          padding: 28,
          color: "#FFFDFD",
        }}
      >
        <p
          id="polaris-topup-title"
          style={{
            fontSize: 16,
            fontWeight: 500,
            margin: "0 0 10px",
          }}
        >
          add more this week
        </p>
        <p
          style={{
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "#888",
            margin: "0 0 12px",
          }}
        >
          your weekly amount resets on its own. if you need more before then, you can add extra.
        </p>
        <p
          style={{
            fontSize: 12.5,
            lineHeight: 1.6,
            color: "rgba(255,253,253,0.65)",
            margin: "0 0 18px",
          }}
        >
          {TOKEN_NOTE}
        </p>
        <p
          style={{
            fontSize: 12,
            color: "rgba(255,253,253,0.4)",
            margin: "0 0 18px",
          }}
        >
          {weeklyTokenCopy(remaining)} remaining
        </p>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            border: "none",
            borderRadius: 10,
            padding: "12px 16px",
            background: ACCENT,
            color: "#06060a",
            fontSize: 13,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          add more for ${V67_PRICING.topup}
        </button>
        <p
          style={{
            fontSize: 11.5,
            color: "#888",
            textAlign: "center",
            marginTop: 10,
            lineHeight: 1.6,
          }}
        >
          one-time. your weekly amount still resets on schedule either way.
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
      style={{
        background: ACCENT,
        border: "none",
        borderRadius: "50%",
        width: 30,
        height: 30,
        color: "#06060a",
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

const questionCardStyle: CSSProperties = {
  padding: "14px 16px",
  border: "1px solid #171717",
  borderRadius: 10,
  background: "transparent",
  cursor: "pointer",
  marginBottom: 6,
  textAlign: "left",
  width: "100%",
  fontFamily: "inherit",
  transition: "border-color 0.2s ease, background 0.2s ease",
};

const chipStyle: CSSProperties = {
  fontFamily: "inherit",
  fontSize: 13,
  padding: "7px 15px",
  border: "1px solid #1e1e1e",
  borderRadius: 20,
  background: "transparent",
  color: "rgba(255,253,253,0.5)",
  cursor: "pointer",
  transition: "border-color 0.2s ease, color 0.2s ease",
};

const threadRowStyle: CSSProperties = {
  padding: "12px 16px",
  border: "1px solid #1a1a1a",
  borderRadius: 9,
  background: "#090909",
  cursor: "pointer",
  marginBottom: 6,
  width: "100%",
  textAlign: "left",
  fontFamily: "inherit",
  transition: "border-color 0.2s ease",
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
