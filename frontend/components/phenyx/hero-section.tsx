"use client";

import { useState, useEffect } from "react";
import { ScrollIndicator } from "./scroll-indicator";
import { IdentityParticles } from "./identity-particles";
import { HeroStarfield } from "./hero-starfield";
import { useSessionColor } from "@/contexts/session-color-context";

interface HeroSectionProps {
  onEnterClick: () => void;
}

export function HeroSection({ onEnterClick }: HeroSectionProps) {
  const { sessionColor } = useSessionColor();
  const [isLoaded, setIsLoaded] = useState(false);
  const [buttonFlash, setButtonFlash] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    setIsLoaded(true);
  }, []);

  const handleEnterClick = () => {
    setButtonFlash(true);
    setTimeout(() => {
      setButtonFlash(false);
      onEnterClick();
    }, 80);
  };

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
    <section id="s0-top" className="h-screen relative flex flex-col justify-center px-6 md:px-20 py-20 overflow-hidden">
      {/* Ambient starfield — sits behind everything (z-0) */}
      <HeroStarfield />
      <div className="relative z-[2] mx-auto w-full grid lg:grid-cols-2 gap-12 lg:gap-8 items-center" style={{ maxWidth: "1100px" }}>
        {/* Left content */}
        <div className="flex flex-col gap-6 max-lg:items-center max-lg:text-center lg:text-left">
          {/* Subline - 16px, weight 300, tracking 0.08em, opacity 70% */}
          <p 
            className="text-[16px] lowercase"
            style={{ 
              fontWeight: 300,
              letterSpacing: "0.08em",
              color: "rgba(255,253,253,0.7)",
              ...getAnimationStyle(0),
            }}
          >
            once you see it, you can&apos;t unsee it.
          </p>
          
          {/* Hero headline - responsive sizing to prevent overflow */}
          <h1 
            className="text-[36px] sm:text-[48px] md:text-[60px] lg:text-[72px] uppercase"
            style={{ 
              fontWeight: 700,
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              color: "#FFFDFD",
              ...getAnimationStyle(300),
            }}
          >
            PHENYX
          </h1>
          
          {/* Tagline - 12px, weight 300, tracking 0.18em, opacity 50% */}
          <p
            className="text-[15px] lowercase"
            style={{
              fontWeight: 300,
              letterSpacing: "0.18em",
              color: "rgba(255,253,253,0.5)",
              ...getAnimationStyle(600),
            }}
          >
            an identity observatory.
          </p>
          
          {/* Enter button - 13px, weight 400, tracking 0.1em */}
          <div className="pt-6" style={getAnimationStyle(900)}>
            <button
              onClick={handleEnterClick}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="inline-flex items-center rounded-full lowercase transition-all"
              style={{
                gap: isHovered ? "14px" : "10px",
                padding: "12px 32px",
                fontSize: "13px",
                fontWeight: 400,
                letterSpacing: "0.1em",
                border: `1px solid ${isHovered ? `${sessionColor}E6` : `${sessionColor}80`}`,
                backgroundColor: buttonFlash ? sessionColor : (isHovered ? sessionColor : "transparent"),
                color: buttonFlash || isHovered ? "#0A0A0A" : "#FFFDFD",
              }}
            >
              <span>enter</span>
              <span
                className="inline-flex items-center"
                style={{
                  transform: isHovered ? "translateX(3px)" : "translateX(0)",
                  transition: "transform .3s",
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
        </div>
        
        {/* Right side - Identity formation particles (hidden on mobile) */}
        <div className="max-lg:hidden relative z-[1] h-[500px]" aria-hidden="true">
          <IdentityParticles />
        </div>
      </div>
      
      {/* Scroll indicator - positioned at bottom of hero */}
      <ScrollIndicator />
    </section>
  );
}
