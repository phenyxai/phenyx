"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  askPolaris,
  getPolarisThread,
  getPolarisThreads,
  type PolarisThreadSummary,
  type SuggestedQuestion,
} from "@/lib/api-client";
import { useSettingsModals } from "@/components/phenyx/settings-modals/modal-host";
import { trackPolarisMessage } from "@/lib/analytics";

// ============================================================================
// PolarisTab — the dashboard Polaris chat surface (PHE-23)
// ----------------------------------------------------------------------------
// Two views behind one component (mirrors the prototype's polStartChat/polBack):
//
//   • MAIN — hero, three suggested questions from the user's top pillars
//     (BASED ON WHAT WE SEE), explore chips (EXPLORE FURTHER), and past
//     conversations (PREVIOUS CONVERSATIONS, hidden until ≥1 exists). The input
//     row is read-only here — clicking it opens a blank chat.
//   • CHAT — a "← back to polaris" control, the message thread (user bubbles
//     right, ai bubbles left, all PLAIN TEXT via React text nodes — never
//     innerHTML), and an input with a star (✦) send.
//
// Every answer comes from `askPolaris` (PHE-22, non-streaming JSON). Threads
// persist server-side, so `PREVIOUS CONVERSATIONS` reloads a decrypted thread
// via `getPolarisThread`. The response can also be an at-limit short-circuit
// (`limit_reached`) or a crisis response (`is_crisis`) — both handled below.
// ============================================================================

// Accent used for the star + pillar tags. The dashboard shell does not mount the
// SessionColorProvider, so we read the persisted stellar CSS var when present and
// fall back to the deterministic default rather than importing the landing-only
// context. (var(--s) is set by the provider on the landing side and persisted.)
const ACCENT = "var(--s, #5599FF)";

// EXPLORE FURTHER chips (verbatim, lowercase). Each seeds a chat with a question.
const EXPLORE_CHIPS: ReadonlyArray<{ label: string; seed: string }> = [
  { label: "my work", seed: "what does my work say about who i am?" },
  { label: "how i come across", seed: "how do i actually come across to people?" },
  { label: "where i am going", seed: "where am i quietly heading next?" },
];

// A crisis payload shape (PHE-22 returns it on `is_crisis`).
interface CrisisResources {
  us: string;
  text: string;
  international: string;
}

// One rendered turn in the chat thread. `id` is the server message id when known,
// otherwise a local key. `resources` rides along on a crisis answer.
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  isCrisis?: boolean;
  resources?: CrisisResources | null;
}

type View = "main" | "chat";

/** dd mmm — a quiet dated label for PREVIOUS CONVERSATIONS rows. */
function datedLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toLowerCase();
}

