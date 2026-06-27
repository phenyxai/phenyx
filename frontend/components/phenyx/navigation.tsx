"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSessionColor } from "@/contexts/session-color-context";

interface NavigationProps {
  onEnterClick: () => void;
}

const NAV_LINKS = [
  { href: "#s0-about", label: "a first look" },
  { href: "#s0-how", label: "how it works" },
  { href: "#s0-mission", label: "your constellation" },
  { href: "#s0-cta", label: "stay connected" },
] as const;

export function Navigation({ onEnterClick }: NavigationProps) {
  const { sessionColor } = useSessionColor();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isEnterHovered, setIsEnterHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState<string | null>(null);

  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement>(null);

  // Scroll-based backdrop blur
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll while the mobile menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  // Mobile menu: Escape to close + basic focus management
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    // Move focus into the menu when it opens
    firstMobileLinkRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the hamburger when the menu closes
      hamburgerRef.current?.focus();
    };
  }, [isMenuOpen]);

  // Scroll-spy: highlight the link whose section is in view (SSR-safe)
  useEffect(() => {
    const sections = NAV_LINKS.map((link) =>
      document.querySelector(link.href)
    ).filter((el): el is Element => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveHref(`#${visible[0].target.id}`);
        }
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const closeMenu = () => setIsMenuOpen(false);

  const handleEnter = () => {
    closeMenu();
    onEnterClick();
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 px-6 sm:px-10 md:px-16 lg:px-28 xl:px-36 py-7 lg:py-8 transition-all duration-300 ${
          isScrolled || isMenuOpen ? "backdrop-blur-[12px] bg-[#0a0a0a]/70" : ""
        }`}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Col 1 — logo (always visible) */}
          <div className="flex items-center gap-3 shrink-0 justify-self-start">
            <Image
              src="/brand/phenyx-mark.png"
              alt="PHENYX"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="text-[13px] sm:text-[15px] font-medium tracking-[0.15em] text-[#FFFDFD] whitespace-nowrap">
              PHENYX
            </span>
          </div>

          {/* Col 2 — centered nav links (desktop only) */}
          <div className="max-lg:hidden flex items-center gap-8 lg:gap-10 justify-self-center">
            {NAV_LINKS.map((link) => {
              const isActive = activeHref === link.href;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-[13px] lowercase transition-colors font-light tracking-wide whitespace-nowrap"
                  style={{
                    color: isActive ? sessionColor : "rgba(255,253,253,0.8)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.color = "#FFFDFD";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.color = "rgba(255,253,253,0.8)";
                  }}
                >
                  {link.label}
                </a>
              );
            })}
          </div>

          {/* Col 3 — enter (desktop) + hamburger (mobile) */}
          <div className="flex items-center justify-end justify-self-end">
            <button
              onClick={onEnterClick}
              onMouseEnter={() => setIsEnterHovered(true)}
              onMouseLeave={() => setIsEnterHovered(false)}
              className="max-lg:hidden text-[13px] lowercase px-[26px] py-[9px] border rounded-full font-light tracking-wide transition-all whitespace-nowrap"
              style={{
                borderColor: isEnterHovered
                  ? sessionColor
                  : "rgba(255,253,253,0.24)",
                backgroundColor: isEnterHovered
                  ? `${sessionColor}1A`
                  : "transparent",
                color: "#FFFDFD",
              }}
            >
              enter
            </button>

            <button
              ref={hamburgerRef}
              type="button"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              onClick={() => setIsMenuOpen((v) => !v)}
              className="lg:hidden relative w-10 h-10 flex flex-col items-center justify-center gap-[5px] text-[#FFFDFD]"
            >
              <span
                className={`block h-px w-6 bg-current transition-transform duration-300 ${
                  isMenuOpen ? "translate-y-[6px] rotate-45" : ""
                }`}
              />
              <span
                className={`block h-px w-6 bg-current transition-opacity duration-300 ${
                  isMenuOpen ? "opacity-0" : "opacity-100"
                }`}
              />
              <span
                className={`block h-px w-6 bg-current transition-transform duration-300 ${
                  isMenuOpen ? "-translate-y-[6px] -rotate-45" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile full-screen overlay menu */}
      <div
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        aria-hidden={!isMenuOpen}
        inert={!isMenuOpen}
        className={`lg:hidden fixed inset-0 z-40 overflow-hidden flex items-center justify-center bg-[#0a0a0a]/95 backdrop-blur-[12px] transition-opacity duration-300 ${
          isMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={closeMenu}
      >
        <div
          className={`flex flex-col items-center gap-2 px-6 transition-transform duration-300 ${
            isMenuOpen ? "translate-y-0" : "-translate-y-3"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {NAV_LINKS.map((link, i) => (
            <a
              key={link.href}
              ref={i === 0 ? firstMobileLinkRef : undefined}
              href={link.href}
              onClick={closeMenu}
              className="flex items-center justify-center min-h-[44px] px-4 text-[22px] lowercase text-[#FFFDFD]/80 hover:text-[#FFFDFD] transition-colors font-light tracking-wide"
            >
              {link.label}
            </a>
          ))}
          <button
            onClick={handleEnter}
            className="mt-6 text-[16px] lowercase px-9 py-3 border rounded-full font-light tracking-wide transition-all"
            style={{
              borderColor: "rgba(255,253,253,0.24)",
              color: "#FFFDFD",
            }}
          >
            enter
          </button>
        </div>
      </div>
    </>
  );
}
