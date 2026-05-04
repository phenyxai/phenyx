"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser as supabase } from "@/lib/supabase-browser";

// Pillars in display order
const ACTIVE_PILLARS = ["origin", "emergence", "self_creation", "convergence"] as const;
const LOCKED_PILLARS = ["becoming", "recognition", "transcendence"] as const;
const ALL_PILLARS = [...ACTIVE_PILLARS, ...LOCKED_PILLARS] as const;

type ActivePillar = typeof ACTIVE_PILLARS[number];
type LockedPillar = typeof LOCKED_PILLARS[number];
type Pillar = typeof ALL_PILLARS[number];

// Node positions as percentage of viewBox (0-100)
const NODE_POSITIONS: Record<Pillar, { x: number; y: number }> = {
  origin:        { x: 50, y: 85 },
  emergence:     { x: 22, y: 70 },
  self_creation: { x: 15, y: 45 },
  convergence:   { x: 50, y: 48 },
  becoming:      { x: 80, y: 50 },
  recognition:   { x: 72, y: 25 },
  transcendence: { x: 50, y: 10 },
};

// Connections between nodes
const CONNECTIONS: [Pillar, Pillar][] = [
  ["origin", "emergence"],
  ["origin", "convergence"],
  ["emergence", "self_creation"],
  ["emergence", "convergence"],
  ["self_creation", "convergence"],
  ["convergence", "becoming"],
  ["becoming", "recognition"],
  ["recognition", "transcendence"],
  ["convergence", "transcendence"],
];

interface UserProfile {
  id: string;
  stellar_color: string;
  display_name: string | null;
}

interface ConstellationState {
  origin_score: number | null;
  origin_synthesis: string | null;
  emergence_score: number | null;
  emergence_synthesis: string | null;
  self_creation_score: number | null;
  self_creation_synthesis: string | null;
  convergence_score: number | null;
  convergence_synthesis: string | null;
  becoming_score: number | null;
  becoming_synthesis: string | null;
  recognition_score: number | null;
  recognition_synthesis: string | null;
  transcendence_score: number | null;
  transcendence_synthesis: string | null;
  archetype: string | null;
  version: number | null;
  generated_at: string | null;
}

interface ConstellationPoint {
  pillar: string;
  intensity: number;
}

// Relative time helper
function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return "1 week ago";
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return "1 month ago";
  return `${Math.floor(diffDays / 30)} months ago`;
}

