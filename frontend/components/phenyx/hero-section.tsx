"use client";

import { useState, useEffect } from "react";
import { ScrollIndicator } from "./scroll-indicator";
import { IdentityParticles } from "./identity-particles";
import { HeroStarfield } from "./hero-starfield";

interface HeroSectionProps {
  onEnterClick: () => void;
}

export function HeroSection({ onEnterClick }: HeroSectionProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    setIsLoaded(true);
  }, []);

  const getAnimationStyle = (delay: number) => {
    if (prefersReducedMotion) {
      return { opacity: 1 };
    }
    return {
      opacity: isLoaded ? 1 : 0,
      transform: isLoaded ? "translateY(0)" : "translateY(12px)",
      transition: `opacity 600ms ease-out ${delay}ms, transform 600ms ease-out ${delay}ms`,
    };
  };

  return (
    <header
      id="s0-top"
      className="hero"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "88px clamp(28px,5vw,72px) 0",
        gap: "clamp(28px,4vw,64px)",
        maxWidth: "1240px",
        margin: "0 auto",
        width: "100%",
        position: "relative",
        overflow: "clip",
      }}
    >
      <div
        className="hero-particle-field"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "62%",
          height: "100vh",
          zIndex: 0,
        }}
      >
        <HeroStarfield />
        <IdentityParticles />
      </div>

      <div
        className="hero-content"
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "600px",
          flex: "1 1 55%",
        }}
      >
        <h1
          className="hero-logo"
          style={{
            fontSize: "clamp(52px,7.5vw,92px)",
            fontWeight: 600,
            letterSpacing: "-0.022em",
            lineHeight: 0.94,
            marginBottom: "14px",
            color: "rgba(255,253,253,0.97)",
            ...getAnimationStyle(0),
          }}
        >
          PHENYX
        </h1>

        <p
          className="hero-tagline"
          style={{
            fontSize: "19px",
            color: "rgba(255,253,253,0.66)",
            marginBottom: "26px",
            fontWeight: 300,
            ...getAnimationStyle(300),
          }}
        >
          your life, taking form
        </p>

        <p
          className="hero-desc"
          style={{
            fontSize: "14.5px",
            lineHeight: 1.8,
            color: "rgba(255,253,253,0.56)",
            maxWidth: "520px",
            margin: "16px 0 34px",
            fontWeight: 300,
            ...getAnimationStyle(600),
          }}
        >
          see who you've been, across everything you already use.
        </p>

        <button
          onClick={onEnterClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="hero-enter"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: isHovered ? "12px" : "10px",
            padding: "14px 36px",
            border: "1px solid rgba(255,253,253,0.26)",
            borderRadius: "30px",
            background: "transparent",
            fontSize: "14px",
            color: "#FFFDFD",
            cursor: "pointer",
            transition: "all 0.3s ease",
            ...getAnimationStyle(900),
          }}
        >
          <span>enter</span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              transform: isHovered ? "translateX(3px)" : "translateX(0)",
              transition: "transform 0.3s",
            }}
          >
            <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
              <path
                d="M0.5 5H15M15 5L10.5 0.5M15 5L10.5 9.5"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </div>

      <ScrollIndicator />
    </header>
  );
}
