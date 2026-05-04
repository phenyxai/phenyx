"use client";

import { useEffect, useState } from "react";

export function ScrollIndicator() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY < 80);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={`absolute left-1/2 flex flex-col items-center gap-1.5 transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      style={{
        bottom: "32px",
        transform: "translateX(-50%)",
      }}
    >
      {/* Pulsing dot */}
      <div
        className="w-1 h-1 rounded-full"
        style={{
          backgroundColor: "#FFFDFD",
          animation: "pulse-indicator 2s ease-in-out infinite",
        }}
      />
      {/* Scroll label */}
      <span
        className="text-[10px] lowercase tracking-[0.2em]"
        style={{ color: "rgba(255,253,253,0.6)" }}
      >
        scroll
      </span>
      
      <style jsx>{`
        @keyframes pulse-indicator {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
