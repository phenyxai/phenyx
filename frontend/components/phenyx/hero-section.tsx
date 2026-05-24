"use client";

import { useState, useEffect } from "react";
import { ScrollIndicator } from "./scroll-indicator";
import { IdentityParticles } from "./identity-particles";
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
    <section className="h-screen relative flex flex-col justify-center px-6 md:px-20 py-20 overflow-hidden">
      <div className="mx-auto w-full grid lg:grid-cols-2 gap-12 lg:gap-8 items-center" style={{ maxWidth: "1100px" }}>
        {/* Left content */}
        <div className="flex flex-col gap-6 text-center lg:text-left">
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
            you are not one thing.
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
            PHENYX<br />COLLECTIVE
          </h1>
          
          {/* Tagline - 12px, weight 300, tracking 0.18em, opacity 50% */}
          <p 
            className="text-[12px] lowercase"
            style={{ 
              fontWeight: 300,
              letterSpacing: "0.18em",
              color: "rgba(255,253,253,0.5)",
              ...getAnimationStyle(600),
            }}
          >
            where identity takes form
          </p>
          
          {/* Enter button - 13px, weight 400, tracking 0.1em */}
          <div className="pt-6" style={getAnimationStyle(900)}>
            <button
              onClick={handleEnterClick}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className="px-8 py-3 rounded-full lowercase transition-all"
              style={{
                fontSize: "13px",
                fontWeight: 400,
                letterSpacing: "0.1em",
                border: `1px solid ${isHovered ? `${sessionColor}E6` : `${sessionColor}80`}`,
                backgroundColor: buttonFlash ? sessionColor : (isHovered ? sessionColor : "transparent"),
                color: buttonFlash || isHovered ? "#0A0A0A" : "#FFFDFD",
              }}
            >
              enter
            </button>
          </div>
        </div>
        
        {/* Right side - Identity formation particles (hidden on mobile) */}
        <div className="hidden lg:block relative h-[500px]" aria-hidden="true">
          <IdentityParticles />
        </div>
      </div>
      
      {/* Scroll indicator - positioned at bottom of hero */}
      <ScrollIndicator />
    </section>
  );
}
