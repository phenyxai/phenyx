"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EntryModal({ isOpen, onClose }: EntryModalProps) {
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSignIn = () => {
    router.push("/signin");
  };

  const handleJoin = () => {
    router.push("/join");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(8,8,8,0.92)",
        backdropFilter: "blur(12px)",
      }}
      onClick={onClose}
    >
      <div
        className="relative text-center"
        style={{ maxWidth: "480px", padding: "0 24px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-0 right-0 text-[24px] transition-colors"
          style={{
            color: "rgba(255,253,253,0.5)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,253,253,0.9)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,253,253,0.5)")}
          aria-label="Close"
        >
          ×
        </button>

        <h2
          className="lowercase mb-12"
          style={{
            fontSize: "clamp(28px, 5vw, 42px)",
            fontWeight: 400,
            color: "#FFFDFD",
            lineHeight: 1.2,
          }}
        >
          come in
        </h2>

        <div className="flex flex-col gap-4">
          <button
            onClick={handleSignIn}
            className="lowercase transition-all"
            style={{
              padding: "16px 32px",
              fontSize: "15px",
              fontWeight: 300,
              border: "1px solid rgba(255,253,253,0.26)",
              borderRadius: "30px",
              background: "transparent",
              color: "#FFFDFD",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,253,253,0.5)";
              e.currentTarget.style.backgroundColor = "rgba(255,253,253,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,253,253,0.26)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            i have been here
          </button>

          <button
            onClick={handleJoin}
            className="lowercase transition-all"
            style={{
              padding: "16px 32px",
              fontSize: "15px",
              fontWeight: 300,
              border: "1px solid rgba(255,253,253,0.26)",
              borderRadius: "30px",
              background: "transparent",
              color: "#FFFDFD",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,253,253,0.5)";
              e.currentTarget.style.backgroundColor = "rgba(255,253,253,0.05)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,253,253,0.26)";
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            this is my first time
          </button>
        </div>
      </div>
    </div>
  );
}