export function PolarisTab() {
  const { openModal } = useSettingsModals();

  const [view, setView] = useState<View>("main");

  // Main-view data.
  const [threads, setThreads] = useState<PolarisThreadSummary[]>([]);
  const [suggested, setSuggested] = useState<SuggestedQuestion[]>([]);

  // Chat-view state.
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Timer-safe view of the current thread id so a rapid seed submit never reads a
  // stale closure value.
  const threadIdRef = useRef<string | undefined>(undefined);
  threadIdRef.current = threadId;
  // PHE-29: running count of answered Polaris messages this dashboard session, sent
  // as `count` on the privacy-first `polaris_message` topic event. Persists across
  // the main/chat view toggle (the component stays mounted); resets on remount.
  const sessionMessageCountRef = useRef(0);

  // Load the main view (past threads + suggested questions). Fails soft: on any
  // error the main view still renders (empty threads, empty suggestions).
  const loadMain = useCallback(async () => {
    try {
      const data = await getPolarisThreads();
      setThreads(data.threads ?? []);
      setSuggested(data.suggested_questions ?? []);
    } catch {
      setThreads([]);
      setSuggested([]);
    }
  }, []);

  useEffect(() => {
    void loadMain();
  }, [loadMain]);

  // Autofocus the chat input whenever the chat view opens.
  useEffect(() => {
    if (view === "chat") inputRef.current?.focus();
  }, [view]);

  // Auto-scroll to the newest message as the thread grows / a send is in flight.
  useEffect(() => {
    if (view === "chat") bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending, view]);

  // Core send: append the user turn, call askPolaris, then append the ai answer
  // (or surface the at-limit / crisis shapes). `seedThreadId` lets a fresh chat
  // send its first question before `threadId` state has settled.
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

        if (res.limit_reached) {
          // Over the weekly budget: no ai bubble — the at-limit notice renders
          // below the thread instead. PHE-27 owns the full upgrade treatment.
          setLimitReached(true);
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

          // PHE-29: topic-tag this answered turn and emit the privacy-first
          // `polaris_message` event through the standard analytics pipeline —
          // reusing the server-computed `pillar_tag` (matches PHE-22 routing) and
          // carrying only { count, pillar_tag, message_length }, never the text.
          // Crisis turns short-circuit before a real exchange, so they don't emit.
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
    [sending]
  );

  // MAIN → CHAT. Opens a fresh thread; when a seed is given it is submitted
  // immediately (suggested question or explore chip).
  const openChat = useCallback(
    (seed?: string) => {
      setMessages([]);
      setThreadId(undefined);
      threadIdRef.current = undefined;
      setLimitReached(false);
      setError(null);
      setInput("");
      setView("chat");
      if (seed) void sendQuestion(seed, undefined);
    },
    [sendQuestion]
  );

  // PREVIOUS CONVERSATIONS → CHAT. Reloads a persisted thread's messages.
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
    } catch {
      setMessages([]);
      setError("could not load this conversation. please try again.");
    }
  }, []);

  // CHAT → MAIN. Refresh the thread list so a just-created thread appears under
  // PREVIOUS CONVERSATIONS.
  const back = useCallback(() => {
    setView("main");
    void loadMain();
  }, [loadMain]);

  const submitInput = useCallback(() => {
    const q = input.trim();
    if (!q) return;
    setInput("");
    void sendQuestion(q);
  }, [input, sendQuestion]);

  if (view === "chat") {
    return (
      <ChatView
        messages={messages}
        input={input}
        sending={sending}
        limitReached={limitReached}
        error={error}
        inputRef={inputRef}
        bottomRef={bottomRef}
        onBack={back}
        onInputChange={setInput}
        onSubmit={submitInput}
        onUpgrade={() => openModal("upgrade")}
      />
    );
  }

  return (
    <MainView
      suggested={suggested}
      threads={threads}
      onOpenChat={openChat}
      onOpenThread={openThread}
    />
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

function MainView({
  suggested,
  threads,
  onOpenChat,
  onOpenThread,
}: {
  suggested: SuggestedQuestion[];
  threads: PolarisThreadSummary[];
  onOpenChat: (seed?: string) => void;
  onOpenThread: (id: string) => void;
}) {
  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "56px 24px 96px" }}>
        {/* Hero */}
      <div style={{ marginBottom: 48 }}>
        <h1
          className="uppercase"
          style={{
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.24em",
            color: "#FFFDFD",
            margin: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span aria-hidden="true" style={{ color: ACCENT }}>
            ✦
          </span>
          polaris
        </h1>
        <p
          style={{
            fontSize: 20,
            fontWeight: 300,
            lineHeight: 1.5,
            color: "rgba(255,253,253,0.55)",
            margin: 0,
            marginTop: 16,
          }}
        >
          ask what you cannot stop thinking about.
        </p>
      </div>

      {/* BASED ON WHAT WE SEE — suggested questions from top pillars */}
      {suggested.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <SectionHeading>based on what we see</SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {suggested.map((s) => (
              <button
                key={s.pillar_tag + s.text}
                type="button"
                onClick={() => onOpenChat(s.text)}
                style={suggestionStyle}
                className="motion-reduce:transition-none"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,253,253,0.28)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,253,253,0.1)";
                }}
              >
                <span
                  className="uppercase"
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    color: ACCENT,
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  {s.pillar_tag.replace(/_/g, " ")}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 300,
                    lineHeight: 1.5,
                    color: "#FFFDFD",
                  }}
                >
                  {s.text}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* EXPLORE FURTHER — chips */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeading>explore further</SectionHeading>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {EXPLORE_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => onOpenChat(chip.seed)}
              style={chipStyle}
              className="motion-reduce:transition-none"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,253,253,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,253,253,0.18)";
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      {/* PREVIOUS CONVERSATIONS — hidden until at least one thread exists */}
      {threads.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <SectionHeading>previous conversations</SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpenThread(t.id)}
                style={threadRowStyle}
                className="motion-reduce:transition-none"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,253,253,0.03)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 300,
                    color: "rgba(255,253,253,0.75)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {t.title ?? t.preview ?? "conversation"}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "rgba(255,253,253,0.35)",
                    flexShrink: 0,
                    marginLeft: 16,
                  }}
                >
                  {datedLabel(t.updated_at)}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Input row — read-only in the main view; clicking opens a blank chat. */}
      <button
        type="button"
        onClick={() => onOpenChat()}
        aria-label="what do you want us to reveal?"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          background: "#0D0D0C",
          border: "1px solid rgba(255,253,253,0.1)",
          borderRadius: 14,
          padding: "16px 18px",
          cursor: "text",
          fontFamily: "inherit",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 300,
            color: "rgba(255,253,253,0.35)",
          }}
        >
          what do you want us to reveal?
        </span>
        <span aria-hidden="true" style={{ marginLeft: "auto", color: ACCENT }}>
          ✦
        </span>
      </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat view
