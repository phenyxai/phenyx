"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { OnairosCompleteData } from "onairos";
import { OnairosButtonWrapper } from "@/components/onairos-button-wrapper";
import { redactOnairosForProfile } from "@/lib/onairos-snapshot";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";
import { apiFetch } from "@/lib/api-client";

const STELLAR_PALETTE = [
  "#CC3300", "#E84422", "#E87722", "#E8B822",
  "#D4C87A", "#C8C8C8", "#88AAEE", "#77BBFF",
  "#5599FF", "#4488EE", "#3366DD", "#2255CC",
  "#1144BB", "#0033AA"
];

const PILLARS = [
  "ORIGIN", "EMERGENCE", "SELF-CREATION", "CONVERGENCE",
  "BECOMING", "RECOGNITION", "TRANSCENDENCE"
];

const PROMPTS: Record<string, string[]> = {
  ORIGIN: [
    "close your eyes for a moment.",
    "think about the place you first called home.",
    "not the address, but the feeling.",
    "the light. the sounds you fell asleep to.",
    "the way safety lived in your body.",
    "what made you feel most like yourself",
    "in that earliest world?"
  ],
  EMERGENCE: [
    "at some point, something in you started waking up.",
    "a curiosity that kept returning.",
    "a pull you could not explain.",
    "you may not have had language for it then.",
    "what was that thing?",
    "when did you first notice it?"
  ],
  "SELF-CREATION": [
    "think of something you built, made, chose,",
    "or became entirely on your own.",
    "not because someone told you to.",
    "not because it was expected.",
    "because it was yours.",
    "what was it? and what did it tell you",
    "about what you are made of?"
  ],
  CONVERGENCE: [
    "there are moments when everything you are",
    "comes together at once.",
    "your history, your instincts, your values,",
    "your people.",
    "you feel most complete.",
    "you are not performing or translating yourself.",
    "you are just there.",
    "when does that happen for you?"
  ],
  BECOMING: [
    "something in you is growing",
    "that the world has not fully seen yet.",
    "a version of yourself that is still forming.",
    "you can feel the edges of it.",
    "what is becoming true about you",
    "that you are only beginning to say out loud?"
  ],
  RECOGNITION: [
    "the people who truly see you.",
    "not the version you present,",
    "but the one underneath.",
    "what do they notice that others miss?",
    "and what do they reflect back to you",
    "about who you actually are?"
  ],
  TRANSCENDENCE: [
    "if you let yourself believe in the largest version",
    "of your life,",
    "not the realistic one but the true one,",
    "what does it look like?",
    "what does it ask of you?",
    "what would it mean to already be that person?"
  ]
};

const SCHEDULE_DEFAULTS = [
  { pillar: "ORIGIN", time: "07:00", hint: "your first coffee. before the day's identity begins." },
  { pillar: "EMERGENCE", time: "09:30", hint: "when curiosity is highest." },
  { pillar: "SELF-CREATION", time: "12:00", hint: "midday. a moment of agency." },
  { pillar: "CONVERGENCE", time: "14:30", hint: "the afternoon drift." },
  { pillar: "BECOMING", time: "17:00", hint: "the transition out of the workday." },
  { pillar: "RECOGNITION", time: "19:00", hint: "after the day's social interactions." },
  { pillar: "TRANSCENDENCE", time: "21:00", hint: "the last quiet moment before sleep." }
];

