"use client";

import { useEffect, useRef, useState } from "react";
import { useSessionColor } from "@/contexts/session-color-context";
import { constellationCopy } from "@/lib/landing-copy";

// Same node data as the waitlist modal
const nodes = [
  { id: 1, label: "ORIGIN", x: 20, y: 82, question: "what did you keep coming back to before you understood why?" },
  { id: 2, label: "EMERGENCE", x: 38, y: 60, question: "what part of you is still finding its shape?" },
  { id: 3, label: "SELF-CREATION", x: 78, y: 70, question: "what exists because you made it?" },
  { id: 4, label: "CONVERGENCE", x: 50, y: 42, question: "where do your different worlds meet?" },
  { id: 5, label: "BECOMING", x: 15, y: 35, question: "who are you when no one is watching?" },
  { id: 6, label: "RECOGNITION", x: 72, y: 18, question: "when did you first feel fully seen?" },
  { id: 7, label: "TRANSCENDENCE", x: 88, y: 5, question: "what are you still becoming?" },
];

const connections = [
  { from: 1, to: 2 },
  { from: 1, to: 3 },
  { from: 1, to: 5 },
  { from: 2, to: 4 },
  { from: 3, to: 4 },
  { from: 5, to: 4 },
  { from: 4, to: 6 },
  { from: 6, to: 7 },
];

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function ProductPreviewSection() {
  const { sessionColor } = useSessionColor();
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Constellation cycling state
  const [activeNodeId, setActiveNodeId] = useState(1);
  const [isHovering, setIsHovering] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);
  const [displayText, setDisplayText] = useState({ label: nodes[0].label, question: nodes[0].question });
  const [textOpacity, setTextOpacity] = useState(1);
  const cycleIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [shuffledSequence, setShuffledSequence] = useState<number[]>([]);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    if (mediaQuery.matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Generate shuffled sequence when section becomes visible
  useEffect(() => {
    if (isVisible && shuffledSequence.length === 0) {
      const newSequence = shuffleArray([1, 2, 3, 4, 5, 6, 7]);
      setShuffledSequence(newSequence);
      const firstNode = nodes.find(n => n.id === newSequence[0]);
      if (firstNode) {
        setActiveNodeId(firstNode.id);
        setDisplayText({ label: firstNode.label, question: firstNode.question });
        currentIndexRef.current = 0;
      }
    }
  }, [isVisible, shuffledSequence.length]);

  // Auto-cycle through nodes with crossfade
  useEffect(() => {
    if (!isVisible || isHovering || shuffledSequence.length === 0) {
      if (cycleIntervalRef.current) {
        clearInterval(cycleIntervalRef.current);
        cycleIntervalRef.current = null;
      }
      return;
    }

    cycleIntervalRef.current = setInterval(() => {
      // Fade out
      setTextOpacity(0);
      
      setTimeout(() => {
        currentIndexRef.current = (currentIndexRef.current + 1) % shuffledSequence.length;
        const nextNodeId = shuffledSequence[currentIndexRef.current];
        const nextNode = nodes.find(n => n.id === nextNodeId);
        
        if (nextNode) {
          setActiveNodeId(nextNodeId);
          setDisplayText({ label: nextNode.label, question: nextNode.question });
        }
        
        // Fade in
        setTextOpacity(1);
      }, 300);
    }, 2500);

    return () => {
      if (cycleIntervalRef.current) {
        clearInterval(cycleIntervalRef.current);
      }
    };
  }, [isVisible, isHovering, shuffledSequence]);

  // Handle hover state changes for text
  useEffect(() => {
    if (isHovering && hoveredNodeId) {
      const hoveredNode = nodes.find(n => n.id === hoveredNodeId);
      if (hoveredNode) {
        setTextOpacity(0);
        setTimeout(() => {
          setDisplayText({ label: hoveredNode.label, question: hoveredNode.question });
          setTextOpacity(1);
        }, 150);
      }
    } else if (!isHovering) {
      // Resume from current active node
      const activeNode = nodes.find(n => n.id === activeNodeId);
      if (activeNode) {
        setTextOpacity(0);
        setTimeout(() => {
          setDisplayText({ label: activeNode.label, question: activeNode.question });
          setTextOpacity(1);
        }, 150);
      }
    }
  }, [isHovering, hoveredNodeId, activeNodeId]);

  const animationStyle = prefersReducedMotion
    ? { opacity: 1, transform: "translateY(0)" }
    : {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 600ms ease-out, transform 600ms ease-out",
      };

  // Get the active node for display
  const displayNodeId = isHovering && hoveredNodeId ? hoveredNodeId : activeNodeId;

  // Get connected lines for active node
  const getConnectedLines = (nodeId: number) => {
    return connections.filter(conn => conn.from === nodeId || conn.to === nodeId);
  };

  const connectedLines = getConnectedLines(displayNodeId);

  return (
    <section
      ref={sectionRef}
      className="w-full"
      style={{
        backgroundColor: "#0A0A0A",
        paddingTop: "80px",
        paddingBottom: "100px",
      }}
    >
      <style>{`
        @keyframes pulseGlow { 
          0%, 100% { opacity: 0.25; transform: scale(1); } 
          50% { opacity: 0.45; transform: scale(1.15); } 
        }
      `}</style>
      <div
        className="mx-auto px-6 md:px-20"
        style={{ maxWidth: "1100px", ...animationStyle }}
      >
        {/* Headline */}
        <h2
          className="lowercase"
          style={{
            fontSize: "28px",
            fontWeight: 300,
            color: "#FFFDFD",
            marginBottom: "12px",
          }}
        >
          {constellationCopy.previewHeadline}
        </h2>

        {/* Subline */}
        <p
          className="lowercase"
          style={{
            fontSize: "15px",
            fontWeight: 300,
            color: "rgba(255,253,253,0.65)",
            marginBottom: "48px",
          }}
        >
          {constellationCopy.previewSubline}
        </p>

        {/* Product preview frame */}
        <div
          style={{
            maxWidth: "100%",
            borderRadius: "16px",
            border: `1px solid ${sessionColor}1F`, // 12% opacity
            backgroundColor: "#111111",
            padding: "40px",
          }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <span
              className="uppercase"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              {constellationCopy.previewBrandLabel}
            </span>
            <span
              className="lowercase"
              style={{
                fontSize: "11px",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              {constellationCopy.previewConstellationLabel}
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              height: "1px",
              backgroundColor: "rgba(255,253,253,0.06)",
              marginTop: "20px",
              marginBottom: "20px",
            }}
          />

          {/* Main area - two columns */}
          <div className="grid grid-cols-1 md:grid-cols-[45%_55%] gap-8">
            {/* Left column - Stage name and question */}
            <div className="flex flex-col" style={{ minHeight: "140px" }}>
              {/* Text that fades */}
              <div style={{ flex: 1 }}>
                {/* Stage label */}
                <p
                  className="uppercase"
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.15em",
                    color: sessionColor,
                    opacity: textOpacity,
                    transition: "opacity 0.3s ease-in-out",
                  }}
                >
                  {displayText.label}
                </p>

                {/* Question text */}
                <p
                  className="lowercase"
                  style={{
                    fontSize: "16px",
                    fontWeight: 300,
                    color: "#FFFDFD",
                    lineHeight: 1.5,
                    marginTop: "12px",
                    opacity: textOpacity,
                    transition: "opacity 0.3s ease-in-out",
                  }}
                >
                  {displayText.question}
                </p>
              </div>

              {/* Reflect label - fixed position at bottom */}
              <span
                className="lowercase"
                style={{
                  fontSize: "13px",
                  color: "rgba(255,253,253,0.6)",
                  marginTop: "auto",
                  paddingTop: "20px",
                }}
              >
                {constellationCopy.reflectLabel}
              </span>
            </div>

            {/* Right column - Constellation SVG */}
            <div className="flex flex-col items-center">
              <svg
                viewBox="0 0 100 100"
                className="w-full"
                style={{ maxHeight: "200px", overflow: "visible" }}
                onMouseLeave={() => {
                  setIsHovering(false);
                  setHoveredNodeId(null);
                }}
              >
                {/* Connection lines */}
                {connections.map((conn, idx) => {
                  const fromNode = nodes.find((n) => n.id === conn.from);
                  const toNode = nodes.find((n) => n.id === conn.to);
                  if (!fromNode || !toNode) return null;

                  const isConnected = connectedLines.some(
                    c => (c.from === conn.from && c.to === conn.to) || 
                         (c.from === conn.to && c.to === conn.from)
                  );

                  return (
                    <line
                      key={idx}
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      stroke={isConnected ? sessionColor : "#FFFDFD"}
                      strokeWidth="0.5"
                      style={{
                        opacity: isConnected ? 0.5 : 0.06,
                        transition: "opacity 0.4s ease, stroke 0.4s ease",
                      }}
                    />
                  );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                  const isActive = node.id === displayNodeId;

                  return (
                    <g
                      key={node.id}
                      onMouseEnter={() => {
                        setIsHovering(true);
                        setHoveredNodeId(node.id);
                      }}
                      className="cursor-pointer"
                    >
                      {/* Pulsing glow for active node */}
                      {isActive && (
                        <>
                          {/* Outer soft bloom */}
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={6}
                            fill={sessionColor}
                            style={{ 
                              filter: "blur(4px)",
                              animation: "pulseGlow 2s ease-in-out infinite",
                              transformOrigin: `${node.x}px ${node.y}px`,
                            }}
                          />
                          {/* Inner glow */}
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r={3.5}
                            fill={sessionColor}
                            opacity={0.4}
                            style={{ filter: "blur(1.5px)" }}
                          />
                        </>
                      )}

                      {/* Node circle */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isActive ? 2.2 : 1.5}
                        fill={isActive ? sessionColor : "#FFFDFD"}
                        opacity={isActive ? 1 : 0.15}
                        style={{ transition: "all 0.4s ease" }}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