// ---------------------------------------------------------------------------

function ChatView({
  messages,
  input,
  sending,
  limitReached,
  error,
  inputRef,
  bottomRef,
  onBack,
  onInputChange,
  onSubmit,
  onUpgrade,
}: {
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  limitReached: boolean;
  error: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onUpgrade: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxWidth: 640,
        margin: "0 auto",
        padding: "24px 24px 0",
      }}
    >
      {/* Back control */}
      <button
        type="button"
        onClick={onBack}
        style={{
          alignSelf: "flex-start",
          background: "none",
          border: "none",
          padding: "4px 0",
          fontSize: 13,
          fontWeight: 300,
          color: "rgba(255,253,253,0.5)",
          cursor: "pointer",
          fontFamily: "inherit",
          marginBottom: 12,
        }}
      >
        ← back to polaris
      </button>

      {/* Message thread */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {/* In-flight indicator while awaiting an answer. */}
          {sending && (
            <div style={{ alignSelf: "flex-start", maxWidth: "82%" }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 300,
                  color: "rgba(255,253,253,0.35)",
                  margin: 0,
                  padding: "10px 14px",
                }}
              >
                polaris is looking…
              </p>
            </div>
          )}

          {/*
            At-limit notice (PHE-27 mount point). When askPolaris returns
            `limit_reached`, no ai bubble renders — this honest message + upgrade
            CTA takes its place. PHE-27 owns the final at-limit treatment (copy,
            token-remaining detail, richer CTA); this is the seam to replace.
            TODO(PHE-27): swap for the shipped at-limit upgrade surface.
          */}
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
                you&apos;ve reached this week&apos;s polaris limit — upgrade for
                more
              </p>
              <button
                type="button"
                onClick={onUpgrade}
                style={{
                  marginTop: 12,
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontSize: 13,
                  color: ACCENT,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                upgrade
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

      {/* Input + star send */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderTop: "1px solid rgba(255,253,253,0.08)",
          padding: "14px 0 20px",
        }}
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="what do you want us to reveal?"
          disabled={sending}
          style={{
            flex: 1,
            background: "#0D0D0C",
            border: "1px solid rgba(255,253,253,0.1)",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 15,
            fontWeight: 300,
            color: "#FFFDFD",
            fontFamily: "inherit",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={sending || !input.trim()}
          aria-label="send"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 46,
            height: 46,
            flexShrink: 0,
            borderRadius: 12,
            border: "1px solid rgba(255,253,253,0.1)",
            background: "#0D0D0C",
            color: ACCENT,
            fontSize: 18,
            cursor: sending || !input.trim() ? "default" : "pointer",
            opacity: sending || !input.trim() ? 0.4 : 1,
            fontFamily: "inherit",
          }}
        >
          ✦
        </button>
      </div>
    </div>
  );
}

/** One message bubble. User turns align right; ai turns align left. Body is a
 * plain React text node (textContent-equivalent) — never innerHTML. */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "82%",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <p
        style={{
          margin: 0,
          padding: "10px 14px",
          borderRadius: 14,
          fontSize: 15,
          fontWeight: 300,
          lineHeight: 1.6,
          color: isUser ? "#FFFDFD" : "rgba(255,253,253,0.85)",
          background: isUser ? "rgba(255,253,253,0.08)" : "#0D0D0C",
          border: isUser ? "none" : "1px solid rgba(255,253,253,0.08)",
          whiteSpace: "pre-wrap",
        }}
      >
        {message.body}
      </p>

      {/* Crisis resources ride along beneath the crisis answer (PHE-22). */}
      {message.isCrisis && message.resources && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "0 14px",
            fontSize: 13,
            fontWeight: 300,
            color: "rgba(255,253,253,0.6)",
          }}
        >
          <span>{message.resources.us}</span>
          <span>{message.resources.text}</span>
          <span>{message.resources.international}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="uppercase"
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.2em",
        color: "rgba(255,253,253,0.45)",
        margin: 0,
        marginBottom: 16,
      }}
    >
      {children}
    </h2>
  );
}

const suggestionStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "#0D0D0C",
  border: "1px solid rgba(255,253,253,0.1)",
  borderRadius: 14,
  padding: "16px 18px",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "border-color 0.2s ease",
};

const chipStyle: React.CSSProperties = {
  background: "transparent",
  border: "0.5px solid rgba(255,253,253,0.18)",
  borderRadius: 999,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 300,
  color: "rgba(255,253,253,0.8)",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "border-color 0.2s ease",
};

const threadRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  background: "transparent",
  border: "none",
  borderRadius: 8,
  padding: "12px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
  transition: "background 0.15s ease",
};

export default PolarisTab;
