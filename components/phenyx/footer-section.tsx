"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

export function FooterSection() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error" | "already_following">("idle");
  const [emailError, setEmailError] = useState("");

  const [isFading, setIsFading] = useState(false);

  // Auto-reset after success or already_following with fade
  useEffect(() => {
    if (status === "success" || status === "already_following") {
      const fadeTimer = setTimeout(() => {
        setIsFading(true);
      }, 1500);
      const resetTimer = setTimeout(() => {
        setStatus("idle");
        setIsFading(false);
      }, 2000);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(resetTimer);
      };
    }
  }, [status]);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setEmailError("");
    
    if (!email || !validateEmail(email)) {
      setEmailError("enter a valid email");
      return;
    }

    setStatus("loading");

    try {
      const { error } = await supabase
        .from("newsletter")
        .insert([{ email: email.trim().toLowerCase() }]);

      if (error) {
        // Check if it's a duplicate email error (unique constraint violation)
        if (error.code === "23505" || error.message?.includes("duplicate") || error.message?.includes("unique")) {
          setStatus("already_following");
          setEmail("");
          return;
        }
        throw error;
      }

      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  const isValid = validateEmail(email);

  return (
    <footer id="footer">
      {/* Zone 1 - Main content - 80px padding top */}
      <div 
        className="flex flex-col items-center px-6 md:px-12 lg:px-20"
        style={{ 
          paddingTop: "80px",
          paddingBottom: "80px",
          borderTop: "1px solid rgba(255, 253, 253, 0.08)",
        }}
      >
        {status === "success" ? (
          <p 
            className="text-[18px] font-light lowercase text-center transition-opacity duration-500" 
            style={{ 
              color: "rgba(255,253,253,0.7)",
              opacity: isFading ? 0 : 1,
            }}
          >
            you{"'"}re following the build.
          </p>
        ) : status === "already_following" ? (
          <p 
            className="text-[18px] font-light lowercase text-center transition-opacity duration-500" 
            style={{ 
              color: "rgba(255,253,253,0.7)",
              opacity: isFading ? 0 : 1,
            }}
          >
            you{"'"}re following.
          </p>
        ) : status === "error" ? (
          <div className="text-center">
            <p className="text-[18px] lowercase mb-4" style={{ color: "rgba(255,253,253,0.7)" }}>
              something went wrong. try again.
            </p>
            <button
              onClick={() => setStatus("idle")}
              className="text-[13px] lowercase transition-colors"
              style={{ color: "rgba(255,253,253,0.5)" }}
              onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,253,253,0.8)"}
              onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,253,253,0.5)"}
            >
              try again
            </button>
          </div>
        ) : (
          <>
            <h2 
              className="text-[42px] font-light lowercase text-center mb-2"
              style={{ color: "#FFFDFD" }}
            >
              follow the build.
            </h2>
            <p 
              className="text-[14px] text-center mb-10"
              style={{ color: "rgba(255,253,253,0.65)" }}
            >
              updates from inside the making of PHENYX COLLECTIVE.
            </p>
            
            <form onSubmit={handleSubmit} className="flex items-center gap-3">
              <div className="relative">
                <label htmlFor="footer-email" className="sr-only">Email</label>
                <input
                  id="footer-email"
                  type="email"
                  placeholder="your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  className="w-[180px] sm:w-[220px] bg-transparent border-b py-2 text-sm focus:outline-none transition-colors"
                  style={{ 
                    borderColor: emailError ? "#E8451E" : "rgba(255,253,253,0.2)",
                    color: "#FFFDFD",
                  }}
                  onFocus={(e) => !emailError && (e.target.style.borderColor = "rgba(255,253,253,0.5)")}
                  onBlur={(e) => !emailError && (e.target.style.borderColor = "rgba(255,253,253,0.2)")}
                />
                {emailError && (
                  <p className="absolute text-[12px] lowercase mt-1" style={{ color: "rgba(255,253,253,0.65)" }}>
                    {emailError}
                  </p>
                )}
              </div>
              
              <button
                type="submit"
                disabled={!isValid || status === "loading"}
                className="px-6 py-2 rounded-full text-[13px] lowercase font-medium tracking-wide transition-all disabled:cursor-not-allowed"
                style={{ 
                  border: "1px solid rgba(255,253,253,0.4)",
                  backgroundColor: "transparent",
                  color: "#FFFDFD",
                  opacity: status === "loading" ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!e.currentTarget.disabled) {
                    e.currentTarget.style.borderColor = "rgba(255,253,253,0.9)";
                    e.currentTarget.style.backgroundColor = "#FFFDFD";
                    e.currentTarget.style.color = "#0D0D0C";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,253,253,0.4)";
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#FFFDFD";
                }}
              >
                {status === "loading" ? "..." : "i'm in"}
              </button>
            </form>
          </>
        )}
      </div>
      
      {/* Zone 2 - Bottom bar - vertical on mobile, horizontal on desktop */}
      <div 
        className="relative flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0 px-6 md:px-12 lg:px-20"
        style={{ 
          borderTop: "1px solid rgba(255, 253, 253, 0.06)",
          paddingTop: "24px",
          paddingBottom: "24px",
        }}
      >
        {/* Logo - absolutely positioned left on desktop */}
        <div className="md:absolute md:left-6 lg:left-20 flex-shrink-0 order-first md:order-none">
          <Image 
            src="/phenyx-logo.png" 
            alt="PHENYX" 
            width={20} 
            height={20}
            className="w-5 h-5 opacity-40"
          />
        </div>
        
        {/* Copyright - truly centered */}
        <p 
          className="uppercase text-center order-2 md:order-none"
          style={{ 
            fontSize: "11px",
            letterSpacing: "0.1em",
            color: "rgba(255,253,253,0.6)",
          }}
        >
          © 2026 PHENYX COLLECTIVE
        </p>
        
        {/* Contact email - absolutely positioned right on desktop */}
        <a 
          href="mailto:contact@phenyxcollective.com"
          className="md:absolute md:right-6 lg:right-20 text-[11px] lowercase transition-colors flex-shrink-0 order-1 md:order-none"
          style={{ color: "rgba(255,253,253,0.6)" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "rgba(255,253,253,0.9)"}
          onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,253,253,0.6)"}
        >
          contact@phenyxcollective.com
        </a>
      </div>
    </footer>
  );
}
