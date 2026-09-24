"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/phenyx/navigation";
import { HeroSection } from "@/components/phenyx/hero-section";
import { ManifestoSection } from "@/components/phenyx/manifesto-section";
import { HowItWorksSection } from "@/components/phenyx/how-it-works-section";
import { PromiseSection } from "@/components/phenyx/promise-section";
import { CtaSection } from "@/components/phenyx/cta-section";
import { FooterSection } from "@/components/phenyx/footer-section";
import { EntryModal } from "@/components/phenyx/entry-modal";
import { CustomCursor } from "@/components/phenyx/custom-cursor";
import { ScrollIndicator } from "@/components/phenyx/scroll-indicator";
import { useChapterFocus } from "@/components/phenyx/use-chapter-focus";
import { SECTION_ORDER } from "@/lib/landing-copy";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openEntryModal = () => setIsModalOpen(true);
  const closeEntryModal = () => setIsModalOpen(false);
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
    <>
      <CustomCursor />
      <main className="landing-vnext">
        <Navigation onEnterClick={openEntryModal} />

        <HeroSection onEnterClick={openEntryModal} />
        <ScrollIndicator />

        <ManifestoSection />

        <HowItWorksSection />

        <PromiseSection />

        <CtaSection onEnterClick={openEntryModal} />

        <FooterSection />

        <EntryModal isOpen={isModalOpen} onClose={closeEntryModal} />
      </main>
    </>
  );
}
