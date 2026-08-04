"use client";

import { useState, useEffect, useRef } from "react";
import { useSessionColor } from "@/contexts/session-color-context";
import { constellationCopy } from "@/lib/landing-copy";

// Elegant asymmetric star map shape - positions per specification
const nodes = [
  { id: 1, label: "origin", x: 20, y: 82, descriptor: "where you started before you had language for it" },
  { id: 2, label: "emergence", x: 38, y: 60, descriptor: "the first version of you that others could see" },
  { id: 3, label: "self-creation", x: 78, y: 70, descriptor: "what you built on purpose" },
  { id: 4, label: "convergence", x: 50, y: 42, descriptor: "where your threads began to meet" },
  { id: 5, label: "becoming", x: 15, y: 35, descriptor: "who you are in motion" },
  { id: 6, label: "recognition", x: 72, y: 18, descriptor: "the moment others saw what you always were" },
  { id: 7, label: "transcendence", x: 88, y: 5, descriptor: "what you are still becoming" },
];

// Build sequence order for sequential animation
const buildSequence = [1, 2, 5, 3, 4, 6, 7];

// Pulse sequence order: origin, emergence, self-creation, becoming, convergence, recognition, transcendence
const pulseSequence = [1, 2, 3, 5, 4, 6, 7];

// Connection map per specification
const connections = [
  { from: 1, to: 2 }, // origin to emergence
  { from: 1, to: 3 }, // origin to self-creation
  { from: 1, to: 5 }, // origin to becoming
  { from: 2, to: 4 }, // emergence to convergence
  { from: 3, to: 4 }, // self-creation to convergence
  { from: 5, to: 4 }, // becoming to convergence
  { from: 4, to: 6 }, // convergence to recognition
  { from: 6, to: 7 }, // recognition to transcendence
];

type SvgTextAnchor = "start" | "middle" | "end" | "inherit";

// Label positions to avoid overlap with lines
const labelOffsets: Record<number, { x: number; y: number; anchor: SvgTextAnchor }> = {
  1: { x: 0, y: 6, anchor: "middle" },        // origin - below
  2: { x: -4, y: 0, anchor: "end" },          // emergence - left
  3: { x: 4, y: 0, anchor: "start" },         // self-creation - right
  4: { x: 0, y: -4, anchor: "middle" },       // convergence - above
  5: { x: -4, y: 0, anchor: "end" },          // becoming - left
  6: { x: 4, y: 0, anchor: "start" },         // recognition - right
  7: { x: 0, y: -4, anchor: "middle" },       // transcendence - above
};

// Descriptor positions - placed further from nodes
const descriptorOffsets: Record<number, { x: number; y: number; anchor: SvgTextAnchor }> = {
  1: { x: 0, y: 10, anchor: "middle" },       // origin - below label
  2: { x: -4, y: 3, anchor: "end" },          // emergence - below left
  3: { x: 4, y: 3, anchor: "start" },         // self-creation - below right
  4: { x: 0, y: -7, anchor: "middle" },       // convergence - above label
  5: { x: -4, y: 3, anchor: "end" },          // becoming - below left
  6: { x: 4, y: 3, anchor: "start" },         // recognition - below right
  7: { x: 0, y: -7, anchor: "middle" },       // transcendence - above label
};

