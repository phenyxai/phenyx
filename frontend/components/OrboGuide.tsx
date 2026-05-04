"use client";

import { useState, useEffect, useCallback } from "react";

interface TourStop {
  targetSelector: string;
  text: string;
}

interface OrboGuideProps {
  page: "constellation" | "daily" | "settings";
  stellarColor: string;
  motivation?: string;
  onComplete?: () => void;
}

const TOURS: Record<string, TourStop[]> = {
  constellation: [
    { targetSelector: "#constellation-canvas", text: "this is your constellation. every point is a piece of who you are. it grows with every reflection you add." },
    { targetSelector: "[data-pillar-card]", text: "tap any pillar to see the synthesis. what phenyx found in your words. what was always there." },
    { targetSelector: "#user-star-label", text: "your star type is the color that found you when you first arrived. it deepens as your constellation grows." },
  ],
  daily: [
    { targetSelector: "[data-open-prompt]", text: "this is your prompt for today. it opened at the time you chose. it is waiting because you are ready." },
    { targetSelector: "[data-locked-card]", text: "the other points are observing. they open when their time comes. phenyx never pushes. it waits." },
    { targetSelector: "#streak-indicator", text: "this is your streak. every day you reflect adds to it. the constellation responds." },
    { targetSelector: "#progress-bar", text: "this shows how far your constellation has formed. each reflection adds a point of light." },
  ],
  settings: [
    { targetSelector: "#experience-mode-section", text: "choose how phenyx talks to you — reflection for everyone; signal & observatory when you have pro or a gifted constellation." },
    { targetSelector: "#upgrade-section", text: "full access lives here when you are ready. more reflections, more depth, a star at full luminosity." },
    { targetSelector: "#reflection-times-section", text: "these are the moments you anchored your practice to. adjust them as your life changes." },
  ],
};

const FINAL_MESSAGES: Record<string, string> = {
  "understanding myself better": "yes. every answer you write brings the pattern closer to the surface. your constellation is always watching. go find what it sees.",
  "navigating a transition": "yes. your constellation will hold steady while everything else shifts. come back whenever you need to see yourself clearly.",
  "creative clarity": "yes. the most honest answers will surprise you. go.",
  "shaping who i am becoming": "yes. the constellation shows what is real. reflect honestly. the becoming starts with the seeing.",
  default: "yes. what you are building here is a portrait only you could have. go add to it.",
};

export function OrboGuide({ page, stellarColor, motivation, onComplete }: OrboGuideProps) {
  const [currentStop, setCurrentStop] = useState(0);
  const [position, setPosition] = useState({ top: 100, left: 100 });
  const [showCard, setShowCard] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const [visible, setVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const storageKey = `orbo_tour_${page}`;
  const tour = TOURS[page] || [];

  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (completed === "completed") {
      setVisible(false);
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
  }, [storageKey]);

  const moveToStop = useCallback((stopIndex: number) => {
    if (stopIndex >= tour.length) return;
    
    const stop = tour[stopIndex];
    const el = document.querySelector(stop.targetSelector);
    
    if (el) {
      const rect = el.getBoundingClientRect();
      setPosition({
        top: rect.top + rect.height / 2 - 20,
        left: rect.left + rect.width / 2 - 20,
      });
    } else {
      setPosition({ top: 100 + stopIndex * 80, left: 100 });
    }

    setShowCard(false);
    setTimeout(() => setShowCard(true), prefersReducedMotion ? 0 : 300);
  }, [tour, prefersReducedMotion]);

  useEffect(() => {
    if (visible && tour.length > 0) {
      moveToStop(0);
    }
  }, [visible, tour.length, moveToStop]);

  const handleNext = () => {
    if (showFinal) {
      localStorage.setItem(storageKey, "completed");
      setVisible(false);
      onComplete?.();
      return;
    }

    if (currentStop < tour.length - 1) {
      const nextStop = currentStop + 1;
      setCurrentStop(nextStop);
      moveToStop(nextStop);
    } else {
      setShowFinal(true);
    }
  };

  if (!visible || tour.length === 0) return null;

  const isLastStop = currentStop === tour.length - 1 && !showFinal;
  const buttonText = showFinal ? "got it" : isLastStop ? "is that all?" : "what's next?";
  const finalMessage = FINAL_MESSAGES[motivation || ""] || FINAL_MESSAGES.default;

  return (
    <>
      {/* Orb */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: position.top,
          left: position.left,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: stellarColor,
          boxShadow: prefersReducedMotion
            ? "none"
            : `0 0 20px color-mix(in srgb, ${stellarColor} 35%, transparent), 0 0 40px color-mix(in srgb, ${stellarColor} 15%, transparent)`,
          transition: prefersReducedMotion ? "none" : "top 0.8s ease, left 0.8s ease",
          zIndex: 1000,
          pointerEvents: "none",
          opacity: visible ? 1 : 0,
        }}
      />

      {/* Card */}
      {showCard && (
        <div
          role="dialog"
          aria-label="orbo guide"
          style={{
            position: "fixed",
            top: Math.min(position.top + 50, window.innerHeight - 200),
            left: Math.min(Math.max(position.left - 100, 16), window.innerWidth - 260),
            background: "#0E0E0E",
            border: `0.5px solid color-mix(in srgb, ${stellarColor} 35%, transparent)`,
            borderRadius: 12,
            padding: "16px 20px",
            maxWidth: 240,
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            zIndex: 1001,
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: "#FFFDFD",
              fontWeight: 300,
              lineHeight: 1.7,
              margin: 0,
              marginBottom: 12,
            }}
          >
            {showFinal ? finalMessage : tour[currentStop]?.text}
          </p>
          <button
            onClick={handleNext}
            aria-label={buttonText}
            style={{
              background: "transparent",
              border: `0.5px solid color-mix(in srgb, ${stellarColor} 60%, transparent)`,
              color: stellarColor,
              fontSize: 11,
              borderRadius: 20,
              padding: "6px 16px",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `color-mix(in srgb, ${stellarColor} 10%, transparent)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {buttonText}
          </button>
        </div>
      )}
    </>
  );
}
