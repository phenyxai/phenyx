"use client";

import { useState } from "react";
import { useSessionColor } from "@/contexts/session-color-context";

interface CTASectionProps {
  onEnterClick: () => void;
}

export function CTASection({ onEnterClick }: CTASectionProps) {
  const { sessionColor } = useSessionColor();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <section
      id="s0-cta"
      className="text-center"
      style={{ padding: "104px 24px" }}
    >
      <h2
        className="lowercase mx-auto"
        style={{
          fontSize: "clamp(34px, 5.4vw, 56px)",
          fontWeight: 500,
          lineHeight: 1.15,
          marginBottom: "24px",
          color: "#FFFDFD",
        }}
      >
        ready to see what it adds up to?
      </h2>
      <p
        className="lowercase mx-auto"
        style={{
          fontSize: "16px",
          color: "rgba(255,253,253,0.62)",
          marginBottom: "52px",
          maxWidth: "480px",
          fontWeight: 300,
          lineHeight: 1.7,
        }}
      >
        join the beta and be among the first to see your constellation.
      </p>
      <button
        onClick={onEnterClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="lowercase mx-auto inline-flex items-center"
        style={{
          gap: isHovered ? "14px" : "10px",
          padding: "14px 36px",
          border: `1px solid ${isHovered ? sessionColor : "rgba(255,253,253,0.26)"}`,
          borderRadius: "30px",
          background: isHovered ? `${sessionColor}12` : "transparent",
          color: "#FFFDFD",
          fontSize: "14px",
          letterSpacing: "0.02em",
          cursor: "pointer",
          transition: "all .3s",
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
    </section>
  );
}
