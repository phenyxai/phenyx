"use client";

import { useEffect, useState } from "react";
import { useSessionColor } from "@/contexts/session-color-context";
import { useRouter } from "next/navigation";

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWaitlist?: () => void;
}

export function EntryModal({ isOpen, onClose, onWaitlist }: EntryModalProps) {
  const { sessionColor } = useSessionColor();
  const router = useRouter();
  const [isFading, setIsFading] = useState(false);
  const [returningHovered, setReturningHovered] = useState(false);
  const [firstTimeHovered, setFirstTimeHovered] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsFading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleReturning = () => {
    if (onWaitlist) {
      onWaitlist();
    } else {
      router.push("/signin");
    }
  };

  const handleFirstTime = () => {
    if (onWaitlist) {
      onWaitlist();
    } else {
      router.push("/join");
    }
  };

  const handleClose = () => {
    setIsFading(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-[#080808]/80 backdrop-blur-sm" />
      
      <div 
        className="relative p-8 md:p-12 max-w-md w-full transition-opacity duration-300"
        style={{
          backgroundColor: "#080808",
          border: "1px solid rgba(255,253,253,0.08)",
          opacity: isFading ? 0 : 1,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 transition-colors"
          style={{ color: "rgba(255,253,253,0.5)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "#FFFDFD"}
          onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,253,253,0.5)"}
          aria-label="Close modal"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div style={{ animation: "fadeIn 400ms ease-out" }}>
          <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
          
          <h2 className="text-2xl font-semibold mb-2 lowercase">come in</h2>
          <p className="text-sm font-light lowercase mb-8" style={{ color: "rgba(255,253,253,0.6)" }}>
            return to your view, or look around before you connect anything.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleReturning}
              onMouseEnter={() => setReturningHovered(true)}
              onMouseLeave={() => setReturningHovered(false)}
              className="w-full px-6 py-3 rounded-full text-[13px] lowercase font-medium tracking-wide transition-all"
              style={{ 
                border: `1px solid ${returningHovered ? sessionColor : `${sessionColor}80`}`,
                backgroundColor: returningHovered ? sessionColor : "transparent",
                color: returningHovered ? "#080808" : "#FFFDFD",
              }}
            >
              i have been here
            </button>
            
            <button
              onClick={handleFirstTime}
              onMouseEnter={() => setFirstTimeHovered(true)}
              onMouseLeave={() => setFirstTimeHovered(false)}
              className="w-full px-6 py-3 rounded-full text-[13px] lowercase font-medium tracking-wide transition-all"
              style={{ 
                border: `1px solid ${firstTimeHovered ? sessionColor : `${sessionColor}80`}`,
                backgroundColor: firstTimeHovered ? sessionColor : "transparent",
                color: firstTimeHovered ? "#080808" : "#FFFDFD",
              }}
            >
              this is my first time
            </button>

            <p className="text-center text-xs lowercase pt-2" style={{ color: "rgba(255,253,253,0.4)" }}>
              nothing connects until you choose it
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