export default function ConstellationPage() {
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [constellationState, setConstellationState] = useState<ConstellationState | null>(null);
  const [constellationPoints, setConstellationPoints] = useState<ConstellationPoint[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch data
  useEffect(() => {
    if (!mounted) return;

    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/signin");
        return;
      }

      // Fetch in parallel
      const [profileRes, stateRes, pointsRes] = await Promise.all([
        supabase.from("user_profiles").select("id, stellar_color, display_name").eq("id", user.id).single(),
        supabase.from("constellation_state").select("*").eq("user_id", user.id).single(),
        supabase.from("constellation_points").select("pillar, intensity").eq("user_id", user.id),
      ]);

      if (!profileRes.data) {
        router.push("/onboarding");
        return;
      }

      setUserProfile(profileRes.data as UserProfile);
      
      if (stateRes.data) {
        setConstellationState(stateRes.data as ConstellationState);
      }
      
      setConstellationPoints((pointsRes.data || []) as ConstellationPoint[]);
      
      setLoading(false);
      // Trigger fade in after short delay
      setTimeout(() => setFadeIn(true), 50);
    };

    fetchData();
  }, [mounted, router]);

  // Get session color from localStorage or profile
  const sessionColor = useMemo(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("phenyx_stellar_color");
      if (stored) return stored;
    }
    return userProfile?.stellar_color || "#5599FF";
  }, [userProfile]);

  // Helper to get score for a pillar
  const getScore = (pillar: Pillar): number | null => {
    if (!constellationState) return null;
    const key = `${pillar}_score` as keyof ConstellationState;
    return constellationState[key] as number | null;
  };

  // Helper to get synthesis for a pillar
  const getSynthesis = (pillar: Pillar): string | null => {
    if (!constellationState) return null;
    const key = `${pillar}_synthesis` as keyof ConstellationState;
    return constellationState[key] as string | null;
  };

  // Calculate node properties based on score
  const getNodeProps = (pillar: Pillar) => {
    const isLocked = LOCKED_PILLARS.includes(pillar as LockedPillar);
    const score = getScore(pillar);
    const pos = NODE_POSITIONS[pillar];

    if (isLocked) {
      return {
        x: pos.x,
        y: pos.y,
        radius: 5,
        opacity: 0.15,
        fill: "none",
        stroke: "rgba(255,253,253,0.15)",
        strokeWidth: 1,
        glow: null,
      };
    }

    // Active node
    const actualScore = score ?? 0;
    const radius = 6 + (actualScore / 100) * 6;
    const opacity = Math.max(0.3, actualScore / 100);
    
    // Glow intensity: 40% at score 0, 90% at score 100
    const glowOpacity = 0.4 + (actualScore / 100) * 0.5;
    const glowRadius = 4 + (actualScore / 100) * 8;

    return {
      x: pos.x,
      y: pos.y,
      radius,
      opacity,
      fill: `rgba(255,253,253,${opacity})`,
      stroke: "none",
      strokeWidth: 0,
      glow: {
        color: sessionColor,
        opacity: glowOpacity,
        radius: glowRadius,
      },
    };
  };

  // Calculate line opacity based on connected node scores
  const getLineOpacity = (pillar1: Pillar, pillar2: Pillar): number => {
    const isLocked1 = LOCKED_PILLARS.includes(pillar1 as LockedPillar);
    const isLocked2 = LOCKED_PILLARS.includes(pillar2 as LockedPillar);
    
    // Default opacity for any line
    if (isLocked1 || isLocked2) return 0.08;
    
    const score1 = getScore(pillar1);
    const score2 = getScore(pillar2);
    
    if (score1 === null || score2 === null) return 0.08;
    
    const avgScore = (score1 + score2) / 2;
    const opacity = avgScore / 100;
    
    // Floor 0.06, ceiling 0.2
    return Math.max(0.06, Math.min(0.2, opacity));
  };

  const displayName = userProfile?.display_name || "traveler";
  const archetype = constellationState?.archetype;
  const version = constellationState?.version;
  const generatedAt = constellationState?.generated_at;

  // Loading state
  if (!mounted || loading) {
    return (
      <main style={{ 
        minHeight: "100vh", 
        background: "#0A0A0A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 20px",
      }}>
        {/* Loading SVG with all nodes at default */}
        <div style={{ width: "100%", maxWidth: "500px", aspectRatio: "1" }}>
          <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
            {/* Connection lines */}
            {CONNECTIONS.map(([p1, p2], i) => (
              <line
                key={i}
                x1={NODE_POSITIONS[p1].x}
                y1={NODE_POSITIONS[p1].y}
                x2={NODE_POSITIONS[p2].x}
                y2={NODE_POSITIONS[p2].y}
                stroke="rgba(255,253,253,0.08)"
                strokeWidth="0.3"
              />
            ))}
            {/* Nodes */}
            {ALL_PILLARS.map((pillar) => (
              <circle
                key={pillar}
                cx={NODE_POSITIONS[pillar].x}
                cy={NODE_POSITIONS[pillar].y}
                r={5}
                fill="rgba(255,253,253,0.15)"
              />
            ))}
          </svg>
        </div>
      </main>
    );
  }

  return (
    <main style={{ 
      minHeight: "100vh", 
      background: "#0A0A0A",
      opacity: fadeIn ? 1 : 0,
      transition: "opacity 400ms ease",
      padding: "40px 20px",
    }}>
      {/* Left column: Name + Archetype */}
      <div style={{
        position: "fixed",
        top: "40px",
        left: "40px",
      }}>
        <p style={{
          fontSize: "13px",
          color: "rgba(255,253,253,0.5)",
          margin: 0,
          fontWeight: 300,
        }}>
          {displayName}
        </p>
        {archetype && (
          <p style={{
            fontSize: "11px",
            color: "rgba(255,253,253,0.3)",
            margin: 0,
            marginTop: "4px",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
          }}>
            {archetype}
          </p>
        )}
      </div>

      {/* SVG Constellation */}
      <div style={{
        width: "100%",
        maxWidth: "500px",
        margin: "0 auto 40px",
        aspectRatio: "1",
      }}>
        <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
          <defs>
            {/* Glow filters for each active node */}
            {ACTIVE_PILLARS.map((pillar) => {
              const props = getNodeProps(pillar);
              if (!props.glow) return null;
              return (
                <filter key={`glow-${pillar}`} id={`glow-${pillar}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow
                    dx="0"
                    dy="0"
                    stdDeviation={props.glow.radius / 3}
                    floodColor={props.glow.color}
                    floodOpacity={props.glow.opacity}
                  />
                </filter>
              );
            })}
          </defs>

          {/* Connection lines */}
          {CONNECTIONS.map(([p1, p2], i) => (
            <line
              key={i}
              x1={NODE_POSITIONS[p1].x}
              y1={NODE_POSITIONS[p1].y}
              x2={NODE_POSITIONS[p2].x}
              y2={NODE_POSITIONS[p2].y}
              stroke={`rgba(255,253,253,${getLineOpacity(p1, p2)})`}
              strokeWidth="0.3"
            />
          ))}

          {/* Nodes */}
          {ALL_PILLARS.map((pillar) => {
            const props = getNodeProps(pillar);
            const isLocked = LOCKED_PILLARS.includes(pillar as LockedPillar);
            
            return (
              <circle
                key={pillar}
                cx={props.x}
                cy={props.y}
                r={props.radius}
                fill={props.fill}
                stroke={props.stroke}
                strokeWidth={props.strokeWidth}
                filter={!isLocked && props.glow ? `url(#glow-${pillar})` : undefined}
              />
            );
          })}
        </svg>
      </div>

      {/* Pillar Cards */}
      <div style={{
        maxWidth: "600px",
        margin: "0 auto",
      }}>
        {/* Active pillar cards */}
        {ACTIVE_PILLARS.map((pillar) => {
          const score = getScore(pillar) ?? 0;
          const synthesis = getSynthesis(pillar);
          const pillarLabel = pillar.replace("_", " ");

          return (
            <div
              key={pillar}
              style={{
                background: "rgba(255,253,253,0.02)",
                border: "1px solid rgba(255,253,253,0.06)",
                borderRadius: "12px",
                padding: "20px 24px",
                marginBottom: "12px",
              }}
            >
              {/* Header row */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}>
                <span style={{
                  fontSize: "11px",
                  color: "rgba(255,253,253,0.35)",
                  textTransform: "uppercase",
                  letterSpacing: "0.15em",
                }}>
                  {pillarLabel}
                </span>
                <span style={{
                  fontSize: "11px",
                  color: "rgba(255,253,253,0.2)",
                }}>
                  {score} / 100
                </span>
              </div>

              {/* Score bar */}
              <div style={{
                width: "100%",
                height: "2px",
                background: "rgba(255,253,253,0.06)",
                borderRadius: "999px",
                overflow: "hidden",
              }}>
                <div
                  style={{
                    width: `${score}%`,
                    height: "100%",
                    background: sessionColor,
                    opacity: 0.6,
                    borderRadius: "999px",
                    animation: "scoreBarFill 800ms ease-out forwards",
                  }}
                />
              </div>

              {/* Synthesis text */}
              <div style={{ marginTop: "14px" }}>
                {synthesis ? (
                  <p style={{
                    fontSize: "15px",
                    fontWeight: 300,
                    color: "rgba(255,253,253,0.75)",
                    lineHeight: 1.7,
                    margin: 0,
                  }}>
                    {synthesis}
                  </p>
                ) : (
                  <p style={{
                    fontSize: "13px",
                    color: "rgba(255,253,253,0.2)",
                    fontStyle: "italic",
                    margin: 0,
                  }}>
                    forming.
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Locked pillars card */}
        <div style={{
          background: "rgba(255,253,253,0.02)",
          border: "1px solid rgba(255,253,253,0.06)",
          borderRadius: "12px",
          padding: "20px 24px",
          marginBottom: "12px",
        }}>
          <p style={{
            fontSize: "11px",
            color: "rgba(255,253,253,0.2)",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            margin: 0,
          }}>
            becoming {"  "} recognition {"  "} transcendence
          </p>
          <p style={{
            fontSize: "13px",
            color: "rgba(255,253,253,0.2)",
            fontWeight: 300,
            fontStyle: "italic",
            margin: 0,
            marginTop: "10px",
          }}>
            these form over time. keep returning.
          </p>
        </div>

        {/* Constellation age */}
        {version && generatedAt && (
          <p style={{
            fontSize: "11px",
            color: "rgba(255,253,253,0.2)",
            textAlign: "center",
            marginTop: "24px",
          }}>
            constellation v{version} · formed {getRelativeTime(generatedAt)}
          </p>
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes scoreBarFill {
          from {
            width: 0%;
          }
        }
      `}</style>
    </main>
  );
}
