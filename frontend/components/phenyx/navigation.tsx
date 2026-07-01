"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSessionColor } from "@/contexts/session-color-context";
import { navCopy } from "@/lib/landing-copy";

interface NavigationProps {
  onEnterClick: () => void;
}

export function Navigation({ onEnterClick }: NavigationProps) {
  const { sessionColor } = useSessionColor();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isEnterHovered, setIsEnterHovered] = useState(false);
  // ≤780px swaps the desktop link row for a hamburger dropdown.
  const [isMobile, setIsMobile] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 780px)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      if (!e.matches) setIsDropdownOpen(false);
    };
    handleChange(mobileQuery);
    mobileQuery.addEventListener("change", handleChange);
    return () => mobileQuery.removeEventListener("change", handleChange);
  }, []);

  // Smooth-scroll to a section anchor without a route change (no router.push).
  // Works post-hydration even if a section canvas is still loading.
  const scrollToSection = (targetId: string) => {
    const el = document.getElementById(targetId);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string
  ) => {
    e.preventDefault();
    scrollToSection(targetId);
    setIsDropdownOpen(false);
  };

  const handleDropdownEnter = () => {
    setIsDropdownOpen(false);
    onEnterClick();
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 px-6 sm:px-10 md:px-16 lg:px-28 xl:px-36 py-7 lg:py-8 transition-all duration-300 ${
        isScrolled || isDropdownOpen ? "backdrop-blur-[12px] bg-[#0a0a0a]/70" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <Image
            src="/phenyx-logo.png"
            alt={navCopy.logoAlt}
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="text-[13px] sm:text-[15px] font-medium tracking-[0.15em] text-[#FFFDFD] whitespace-nowrap">
            {navCopy.brand}
          </span>
        </div>

        {/* Desktop link row (>780px) */}
        {!isMobile && (
          <div className="flex items-center gap-4 sm:gap-6 md:gap-10 lg:gap-14">
            {navCopy.links.map((link) => (
              <a
                key={link.targetId}
                href={`#${link.targetId}`}
                onClick={(e) => handleLinkClick(e, link.targetId)}
                className="text-[12px] sm:text-[14px] lowercase text-[#FFFDFD]/80 hover:text-[#FFFDFD] transition-colors font-light tracking-wide whitespace-nowrap"
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={onEnterClick}
              onMouseEnter={() => setIsEnterHovered(true)}
              onMouseLeave={() => setIsEnterHovered(false)}
              className="text-[12px] sm:text-[14px] lowercase px-5 sm:px-7 py-2 sm:py-2.5 border rounded-full font-light tracking-wide transition-all whitespace-nowrap"
              style={{
                borderColor: isEnterHovered ? sessionColor : `${sessionColor}CC`,
                backgroundColor: isEnterHovered ? sessionColor : "transparent",
                color: isEnterHovered ? "#0A0A0A" : "#FFFDFD",
              }}
            >
              {navCopy.enter}
            </button>
          </div>
        )}

        {/* Mobile hamburger (≤780px) */}
        {isMobile && (
          <button
            onClick={() => setIsDropdownOpen((open) => !open)}
            className="flex flex-col items-center justify-center gap-[5px] p-2"
            aria-label="toggle menu"
            aria-expanded={isDropdownOpen}
          >
            <span
              className="block w-5 h-px transition-all duration-300"
              style={{
                backgroundColor: "#FFFDFD",
                transform: isDropdownOpen ? "translateY(3px) rotate(45deg)" : "none",
              }}
            />
            <span
              className="block w-5 h-px transition-all duration-300"
              style={{
                backgroundColor: "#FFFDFD",
                transform: isDropdownOpen ? "translateY(-3px) rotate(-45deg)" : "none",
              }}
            />
          </button>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {isMobile && isDropdownOpen && (
        <div
          id="landingNavDropdown"
          className="flex flex-col gap-5 pt-7"
        >
          {navCopy.links.map((link) => (
            <a
              key={link.targetId}
              href={`#${link.targetId}`}
              onClick={(e) => handleLinkClick(e, link.targetId)}
              className="text-[15px] lowercase text-[#FFFDFD]/80 hover:text-[#FFFDFD] transition-colors font-light tracking-wide"
            >
              {link.label}
            </a>
          ))}
          <button
            onClick={handleDropdownEnter}
            className="self-start text-[15px] lowercase px-7 py-2.5 border rounded-full font-light tracking-wide transition-all"
            style={{
              borderColor: `${sessionColor}CC`,
              color: "#FFFDFD",
            }}
          >
            {navCopy.enter}
          </button>
        </div>
      )}
    </nav>
  );
}
