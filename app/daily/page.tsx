"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";

type Pillar = "origin" | "emergence" | "self_creation" | "convergence";

const ACTIVE_PILLARS: Pillar[] = ["origin", "emergence", "self_creation", "convergence"];

const DEFAULT_TIMES: Record<Pillar, string> = {
  origin: "07:00",
  emergence: "10:00",
  self_creation: "13:00",
  convergence: "16:00"
};

interface ConstellationState {
  origin_score: number | null;
  origin_synthesis: string | null;
  emergence_score: number | null;
  emergence_synthesis: string | null;
  self_creation_score: number | null;
  self_creation_synthesis: string | null;
  convergence_score: number | null;
  convergence_synthesis: string | null;
}

interface UserProfile {
  id: string;
  prompt_times: Record<string, string> | null;
  tier: string;
  stellar_color: string;
}

export default function DailyPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [stellarColor, setStellarColor] = useState("#5599FF");
  const [userId, setUserId] = useState<string | null>(null);
  
  // Data state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [constellationState, setConstellationState] = useState<ConstellationState | null>(null);
  
  // UI state
  const [targetPillar, setTargetPillar] = useState<Pillar | null>(null);
  const [isWindowOpen, setIsWindowOpen] = useState(false);
  const [nextOpenTime, setNextOpenTime] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [reflectionText, setReflectionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completionState, setCompletionState] = useState<{ nodeCount: number } | null>(null);
  const [skippedPillar, setSkippedPillar] = useState<Pillar | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) setStellarColor(stored);
    setMounted(true);
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/signin");
      return;
    }
    setUserId(user.id);

    // Fetch in parallel: user_profiles and constellation_state
    const [profileRes, stateRes] = await Promise.all([
      supabase.from("user_profiles").select("id, prompt_times, tier, stellar_color").eq("id", user.id).single(),
      supabase.from("constellation_state").select("origin_score, origin_synthesis, emergence_score, emergence_synthesis, self_creation_score, self_creation_synthesis, convergence_score, convergence_synthesis").eq("user_id", user.id).single()
    ]);

    const profileData = profileRes.data as UserProfile | null;
    const stateData = stateRes.data as ConstellationState | null;

    setProfile(profileData);
    setConstellationState(stateData);
    
    if (profileData?.stellar_color) {
      setStellarColor(profileData.stellar_color);
    }

    // Determine target pillar (lowest score)
    const target = determineTargetPillar(stateData);
    setTargetPillar(target);

    // Check if window is open for target pillar
    const times = profileData?.prompt_times ?? DEFAULT_TIMES;
    const windowStatus = checkWindowStatus(target, times as Record<Pillar, string>);
    setIsWindowOpen(windowStatus.isOpen);
    setNextOpenTime(windowStatus.nextTime);

    // If window is open, generate prompt
    if (windowStatus.isOpen && target) {
      generatePrompt(user.id, target, stateData);
    }
  };

  const determineTargetPillar = (state: ConstellationState | null): Pillar => {
    if (!state) return "origin";

    const scores: { pillar: Pillar; score: number }[] = [
      { pillar: "origin", score: state.origin_score ?? 0 },
      { pillar: "emergence", score: state.emergence_score ?? 0 },
      { pillar: "self_creation", score: state.self_creation_score ?? 0 },
      { pillar: "convergence", score: state.convergence_score ?? 0 }
    ];

    // Sort by score ascending, return lowest
    scores.sort((a, b) => a.score - b.score);
    return scores[0].pillar;
  };

  const checkWindowStatus = (pillar: Pillar, times: Record<Pillar, string>): { isOpen: boolean; nextTime: string | null } => {
    const now = new Date();
    const pillarTime = times[pillar] || DEFAULT_TIMES[pillar];
    const [h, m] = pillarTime.split(":").map(Number);
    
    const openTime = new Date(now);
    openTime.setHours(h, m, 0, 0);
    
    const windowEnd = new Date(openTime.getTime() + 4 * 60 * 60 * 1000); // 4 hour window

    if (now >= openTime && now <= windowEnd) {
      return { isOpen: true, nextTime: null };
    }

    // Find next opening time across all pillars
    let earliest: Date | null = null;
    for (const p of ACTIVE_PILLARS) {
      const t = times[p] || DEFAULT_TIMES[p];
      const [ph, pm] = t.split(":").map(Number);
      const pOpen = new Date(now);
      pOpen.setHours(ph, pm, 0, 0);
      
      if (pOpen > now) {
        if (!earliest || pOpen < earliest) {
          earliest = pOpen;
        }
      }
    }

    const nextTimeStr = earliest 
      ? earliest.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : null;

    return { isOpen: false, nextTime: nextTimeStr };
  };

  const generatePrompt = async (uid: string, pillar: Pillar, state: ConstellationState | null) => {
    setIsLoadingPrompt(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setIsLoadingPrompt(false);
      return;
    }

    // Get synthesis for target pillar
    const synthesisKey = `${pillar}_synthesis` as keyof ConstellationState;
    const constellationContext = state?.[synthesisKey] as string | null;

    try {
      const res = await fetch("/api/generate-prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          userId: uid,
          onairosData: null,
          targetPillar: pillar,
          constellationContext: constellationContext || ""
        })
      });

      const data = await res.json();
      if (data.prompt) {
        setGeneratedPrompt(data.prompt);
      }
    } catch (err) {
      console.error("Failed to generate prompt:", err);
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const handleContinue = async () => {
    if (!reflectionText.trim() || !targetPillar || !userId) return;
    
    setIsSubmitting(true);

    try {
      // Save to constellation_points
      await supabase.from("constellation_points").insert({
        user_id: userId,
        pillar: targetPillar.toUpperCase().replace("_", "-"),
        prompt: generatedPrompt,
        answer: reflectionText,
        created_at: new Date().toISOString()
      });

      // Call synthesize-constellation in background (non-blocking)
      fetch("/api/synthesize-constellation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId, 
          onairosData: null,
          newReflection: { pillar: targetPillar, answer: reflectionText }
        })
      }).catch(() => {});

      // Count nodes
      const { count } = await supabase
        .from("constellation_points")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      setCompletionState({ nodeCount: count ?? 1 });
    } catch (err) {
      console.error("Failed to save reflection:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setSkippedPillar(targetPillar);
    setIsWindowOpen(false);
  };

  const getPillarTime = (pillar: Pillar): string => {
    const times = profile?.prompt_times ?? DEFAULT_TIMES;
    return (times as Record<Pillar, string>)[pillar] || DEFAULT_TIMES[pillar];
  };

  const formatPillarName = (pillar: Pillar): string => {
    return pillar.replace("_", " ");
  };

  if (!mounted) return null;

  // Completion state view
  if (completionState) {
    return (
      <main style={{ 
        minHeight: "100vh", 
        background: "#0A0A0A", 
        display: "flex", 
        flexDirection: "column",
        alignItems: "center", 
        justifyContent: "center",
        padding: "0 24px"
      }}>
        <p style={{ 
          fontSize: 22, 
          fontWeight: 300, 
          color: "#FFFDFD", 
          textAlign: "center",
          marginBottom: 12
        }}>
          constellation point added.
        </p>
        <p style={{ 
          fontSize: 15, 
          color: "rgba(255,253,253,0.5)", 
          textAlign: "center",
          marginBottom: 32
        }}>
          {completionState.nodeCount} node{completionState.nodeCount !== 1 ? "s" : ""} in your constellation
        </p>
        <button
          onClick={() => router.push("/constellation")}
          style={{
            background: "transparent",
            border: `0.5px solid ${stellarColor}`,
            borderRadius: 999,
            padding: "12px 28px",
            fontSize: 13,
            color: stellarColor,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#FFFDFD";
            e.currentTarget.style.borderColor = "#FFFDFD";
            e.currentTarget.style.color = "#0A0A0A";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = stellarColor;
            e.currentTarget.style.color = stellarColor;
          }}
        >
          view constellation
        </button>
      </main>
    );
  }

  // Empty state - no window open
  if (!isWindowOpen || skippedPillar === targetPillar) {
    return (
      <main style={{ 
        minHeight: "100vh", 
        background: "#0A0A0A", 
        display: "flex", 
        flexDirection: "column",
        alignItems: "center", 
        justifyContent: "center",
        padding: "0 24px"
      }}>
        {/* Topbar */}
        <header style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          padding: "16px 24px",
          borderBottom: "0.5px solid #1a1a1a",
          background: "#0A0A0A"
        }}>
          <button
            onClick={() => router.push("/constellation")}
            aria-label="go back to constellation"
            style={{ background: "none", border: "none", color: "#666", fontSize: 18, cursor: "pointer", padding: 0, marginRight: 12 }}
          >
            ←
          </button>
          <Link href="/" aria-label="PHENYX COLLECTIVE">
            <Image src="/phenyx-logo.png" alt="" width={20} height={20} style={{ opacity: 0.9 }} />
          </Link>
        </header>

        <p style={{ 
          fontSize: 22, 
          fontWeight: 300, 
          color: "rgba(255,253,253,0.6)", 
          textAlign: "center",
          marginBottom: 12
        }}>
          your next reflection opens at {nextOpenTime || "tomorrow"}.
        </p>
        <p style={{ 
          fontSize: 13, 
          color: "rgba(255,253,253,0.3)", 
          textAlign: "center"
        }}>
          prompts open at the times you set. come back then.
        </p>
      </main>
    );
  }

  // Open prompt card view
  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", color: "#FFFDFD" }}>
      {/* Topbar */}
      <header style={{
        display: "flex",
        alignItems: "center",
        padding: "16px 24px",
        borderBottom: "0.5px solid #1a1a1a"
      }}>
        <button
          onClick={() => router.push("/constellation")}
          aria-label="go back to constellation"
          style={{ background: "none", border: "none", color: "#666", fontSize: 18, cursor: "pointer", padding: 0, marginRight: 12 }}
        >
          ←
        </button>
        <Link href="/" aria-label="PHENYX COLLECTIVE">
          <Image src="/phenyx-logo.png" alt="" width={20} height={20} style={{ opacity: 0.9 }} />
        </Link>
      </header>

      <div style={{ padding: "40px 24px", maxWidth: 600, margin: "0 auto" }}>
        {/* Open Prompt Card */}
        {targetPillar && (
          <article aria-label={`open reflection — ${formatPillarName(targetPillar)}`}>
            {/* Pillar label */}
            <p style={{ 
              fontSize: 11, 
              textTransform: "uppercase", 
              letterSpacing: "0.15em", 
              color: "rgba(255,253,253,0.35)",
              marginBottom: 6
            }}>
              {formatPillarName(targetPillar)}
            </p>

            {/* Generated from constellation */}
            <p style={{ 
              fontSize: 11, 
              color: "rgba(255,253,253,0.2)",
              marginBottom: 24
            }}>
              generated from your constellation
            </p>

            {/* Prompt question */}
            {isLoadingPrompt ? (
              <p style={{ fontSize: 22, fontWeight: 300, color: "rgba(255,253,253,0.3)" }}>
                generating your prompt...
              </p>
            ) : generatedPrompt ? (
              <p style={{ 
                fontSize: 22, 
                fontWeight: 300, 
                color: "#FFFDFD", 
                lineHeight: 1.5,
                maxWidth: 560,
                textTransform: "lowercase",
                marginBottom: 32
              }}>
                {generatedPrompt}
              </p>
            ) : (
              <p style={{ fontSize: 22, fontWeight: 300, color: "rgba(255,253,253,0.3)" }}>
                loading...
              </p>
            )}

            {/* Textarea */}
            <textarea
              aria-label="write your reflection"
              placeholder="take your time. there is no right answer and no wrong length."
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              style={{
                width: "100%",
                minHeight: 180,
                background: "#0d0d0d",
                border: "0.5px solid #1e1e1e",
                borderRadius: 10,
                padding: "16px",
                color: "#FFFDFD",
                fontSize: 14,
                fontWeight: 300,
                fontFamily: "inherit",
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 16
              }}
              onFocus={(e) => {
                e.target.style.borderColor = stellarColor;
                e.target.style.boxShadow = `0 0 0 3px color-mix(in srgb, ${stellarColor} 8%, transparent)`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#1e1e1e";
                e.target.style.boxShadow = "none";
              }}
            />

            {/* Continue button */}
            <button
              onClick={handleContinue}
              disabled={isSubmitting || !reflectionText.trim()}
              aria-busy={isSubmitting}
              style={{
                width: "100%",
                background: "transparent",
                border: `0.5px solid ${stellarColor}`,
                borderRadius: 999,
                padding: "14px 24px",
                fontSize: 13,
                color: stellarColor,
                cursor: reflectionText.trim() ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                opacity: reflectionText.trim() ? 1 : 0.5,
                transition: "all 0.2s ease",
                marginBottom: 16
              }}
              onMouseEnter={(e) => {
                if (reflectionText.trim()) {
                  e.currentTarget.style.background = "#FFFDFD";
                  e.currentTarget.style.borderColor = "#FFFDFD";
                  e.currentTarget.style.color = "#0A0A0A";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = stellarColor;
                e.currentTarget.style.color = stellarColor;
              }}
            >
              {isSubmitting ? "saving..." : "continue"}
            </button>

            {/* Skip link */}
            <button
              onClick={handleSkip}
              style={{
                display: "block",
                width: "100%",
                background: "none",
                border: "none",
                fontSize: 13,
                color: "rgba(255,253,253,0.25)",
                textAlign: "center",
                cursor: "pointer",
                fontFamily: "inherit",
                padding: 0
              }}
            >
              not ready for this one yet
            </button>
          </article>
        )}

        {/* Locked cards for other pillars */}
        <div style={{ marginTop: 48 }}>
          {ACTIVE_PILLARS.filter(p => p !== targetPillar).map((pillar) => (
            <article
              key={pillar}
              aria-label={`${formatPillarName(pillar)} — locked`}
              aria-disabled="true"
              style={{
                background: "#0E0E0E",
                border: "0.5px solid #1C1C1C",
                borderRadius: 10,
                padding: "16px 18px",
                marginBottom: 8
              }}
            >
              <p style={{ 
                fontSize: 11, 
                textTransform: "uppercase", 
                letterSpacing: "0.15em", 
                color: "rgba(255,253,253,0.2)",
                margin: 0,
                marginBottom: 6
              }}>
                {formatPillarName(pillar)}
              </p>
              <p style={{ 
                fontSize: 13, 
                color: "rgba(255,253,253,0.2)",
                fontStyle: "italic",
                margin: 0
              }}>
                {formatPillarName(pillar)} opens at {getPillarTime(pillar)}
              </p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