export function Constellation() {
  const { sessionColor } = useSessionColor();
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [visibleNodes, setVisibleNodes] = useState<number[]>([]);
  const [visibleLines, setVisibleLines] = useState<number[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [glowStates, setGlowStates] = useState<Record<number, number>>({});
  const [isActivationGlowActive, setIsActivationGlowActive] = useState(false);
  const [activationGlowOpacity, setActivationGlowOpacity] = useState(0);
  const [buildComplete, setBuildComplete] = useState(false);
  const hasStartedRef = useRef(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Intersection observer to start animation when visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasStartedRef.current) {
            hasStartedRef.current = true;
            startBuildSequence();
          }
        });
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startBuildSequence = () => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    
    if (mediaQuery.matches) {
      setVisibleNodes(nodes.map(n => n.id));
      setVisibleLines(connections.map((_, i) => i));
      setBuildComplete(true);
      return;
    }

    // Sequential build animation
    let delay = 0;
    const nodeDelay = 400;
    const lineDelay = 200;

    buildSequence.forEach((nodeId, index) => {
      // Show node
      setTimeout(() => {
        setVisibleNodes(prev => [...prev, nodeId]);
      }, delay);
      
      delay += nodeDelay;

      // Show lines from this node to already visible nodes
      connections.forEach((conn, lineIdx) => {
        if (conn.from === nodeId || conn.to === nodeId) {
          const otherNode = conn.from === nodeId ? conn.to : conn.from;
          const otherNodeIndex = buildSequence.indexOf(otherNode);
          
          // Only draw line if the other node has already appeared
          if (otherNodeIndex < index) {
            setTimeout(() => {
              setVisibleLines(prev => prev.includes(lineIdx) ? prev : [...prev, lineIdx]);
            }, delay);
            delay += lineDelay;
          }
        }
      });
    });

    // Trigger activation glow after build completes
    setTimeout(() => {
      setBuildComplete(true);
      setIsActivationGlowActive(true);
      
      // Animate activation glow
      let startTime = Date.now();
      const glowDuration = 1000; // 1 second
      
      const animateGlow = () => {
        const elapsed = Date.now() - startTime;
        const progress = elapsed / glowDuration;
        
        if (progress < 0.5) {
          // Fade in
          setActivationGlowOpacity(progress * 2);
        } else if (progress < 1) {
          // Fade out
          setActivationGlowOpacity(1 - ((progress - 0.5) * 2));
        } else {
          setActivationGlowOpacity(0);
          setIsActivationGlowActive(false);
          return;
        }
        
        requestAnimationFrame(animateGlow);
      };
      
      requestAnimationFrame(animateGlow);
    }, delay + 500);
  };

  // Sequential glow animation - only starts after build completes
  useEffect(() => {
    if (prefersReducedMotion || !buildComplete || isActivationGlowActive) return;

    const cycleDuration = 14000;
    const nodeInterval = cycleDuration / 7;
    const fadeTime = 800;
    
    let animationFrame: number;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const cyclePosition = elapsed % cycleDuration;
      
      const newGlowStates: Record<number, number> = {};
      
      pulseSequence.forEach((nodeId, index) => {
        const nodeStartTime = index * nodeInterval;
        const timeSinceStart = cyclePosition - nodeStartTime;
        
        const adjustedTime = timeSinceStart < -nodeInterval * 3 
          ? timeSinceStart + cycleDuration 
          : timeSinceStart;
        
        let glowOpacity = 0;
        
        if (adjustedTime >= 0 && adjustedTime < nodeInterval) {
          if (adjustedTime < fadeTime) {
            glowOpacity = adjustedTime / fadeTime;
          } else if (adjustedTime < nodeInterval - fadeTime) {
            glowOpacity = 1;
          } else {
            glowOpacity = (nodeInterval - adjustedTime) / fadeTime;
          }
        }
        
        newGlowStates[nodeId] = Math.max(0, Math.min(1, glowOpacity));
      });
      
      setGlowStates(newGlowStates);
      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [prefersReducedMotion, buildComplete, isActivationGlowActive]);

  const getNodeRadius = (id: number, isHovered: boolean) => {
    if (isHovered) return 2.5;
    if (id === 1) return 2.2;
    if (id === 7) return 1.8;
    return 1.5;
  };

  // Get connected lines for a node
  const getConnectedLines = (nodeId: number) => {
    return connections
      .map((conn, idx) => ({ ...conn, idx }))
      .filter(conn => conn.from === nodeId || conn.to === nodeId);
  };

  return (
    <div 
      ref={sectionRef}
      className="w-full"
      style={{
        padding: "16px",
        overflow: "visible",
        animation: prefersReducedMotion ? "none" : "constellationFloat 8s ease-in-out infinite",
      }}
    >
      <style jsx>{`
        @keyframes constellationFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>
      
      <svg viewBox="0 0 100 100" className="w-full h-full" style={{ overflow: "visible", minHeight: "300px", maxHeight: "500px" }}>
        <defs>
          <filter id="sessionGlow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="activationGlow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Connection lines */}
        {connections.map((conn, idx) => {
          const fromNode = nodes.find(n => n.id === conn.from);
          const toNode = nodes.find(n => n.id === conn.to);
          if (!fromNode || !toNode) return null;
          
          const isHighlighted = hoveredNode === conn.from || hoveredNode === conn.to;
          const isVisible = visibleLines.includes(idx);
          
          const dx = toNode.x - fromNode.x;
          const dy = toNode.y - fromNode.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          
          return (
            <line
              key={idx}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={isHighlighted || isActivationGlowActive ? sessionColor : "#FFFDFD"}
              strokeWidth="0.5"
              style={{
                opacity: isActivationGlowActive 
                  ? 0.5 * activationGlowOpacity + 0.12 
                  : (isHighlighted ? 0.5 : 0.12),
                strokeDasharray: length,
                strokeDashoffset: isVisible && !prefersReducedMotion ? 0 : length,
                transition: prefersReducedMotion 
                  ? "opacity 0.3s ease" 
                  : "stroke-dashoffset 0.6s ease-out, opacity 0.3s ease, stroke 0.3s ease",
              }}
            />
          );
        })}
        
        {/* Nodes */}
        {nodes.map((node) => {
          const isHovered = hoveredNode === node.id;
          const isVisible = visibleNodes.includes(node.id);
          const offset = labelOffsets[node.id];
          const descOffset = descriptorOffsets[node.id];
          const radius = getNodeRadius(node.id, isHovered);
          
          const glowOpacity = glowStates[node.id] || 0;
          const showSequentialGlow = !isHovered && !isActivationGlowActive && glowOpacity > 0;
          
          return (
            <g
              key={node.id}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "scale(1)" : "scale(0.5)",
                transformOrigin: `${node.x}px ${node.y}px`,
                transition: prefersReducedMotion ? "none" : "opacity 0.4s ease-out, transform 0.4s ease-out",
              }}
            >
              {/* Activation glow */}
              {isActivationGlowActive && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius + 3}
                  fill={sessionColor}
                  opacity={activationGlowOpacity * 0.6}
                  style={{ filter: "url(#activationGlow)" }}
                />
              )}
              
              {/* Sequential pulse glow */}
              {showSequentialGlow && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={radius + 1.5}
                  fill={sessionColor}
                  opacity={glowOpacity * 0.4}
                  style={{ filter: "blur(1.5px)" }}
                />
              )}
              
              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={radius}
                fill={isHovered || isActivationGlowActive ? sessionColor : "#FFFDFD"}
                opacity={1}
                style={{
                  transition: "all 0.3s ease",
                  filter: isHovered ? `drop-shadow(0 0 2px ${sessionColor}55)` : "none",
                }}
              />
              
              {/* Label */}
              <text
                x={node.x + offset.x}
                y={node.y + offset.y}
                textAnchor={offset.anchor}
                fill={isHovered ? sessionColor : "#FFFDFD"}
                fontSize="2.8"
                fontWeight={isHovered ? "400" : "300"}
                opacity={isHovered ? 1 : 0.55}
                className="lowercase select-none"
                style={{ transition: "all 0.3s ease" }}
              >
                {node.label}
              </text>
              
              {/* Descriptor - only visible on hover */}
              <text
                x={node.x + descOffset.x}
                y={node.y + descOffset.y}
                textAnchor={descOffset.anchor}
                fill="#FFFDFD"
                fontSize="2.2"
                fontWeight="300"
                opacity={isHovered ? 0.75 : 0}
                className="lowercase select-none"
                style={{ transition: "opacity 0.3s ease" }}
              >
                {node.descriptor}
              </text>
            </g>
          );
        })}
      </svg>
      
      <p 
        className="text-xs text-center lowercase"
        style={{ color: "rgba(255,253,253,0.6)", marginTop: "8px" }}
      >
        {constellationCopy.visualizationLabel}
      </p>
    </div>
  );
}
