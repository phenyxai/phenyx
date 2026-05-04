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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-12 lg:px-20 py-5 transition-all duration-300 ${
        isScrolled ? "backdrop-blur-[12px]" : ""
      }`}
      style={{
        backgroundColor: "transparent",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image 
            src="/phenyx-logo.png" 
            alt="PHENYX COLLECTIVE" 
            width={32} 
            height={32}
            className="w-8 h-8"
          />
          <span className="text-sm font-medium tracking-wider">PHENYX COLLECTIVE</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8">
          <a 
            href="#manifesto" 
            className="text-[13px] lowercase text-[#FFFDFD]/80 hover:text-[#FFFDFD] transition-colors font-normal"
          >
            about
          </a>
          <a 
            href="#mission" 
            className="text-[13px] lowercase text-[#FFFDFD]/80 hover:text-[#FFFDFD] transition-colors font-normal"
          >
            our mission
          </a>
          <a 
            href="#footer" 
            className="text-[13px] lowercase text-[#FFFDFD]/80 hover:text-[#FFFDFD] transition-colors font-normal"
          >
            stay connected
          </a>
          <button
            onClick={onEnterClick}
            onMouseEnter={() => setIsEnterHovered(true)}
            onMouseLeave={() => setIsEnterHovered(false)}
            className="text-[13px] lowercase px-4 py-2 border rounded-full font-medium tracking-wide transition-all"
            style={{ 
              borderColor: isEnterHovered ? `${sessionColor}E6` : `${sessionColor}80`,
              backgroundColor: isEnterHovered ? sessionColor : "transparent",
              color: isEnterHovered ? "#0A0A0A" : "#FFFDFD",
            }}
          >
            enter
          </button>
        </div>
      </div>
    </nav>
  );
}
