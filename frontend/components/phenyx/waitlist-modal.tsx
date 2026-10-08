"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useSessionColor } from "@/contexts/session-color-context";

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const { sessionColor } = useSessionColor();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // UI state — a new signup and an email that is already on the list land on
  // the same confirmation.
  const [status, setStatus] = useState<"idle" | "loading" | "joined" | "error">("idle");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isFading, setIsFading] = useState(false);

  // Auto-close after joining with fade
  useEffect(() => {
    if (status === "joined") {
      const fadeTimer = setTimeout(() => {
        setIsFading(true);
      }, 1500);
      const closeTimer = setTimeout(() => {
        resetAndClose();
        setIsFading(false);
      }, 2000);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(closeTimer);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!isOpen) return null;

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validate = () => {
    let valid = true;
    setNameError("");
    setEmailError("");

    if (!name || name.trim().length < 2) {
      setNameError("we'd love to know your name.");
      valid = false;
    }

    if (!email || !validateEmail(email)) {
      setEmailError("that does not look right.");
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setStatus("loading");

    try {
      const { error } = await supabase
        .from("waitlist")
        .insert([{ name: name.trim(), email: email.trim().toLowerCase() }]);

      // A duplicate email (unique constraint violation) is already on the list.
      if (error && !(error.code === "23505" || error.message?.includes("duplicate") || error.message?.includes("unique"))) {
        throw error;
      }

      setStatus("joined");
    } catch (err) {
      console.error("Waitlist signup failed:", err);
      setStatus("error");
    }
  };

  const resetAndClose = () => {
    setName("");
    setEmail("");
    setStatus("idle");
    setNameError("");
    setEmailError("");
    onClose();
  };

  const isValid = name.trim().length >= 2 && validateEmail(email);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={resetAndClose}
    >
      <div className="absolute inset-0 bg-[#0A0A0A]/80 backdrop-blur-sm" />

      <div
        className="relative p-8 md:p-12 max-w-md w-full transition-opacity duration-500"
        style={{
          backgroundColor: "#0A0A0A",
          border: "1px solid rgba(255,253,253,0.08)",
          opacity: isFading ? 0 : 1,
          // The global input focus ring reads --color-stellar; tint it to the
          // brand color here instead of the default blue.
          "--color-stellar": sessionColor,
        } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={resetAndClose}
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

        {status === "joined" ? (
          <div
            className="text-center py-8"
            style={{ animation: "fadeIn 400ms ease-out" }}
          >
            <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
            <p className="text-xl lowercase mb-2">you{"'"}re on the list.</p>
          </div>
        ) : status === "error" ? (
          <div className="text-center py-8">
            <p className="text-xl lowercase mb-4">something went wrong. try again.</p>
            <button
              onClick={() => setStatus("idle")}
              className="text-[13px] lowercase px-6 py-2 rounded-full transition-all"
              style={{ border: "1px solid rgba(255,253,253,0.4)" }}
            >
              try again
            </button>
          </div>
        ) : (
          <div style={{ animation: "fadeIn 400ms ease-out" }}>
            <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
            <h2 className="text-2xl font-semibold mb-2 uppercase">PHENYX</h2>
            <p className="text-xs font-light lowercase mb-8" style={{ color: "rgba(255,253,253,0.6)" }}>
              we{"'"}re not live yet. be among the first.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="modal-name" className="block text-xs lowercase mb-2" style={{ color: "rgba(255,253,253,0.6)" }}>
                  name
                </label>
                <input
                  id="modal-name"
                  type="text"
                  autoComplete="name"
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameError("");
                  }}
                  className="w-full bg-transparent border-b py-2 text-[#FFFDFD] focus:outline-none transition-colors"
                  style={{ borderColor: nameError ? "#E8451E" : "rgba(255,253,253,0.3)" }}
                  onFocus={(e) => !nameError && (e.target.style.borderColor = "rgba(255,253,253,0.6)")}
                  onBlur={(e) => !nameError && (e.target.style.borderColor = "rgba(255,253,253,0.3)")}
                />
                {nameError && (
                  <p className="text-[11px] lowercase mt-1" style={{ color: "#E8451E" }}>
                    {nameError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="modal-email" className="block text-xs lowercase mb-2" style={{ color: "rgba(255,253,253,0.6)" }}>
                  email
                </label>
                <input
                  id="modal-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  className="w-full bg-transparent border-b py-2 text-[#FFFDFD] focus:outline-none transition-colors"
                  style={{ borderColor: emailError ? "#E8451E" : "rgba(255,253,253,0.3)" }}
                  onFocus={(e) => !emailError && (e.target.style.borderColor = "rgba(255,253,253,0.6)")}
                  onBlur={(e) => !emailError && (e.target.style.borderColor = "rgba(255,253,253,0.3)")}
                />
                {emailError && (
                  <p className="text-[11px] lowercase mt-1" style={{ color: "#E8451E" }}>
                    {emailError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={!isValid || status === "loading"}
                className="w-full px-6 py-3 rounded-full text-[13px] lowercase font-medium tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  border: `1px solid ${sessionColor}80`,
                  backgroundColor: "transparent",
                  color: "#FFFDFD",
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.backgroundColor = sessionColor;
                    e.currentTarget.style.color = "#0A0A0A";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#FFFDFD";
                }}
              >
                {status === "loading" ? "..." : "enter"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
