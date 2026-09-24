"use client";

import { useEffect, useState } from "react";
import { SessionColorProvider } from "@/contexts/session-color-context";
import { Navigation } from "@/components/phenyx/navigation";
import { HeroSection } from "@/components/phenyx/hero-section";
import { ManifestoSection } from "@/components/phenyx/manifesto-section";
import { HowItWorksSection } from "@/components/phenyx/how-it-works-section";
import { PromiseSection } from "@/components/phenyx/promise-section";
import { CtaSection } from "@/components/phenyx/cta-section";
import { FooterSection } from "@/components/phenyx/footer-section";
import { WaitlistModal } from "@/components/phenyx/waitlist-modal";
import { CustomCursor } from "@/components/phenyx/custom-cursor";
import { ScrollIndicator } from "@/components/phenyx/scroll-indicator";
import { useChapterFocus } from "@/components/phenyx/use-chapter-focus";
import { SECTION_ORDER } from "@/lib/landing-copy";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openWaitlist = () => setIsModalOpen(true);
  const closeWaitlist = () => setIsModalOpen(false);
  useChapterFocus(SECTION_ORDER);

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      targets.forEach((target) => target.setAttribute("data-visible", "true"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute("data-visible", "true");
        observer.unobserve(entry.target);
      }),
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <SessionColorProvider>
      <CustomCursor />
      <main className="landing-vnext">
        <Navigation onEnterClick={openWaitlist} />

        <HeroSection onEnterClick={openWaitlist} />
        <ScrollIndicator />

        <ManifestoSection />

        <HowItWorksSection />

        <PromiseSection />

        <CtaSection onEnterClick={openWaitlist} />

        <FooterSection />

        <WaitlistModal isOpen={isModalOpen} onClose={closeWaitlist} />
      </main>
    </SessionColorProvider>
  );
}