const MOTIVATION_OPTIONS = [
  "understanding myself better",
  "navigating a transition",
  "creative clarity",
  "shaping who i am becoming",
  "something else"
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  opacity: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(-3);
  const [stellarColor, setStellarColor] = useState("#5599FF");
  const [experienceMode, setExperienceMode] = useState("reflection");
  const [userId, setUserId] = useState<string | null>(null);
  
  // Step -3 state
  const [motivation, setMotivation] = useState("");
  const [customMotivation, setCustomMotivation] = useState("");
  const [showContinue, setShowContinue] = useState(false);
  
  // Reflection state
  const [reflections, setReflections] = useState<Record<string, string>>({});
  const [currentReflection, setCurrentReflection] = useState("");
  
  // Onairos state
  const [onairosData, setOnairosData] = useState<object | null>(null);
  const [onairosConnected, setOnairosConnected] = useState(false);
  const [constellationState, setConstellationState] = useState<object | null>(null);
  
  // Step 7 state
  const [promptTimes, setPromptTimes] = useState<Record<string, string>>({
    ORIGIN: "07:00",
    EMERGENCE: "09:30",
    "SELF-CREATION": "12:00",
    CONVERGENCE: "14:30",
    BECOMING: "17:00",
    RECOGNITION: "19:00",
    TRANSCENDENCE: "21:00"
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  
  // Animation states
  const [pillarOpacity, setPillarOpacity] = useState(1);
  const [contentVisible, setContentVisible] = useState(true);
  const [visibleLines, setVisibleLines] = useState<number>(-1);
  const [showInput, setShowInput] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Initialize Onairos SDK from npm package
  // Initialize
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) {
      setStellarColor(stored);
      document.documentElement.style.setProperty("--color-stellar", stored);
    }
    
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("stellar_color, experience_mode")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          if (profile.stellar_color) {
            setStellarColor(profile.stellar_color);
            document.documentElement.style.setProperty("--color-stellar", profile.stellar_color);
          }
          if (profile.experience_mode) {
            setExperienceMode(profile.experience_mode);
          }
        }
      }
    };
    
    fetchUser();
    setMounted(true);
  }, []);

  // Particle animation
  useEffect(() => {
    if (!mounted || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    
    const particles: Particle[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 0.8 + Math.random() * 1.4,
        color: STELLAR_PALETTE[Math.floor(Math.random() * STELLAR_PALETTE.length)],
        opacity: 0.10 + Math.random() * 0.08
      });
    }
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p) => {
        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          
          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;
        }
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      });
      
      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [mounted, prefersReducedMotion]);

  // Pillar opacity animation
  useEffect(() => {
    if (step >= 0 && step <= 6) {
      setPillarOpacity(1);
      const timer = setTimeout(() => setPillarOpacity(0.12), 800);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Line reveal animation for reflection steps
  useEffect(() => {
    if (step >= 0 && step <= 6) {
      // Reset all lines to invisible
      setVisibleLines(-1);
      setShowInput(false);
      setCurrentReflection(reflections[PILLARS[step]] || "");
      setContentVisible(true);
      
      const pillar = PILLARS[step];
      const lines = PROMPTS[pillar];
      const timeouts: NodeJS.Timeout[] = [];
      
      if (experienceMode === "signal") {
        // Only show last line after delay
        const t = setTimeout(() => {
          setVisibleLines(lines.length - 1);
          setTimeout(() => setShowInput(true), 400);
        }, 300);
        timeouts.push(t);
      } else if (experienceMode === "observatory") {
        // Show all lines after delay
        const t = setTimeout(() => {
          setVisibleLines(lines.length - 1);
          setTimeout(() => setShowInput(true), 400);
        }, 300);
        timeouts.push(t);
      } else {
        // Reflection mode: stagger lines with 300ms initial delay
        for (let i = 0; i < lines.length; i++) {
          const t = setTimeout(() => {
            setVisibleLines(i);
          }, 300 + i * 200);
          timeouts.push(t);
        }
        // Show input after last line is visible + 400ms
        const inputDelay = 300 + (lines.length - 1) * 200 + 400 + 400;
        const inputT = setTimeout(() => setShowInput(true), inputDelay);
        timeouts.push(inputT);
      }
      
      return () => timeouts.forEach(clearTimeout);
    }
  }, [step, experienceMode, reflections]);

  // Show continue button after motivation selection
  useEffect(() => {
    if (motivation) {
      const timer = setTimeout(() => setShowContinue(true), 400);
      return () => clearTimeout(timer);
    }
  }, [motivation]);

  const handleSaveReflection = async () => {
    if (!userId || !currentReflection.trim()) return;
    
    const pillar = PILLARS[step];
    
    try {
      await supabase.from("user_persona").upsert({
        user_id: userId,
        pillar,
        reflection_text: currentReflection.trim(),
        created_at: new Date().toISOString()
      }, { onConflict: "user_id,pillar" });
      
      await supabase.rpc("increment_constellation_age", {
        user_id_input: userId,
        amount: 10
      });
      
      const today = new Date().toISOString().split("T")[0];
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("last_reflection_date, streak_count")
        .eq("id", userId)
        .single();
      
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const newStreak =
        profile?.last_reflection_date === yesterday
          ? (profile?.streak_count ?? 0) + 1
          : profile?.last_reflection_date === today
            ? profile?.streak_count ?? 0
            : 1;
      
      await supabase.from("user_profiles").update({
        last_reflection_date: today,
        streak_count: newStreak
      }).eq("id", userId);
      
      setReflections((prev) => ({ ...prev, [pillar]: currentReflection }));
    } catch {
      // Continue anyway
    }
    
    transitionToNextStep();
  };

  const handleSkipReflection = async () => {
    if (!userId) {
      transitionToNextStep();
      return;
    }
    
    const pillar = PILLARS[step];
    
    try {
      await supabase.from("user_persona").upsert({
        user_id: userId,
        pillar,
        reflection_text: null,
        created_at: new Date().toISOString()
      }, { onConflict: "user_id,pillar" });
    } catch {
      // Continue anyway
    }
    
    transitionToNextStep();
  };

  const transitionToNextStep = useCallback(() => {
    setContentVisible(false);
    setTimeout(() => {
      setStep((s) => s + 1);
      setCurrentReflection("");
    }, 600);
  }, []);

// Handle Onairos completion — persist redacted snapshot on profile; constellation synthesis in background
  const handleOnairosComplete = useCallback((result: OnairosCompleteData) => {
    setOnairosConnected(true);
    setOnairosData(result);
    
    // Store token for future API calls (browser only; never written to Supabase)
    if (result.token) {
      localStorage.setItem("onairos_token", result.token);
    }

    const profilePayload = redactOnairosForProfile(result);
    if (userId && Object.keys(profilePayload).length > 0) {
      void supabase
        .from("user_profiles")
        .update({ onairos_data: profilePayload })
        .eq("id", userId)
        .then(({ error }) => {
          if (error) {
            console.warn("[onboarding] user_profiles.onairos_data update:", error.message);
          }
        });
    }
    
    // Call synthesize-constellation in background (non-blocking)
    // Do not await - let UI proceed immediately
    if (userId && result) {
      apiFetch("/synthesize-constellation", {
        method: "POST",
        body: JSON.stringify({ userId, onairosData: result })
      })
        .then((res) => res.json())
        .then((data) => {
          // Store the returned pillar synthesis object in state
          if (data && !data.error) {
            setConstellationState(data);
          }
        })
        .catch(() => {
          // Log silently, don't block UI - synthesis will happen later
        });
    }
  }, [userId]);

  const handleMotivationSave = async () => {
  if (!userId) {
  setStep(-2);
  return;
    }
    
    const value = motivation === "something else" ? customMotivation : motivation;
    
    try {
      await supabase.from("user_profiles").update({
        motivation: value
      }).eq("id", userId);
    } catch {
      // Continue anyway
    }
    
    setStep(-2);
  };

  const handleScheduleSave = async () => {
    if (!userId) {
      router.push("/constellation");
      return;
    }
    
    try {
      await supabase.from("user_profiles").update({
        prompt_times: promptTimes,
        notification_prefs: {
          push: notificationsEnabled,
          sms: false,
          email: true
        }
      }).eq("id", userId);
    } catch {
      // Continue anyway
    }
    
    router.push("/constellation");
  };

  if (!mounted) {
    return <div style={{ minHeight: "100vh", background: "#0A0A0A" }} />;
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0A0A0A", position: "relative", overflow: "hidden" }}>
        {/* Particle canvas */}
        <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          pointerEvents: "none"
        }}
      />
      
      {/* Screen reader announcer */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="step-announcer">
{step === -3 && "motivation question"}
{step === -2 && "constellation preview"}
{step === -1 && "instructions"}
{step === -0.5 && "connect platforms"}
        {step >= 0 && step <= 6 && `${PILLARS[step]} reflection`}
        {step === 7 && "scheduling"}
      </div>
      
      {/* Back arrow for steps 0+ */}
      {step >= 0 && (
        <button
          onClick={() => setStep((s) => s - 1)}
          aria-label="go back to previous step"
          style={{
            position: "fixed",
            top: 24,
            left: 24,
            zIndex: 10,
            background: "none",
            border: "none",
            color: "#555",
            fontSize: "18px",
            cursor: "pointer",
            padding: "8px",
            transition: "color 0.2s ease"
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = "#FFFDFD"}
          onMouseLeave={(e) => e.currentTarget.style.color = "#555"}
        >
          ←
        </button>
      )}
      
      {/* Pillar indicator for steps 0-6 */}
      {step >= 0 && step <= 6 && (
        <p
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 32,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            fontSize: "9px",
            color: "#FFFDFD",
            textTransform: "uppercase",
            letterSpacing: "0.22em",
            opacity: pillarOpacity,
            transition: "opacity 0.8s ease"
          }}
        >
          {PILLARS[step]}
        </p>
      )}
      
      {/* Main content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          opacity: contentVisible ? 1 : 0,
          transition: "opacity 0.6s ease"
        }}
      >
        {/* STEP -3: Motivation */}
        {step === -3 && (
          <div style={{ textAlign: "center", maxWidth: 480 }}>
            <h1
              className="animate-fade-in"
              style={{
                fontSize: "22px",
                fontWeight: 300,
                color: "#FFFDFD",
                letterSpacing: "0.04em",
                marginBottom: "40px"
              }}
            >
              what brought you here?
            </h1>
            
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px", marginBottom: "24px" }}>
              {MOTIVATION_OPTIONS.map((option, i) => (
                <button
                  key={option}
                  onClick={() => setMotivation(option)}
                  aria-label={option}
                  className="animate-fade-in"
                  style={{
                    animationDelay: `${800 + i * 150}ms`,
                    animationFillMode: "both",
                    display: "inline-flex",
                    padding: "9px 22px",
                    fontSize: "12px",
                    fontFamily: "inherit",
                    borderRadius: "20px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    border: motivation === option ? `0.5px solid ${stellarColor}` : "0.5px solid #2a2a2a",
                    color: motivation === option ? "#FFFDFD" : "#555",
                    background: "transparent",
                    outline: "none"
                  }}
                  onMouseEnter={(e) => {
                    if (motivation !== option) {
                      e.currentTarget.style.borderColor = "#444";
                      e.currentTarget.style.color = "#888";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (motivation !== option) {
                      e.currentTarget.style.borderColor = "#2a2a2a";
                      e.currentTarget.style.color = "#555";
                    }
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = `2px solid ${stellarColor}`;
                    e.currentTarget.style.outlineOffset = "2px";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = "none";
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
            
            {motivation === "something else" && (
              <input
                type="text"
                aria-label="tell us what brought you here"
                placeholder="tell us in your own words"
                value={customMotivation}
                onChange={(e) => setCustomMotivation(e.target.value)}
                autoFocus
                className="animate-fade-in"
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #2a2a2a",
                  color: "#FFFDFD",
                  fontSize: "14px",
                  fontWeight: 300,
                  textAlign: "center",
                  width: "60%",
                  outline: "none",
                  paddingBottom: "6px",
                  display: "block",
                  margin: "16px auto 0",
                  fontFamily: "inherit"
                }}
                onFocus={(e) => e.target.style.borderBottomColor = stellarColor}
                onBlur={(e) => e.target.style.borderBottomColor = "#2a2a2a"}
              />
            )}
            
            {showContinue && (
              <button
                onClick={handleMotivationSave}
                aria-label="continue to my constellation"
                className="animate-fade-in"
                style={{
                  marginTop: "32px",
                  background: "transparent",
                  border: `0.5px solid ${stellarColor}`,
                  color: stellarColor,
                  borderRadius: "8px",
                  padding: "10px 32px",
                  fontSize: "13px",
                  fontWeight: 400,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#FFFDFD";
                  e.currentTarget.style.color = "#0A0A0A";
                  e.currentTarget.style.borderColor = "#FFFDFD";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = stellarColor;
                  e.currentTarget.style.borderColor = stellarColor;
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = `2px solid ${stellarColor}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                }}
              >
                continue
              </button>
            )}
          </div>
        )}
        
        {/* STEP -2: Constellation preview */}
        {step === -2 && (
          <div style={{ textAlign: "center" }}>
            <svg
              viewBox="0 0 120 160"
              width={100}
              height={133}
              aria-label="your forming constellation, seven points of identity"
              className="animate-fade-in"
            >
              {/* Connection lines */}
              <line x1={60} y1={141} x2={26} y2={115} stroke="#1a1a1a" strokeWidth={0.5} />
              <line x1={26} y1={115} x2={17} y2={72} stroke="#1a1a1a" strokeWidth={0.5} />
              <line x1={17} y1={72} x2={60} y2={77} stroke="#1a1a1a" strokeWidth={0.5} />
              <line x1={60} y1={77} x2={96} y2={83} stroke="#1a1a1a" strokeWidth={0.5} />
              <line x1={96} y1={83} x2={86} y2={40} stroke="#1a1a1a" strokeWidth={0.5} />
              <line x1={86} y1={40} x2={60} y2={16} stroke="#1a1a1a" strokeWidth={0.5} />
              
              {/* Dots with pulsing animation */}
              {[
                { cx: 60, cy: 141, delay: 0 },
                { cx: 26, cy: 115, delay: 0.4 },
                { cx: 17, cy: 72, delay: 0.8 },
                { cx: 60, cy: 77, delay: 1.2 },
                { cx: 96, cy: 83, delay: 1.6 },
                { cx: 86, cy: 40, delay: 2.0 },
                { cx: 60, cy: 16, delay: 2.4 }
              ].map((dot, i) => (
                <circle
                  key={i}
                  cx={dot.cx}
                  cy={dot.cy}
                  r={3}
                  fill={stellarColor}
                  style={{
                    opacity: prefersReducedMotion ? 0.7 : undefined,
                    animation: prefersReducedMotion ? "none" : `pulse-dot 2.5s ease-in-out infinite`,
                    animationDelay: `${dot.delay}s`
                  }}
                />
              ))}
            </svg>
            
            <p
              className="animate-fade-in"
              style={{
                animationDelay: "400ms",
                animationFillMode: "both",
                marginTop: "24px",
                fontSize: "14px",
                fontWeight: 300,
                color: "#888",
                letterSpacing: "0.06em"
              }}
            >
              your constellation is about to form.
            </p>
            
            <button
              onClick={() => setStep(-1)}
              autoFocus
              aria-label="i am ready to begin my reflection journey"
              className="animate-fade-in"
              style={{
                animationDelay: "1200ms",
                animationFillMode: "both",
                marginTop: "32px",
                background: "transparent",
                border: "0.5px solid #333",
                color: "#888",
                borderRadius: "8px",
                padding: "10px 28px",
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#FFFDFD";
                e.currentTarget.style.color = "#0A0A0A";
                e.currentTarget.style.borderColor = "#FFFDFD";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "#888";
                e.currentTarget.style.borderColor = "#333";
              }}
            >
              i&apos;m ready
            </button>
          </div>
        )}
        
        {/* STEP -1: Instructions */}
        {step === -1 && (
          <div style={{ textAlign: "center" }}>
            {["you will be asked seven questions.", "there are no right answers.", "write what is true."].map((line, i) => (
              <p
                key={i}
                className="animate-fade-in"
                style={{
                  animationDelay: `${i * 1000}ms`,
                  animationFillMode: "both",
                  fontSize: "18px",
                  fontWeight: 300,
                  color: "#FFFDFD",
                  margin: "8px 0"
                }}
              >
                {line}
              </p>
            ))}
            
            <button
              onClick={() => setStep(-0.5)}
              autoFocus
              aria-label="connect your platforms"
              className="animate-fade-in"
              style={{
                animationDelay: "3000ms",
                animationFillMode: "both",
                marginTop: "40px",
                background: "transparent",
                border: `0.5px solid ${stellarColor}`,
                color: stellarColor,
                borderRadius: "8px",
                padding: "12px 32px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#FFFDFD";
                e.currentTarget.style.color = "#0A0A0A";
                e.currentTarget.style.borderColor = "#FFFDFD";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = stellarColor;
                e.currentTarget.style.borderColor = stellarColor;
              }}
            >
              connect my platforms
            </button>
          </div>
        )}

        {/* STEP -0.5: Connect Platforms with Onairos */}
        {step === -0.5 && (
          <div style={{ textAlign: "center", maxWidth: 400, width: "100%" }}>
            <p
              className="animate-fade-in"
              style={{
                fontSize: "18px",
                fontWeight: 300,
                color: "#FFFDFD",
                marginBottom: "8px"
              }}
            >
              connect your platforms
            </p>
            <p
              className="animate-fade-in"
              style={{
                animationDelay: "400ms",
                animationFillMode: "both",
                fontSize: "13px",
                fontWeight: 300,
                color: "#555",
                marginBottom: "32px"
              }}
            >
              onairos reads signals from your connected accounts to deepen your constellation. this is optional.
            </p>

            <div
              className="animate-fade-in"
              style={{
                animationDelay: "800ms",
                animationFillMode: "both"
              }}
            >
              {!onairosConnected ? (
                <OnairosButtonWrapper
                  webpageName="PHENYX COLLECTIVE"
                  requestedData={["Personality Traits"]}
                  onComplete={(result) => {
                    handleOnairosComplete(result);
                  }}
                >
                  <div
                    style={{
                      background: "transparent",
                      border: `0.5px solid ${stellarColor}`,
                      color: stellarColor,
                      borderRadius: "8px",
                      padding: "12px 32px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all 0.2s ease",
                      display: "inline-block"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#FFFDFD";
                      e.currentTarget.style.color = "#0A0A0A";
                      e.currentTarget.style.borderColor = "#FFFDFD";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = stellarColor;
                      e.currentTarget.style.borderColor = stellarColor;
                    }}
                  >
                    connect with onairos
                  </div>
                </OnairosButtonWrapper>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={stellarColor} strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span style={{ fontSize: "13px", color: "#666" }}>platforms connected</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setStep(0)}
              className="animate-fade-in"
              style={{
                animationDelay: "1200ms",
                animationFillMode: "both",
                marginTop: "40px",
                background: "transparent",
                border: "none",
                color: "#333",
                fontSize: "11px",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "color 0.2s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#666"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#333"}
            >
              {onairosConnected ? "continue to reflections" : "skip for now"}
            </button>
          </div>
        )}
        
        {/* STEPS 0-6: Reflections */}
        {step >= 0 && step <= 6 && (
          <div style={{ textAlign: "center", maxWidth: 520, width: "100%" }}>
            {/* Prompt lines */}
            <div style={{ marginBottom: "32px" }}>
              {PROMPTS[PILLARS[step]].map((line, i) => (
                <p
                  key={i}
                  style={{
                    fontSize: experienceMode === "signal" ? "22px" : "18px",
                    fontWeight: 300,
                    color: "#FFFDFD",
                    lineHeight: 1.9,
                    margin: "4px 0",
                    opacity: visibleLines >= i ? 1 : 0,
                    transition: "opacity 0.4s ease"
                  }}
                >
                  {line}
                </p>
              ))}
              
              {experienceMode === "observatory" && showInput && (
                <p style={{ fontSize: "10px", color: "#2a2a2a", marginTop: "12px" }}>
                  onairos is reading signals from your connected platforms for this point.
                </p>
              )}
            </div>
            
            {/* Input area */}
            <div
              style={{
                opacity: showInput ? 1 : 0,
                transition: "opacity 0.4s ease",
                transitionDelay: "400ms",
                paddingBottom: "120px"
              }}
            >
              <label htmlFor="reflection-input" className="sr-only">
                write your reflection here
              </label>
              <textarea
                id="reflection-input"
                aria-label="write your reflection"
                aria-multiline="true"
                placeholder="begin here. there is no wrong answer."
                value={currentReflection}
                onChange={(e) => setCurrentReflection(e.target.value)}
                autoFocus={showInput}
                style={{
                  background: "transparent",
                  border: "none",
                  borderRadius: 0,
                  boxShadow: "none",
                  outline: "none",
                  WebkitAppearance: "none",
                  color: "#FFFDFD",
                  fontSize: "16px",
                  fontWeight: 300,
                  textAlign: "center",
                  width: "60%",
                  minWidth: "280px",
                  maxWidth: "520px",
                  resize: "none",
                  minHeight: "120px",
                  lineHeight: 1.8,
                  display: "block",
                  margin: "24px auto 0",
                  padding: "24px 0",
                  fontFamily: "inherit"
                }}
              />
              <style>{`
                #reflection-input::placeholder {
                  color: #2a2a2a;
                  text-align: center;
                }
                #reflection-input:focus {
                  background: transparent !important;
                  border: none !important;
                  box-shadow: none !important;
                  outline: none !important;
                }
              `}</style>
            </div>
            
            {/* Save button */}
            {currentReflection.trim() && (
              <button
                onClick={handleSaveReflection}
                aria-label="save this reflection and continue to the next question"
                className="animate-fade-in"
                style={{
                  position: "fixed",
                  bottom: 48,
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "transparent",
                  border: `0.5px solid color-mix(in srgb, ${stellarColor} 40%, transparent)`,
                  color: "#888",
                  borderRadius: "8px",
                  padding: "8px 24px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#FFFDFD";
                  e.currentTarget.style.color = "#0A0A0A";
                  e.currentTarget.style.borderColor = "#FFFDFD";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#888";
                  e.currentTarget.style.borderColor = `color-mix(in srgb, ${stellarColor} 40%, transparent)`;
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = `2px solid ${stellarColor}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = "none";
                }}
              >
                save and continue
              </button>
            )}
            
            {/* Skip button */}
            <button
              onClick={handleSkipReflection}
              aria-label="skip this question for now"
              style={{
                position: "fixed",
                bottom: 20,
                left: "50%",
                transform: "translateX(-50%)",
                background: "none",
                border: "none",
                fontSize: "11px",
                color: "#2a2a2a",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "color 0.2s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = "#555"}
              onMouseLeave={(e) => e.currentTarget.style.color = "#2a2a2a"}
              onFocus={(e) => {
                e.currentTarget.style.outline = `2px solid ${stellarColor}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = "none";
              }}
            >
              i&apos;m not ready for this one
            </button>
          </div>
        )}
        
        {/* STEP 7: Scheduling */}
        {step === 7 && (
          <div style={{ textAlign: "center", maxWidth: 360, width: "100%" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 500, color: "#FFFDFD", marginBottom: "8px" }}>
              when do you want to reflect?
            </h2>
            
            <p style={{ fontSize: "13px", fontWeight: 300, color: "#666", lineHeight: 1.7, marginBottom: "32px" }}>
              anchor each to a moment you already have. the platform opens when you are ready. it never pushes.
            </p>
            
            <div style={{ margin: "0 auto" }}>
              {SCHEDULE_DEFAULTS.map(({ pillar, time, hint }) => (
                <div
                  key={pillar}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    marginBottom: "18px",
                    gap: "12px"
                  }}
                >
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <span style={{
                      fontSize: "10px",
                      color: stellarColor,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      fontWeight: 500,
                      display: "block"
                    }}>
                      {pillar}
                    </span>
                    <span style={{ fontSize: "10px", color: "#252525", fontStyle: "italic", marginTop: "3px", display: "block" }}>
                      {hint}
                    </span>
                  </div>
                  <input
                    type="time"
                    defaultValue={time}
                    aria-label={`${pillar} reflection time`}
                    onChange={(e) => setPromptTimes((prev) => ({ ...prev, [pillar]: e.target.value }))}
                    style={{
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid #2a2a2a",
                      color: "#FFFDFD",
                      fontSize: "11px",
                      width: "52px",
                      textAlign: "right",
                      padding: "2px 0",
                      outline: "none",
                      fontFamily: "inherit"
                    }}
                    onFocus={(e) => e.target.style.borderBottomColor = stellarColor}
                    onBlur={(e) => e.target.style.borderBottomColor = "#2a2a2a"}
                  />
                </div>
              ))}
            </div>
            
            {/* Notification toggle */}
            <div style={{ marginTop: "24px", display: "flex", alignItems: "center", gap: "10px", justifyContent: "center" }}>
              <span style={{ fontSize: "12px", color: "#444" }}>notify me when my prompt opens</span>
              <button
                role="switch"
                aria-checked={notificationsEnabled}
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                style={{
                  width: "36px",
                  height: "20px",
                  borderRadius: "10px",
                  background: notificationsEnabled ? stellarColor : "#2a2a2a",
                  border: "none",
                  cursor: "pointer",
                  position: "relative",
                  transition: "background 0.2s ease"
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: notificationsEnabled ? "18px" : "2px",
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    background: "#FFFDFD",
                    transition: "left 0.2s ease"
                  }}
                />
              </button>
            </div>
            
            {notificationsEnabled && (
              <p style={{ fontSize: "10px", color: "#333", marginTop: "6px" }}>
                you can always update this from settings.
              </p>
            )}
            
            {/* CTA button */}
            <button
              onClick={handleScheduleSave}
              aria-label="save my reflection times and reveal my constellation"
              style={{
                marginTop: "28px",
                width: "100%",
                background: "transparent",
                border: `0.5px solid ${stellarColor}`,
                color: stellarColor,
                borderRadius: "8px",
                padding: "13px",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#FFFDFD";
                e.currentTarget.style.color = "#0A0A0A";
                e.currentTarget.style.borderColor = "#FFFDFD";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = stellarColor;
                e.currentTarget.style.borderColor = stellarColor;
              }}
            >
              set my times and see my constellation
            </button>
          </div>
        )}
      </div>
      
      {/* Keyframes for pulsing dots */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        `}</style>
    </main>
  );
}
