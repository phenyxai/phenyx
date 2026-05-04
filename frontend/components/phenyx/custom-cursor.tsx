"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionColor } from "@/contexts/session-color-context";

export function CustomCursor() {
  const { sessionColor } = useSessionColor();
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const targetPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Check if mobile/tablet
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      targetPos.current = { x: e.clientX, y: e.clientY };
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    // Smooth lerp animation
    const animate = () => {
      const lerp = 0.12; // ~80-100ms lag feel
      
      currentPos.current.x += (targetPos.current.x - currentPos.current.x) * lerp;
      currentPos.current.y += (targetPos.current.y - currentPos.current.y) * lerp;
      
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate(${currentPos.current.x - 6}px, ${currentPos.current.y - 6}px)`;
      }
      
      rafRef.current = requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isMobile, isVisible]);

  // Don't render on mobile/tablet
  if (isMobile) return null;

  return (
    <>
      {/* Hide default cursor on desktop */}
      <style jsx global>{`
        @media (min-width: 769px) {
          * {
            cursor: none !important;
          }
        }
      `}</style>
      
      {/* Custom orb cursor */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.15s ease",
        }}
      >
        {/* Glow layer */}
        <div
          className="absolute rounded-full"
          style={{
            width: "28px",
            height: "28px",
            top: "-8px",
            left: "-8px",
            background: `radial-gradient(circle, ${sessionColor}66 0%, transparent 70%)`,
          }}
        />
        {/* Core orb */}
        <div
          className="rounded-full"
          style={{
            width: "12px",
            height: "12px",
            backgroundColor: sessionColor,
            boxShadow: `0 0 8px ${sessionColor}66`,
          }}
        />
      </div>
    </>
  );
}
