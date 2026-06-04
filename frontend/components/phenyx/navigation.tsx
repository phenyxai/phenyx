"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSessionColor } from "@/contexts/session-color-context";

interface NavigationProps {
  onEnterClick: () => void;
}

export function Navigation({ onEnterClick }: NavigationProps) {
  const { sessionColor } = useSessionColor();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isEnterHovered, setIsEnterHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <Image
              src="/phenyx-logo.png"
              alt="PHENYX"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="text-[13px] sm:text-[15px] font-medium tracking-[0.15em] text-[#FFFDFD] whitespace-nowrap">
              PHENYX
            </span>
          </div>

          <div className="max-lg:hidden lg:flex items-center gap-4 sm:gap-6 md:gap-10 lg:gap-14">
            <a
              href="#manifesto"
              className="text-[12px] sm:text-[14px] lowercase text-[#FFFDFD]/80 hover:text-[#FFFDFD] transition-colors font-light tracking-wide whitespace-nowrap"
            >
              about
            </a>
            <a
              href="#mission"
              className="text-[12px] sm:text-[14px] lowercase text-[#FFFDFD]/80 hover:text-[#FFFDFD] transition-colors font-light tracking-wide whitespace-nowrap"
            >
              our mission
            </a>
            <a
              href="#footer"
              className="text-[12px] sm:text-[14px] lowercase text-[#FFFDFD]/80 hover:text-[#FFFDFD] transition-colors font-light tracking-wide whitespace-nowrap"
            >
              stay connected
            </a>
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
              enter
            </button>
          </div>

          <button
            type="button"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((v) => !v)}
            className="max-lg:flex lg:hidden relative w-10 h-10 flex-col items-center justify-center gap-[6px] text-[#FFFDFD]"
          >
            <span
              className={`block h-px w-6 bg-current transition-transform duration-300 ${
                isMenuOpen ? "translate-y-[3.5px] rotate-45" : ""
              }`}
            />
            <span
              className={`block h-px w-6 bg-current transition-transform duration-300 ${
                isMenuOpen ? "-translate-y-[3.5px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </nav>

      <div
        className={`max-lg:block lg:hidden fixed inset-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-[12px] transition-opacity duration-300 ${
          isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeMenu}
      >
        <div
          className="max-lg:flex flex-col items-center justify-center h-full gap-10 px-6"
          onClick={(e) => e.stopPropagation()}
        >
          <a
            href="#manifesto"
            onClick={closeMenu}
            className="text-[22px] lowercase text-[#FFFDFD]/80 hover:text-[#FFFDFD] transition-colors font-light tracking-wide"
          >
            about
          </a>
          <a
            href="#mission"
            onClick={closeMenu}
            className="text-[22px] lowercase text-[#FFFDFD]/80 hover:text-[#FFFDFD] transition-colors font-light tracking-wide"
          >
            our mission
          </a>
          <a
            href="#footer"
            onClick={closeMenu}
            className="text-[22px] lowercase text-[#FFFDFD]/80 hover:text-[#FFFDFD] transition-colors font-light tracking-wide"
          >
            stay connected
          </a>
          <button
            onClick={handleEnter}
            className="mt-4 text-[16px] lowercase px-9 py-3 border rounded-full font-light tracking-wide transition-all"
            style={{
              borderColor: `${sessionColor}CC`,
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
