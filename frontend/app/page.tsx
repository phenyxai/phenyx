"use client";

import { useEffect, useState } from "react";
import { Navigation } from "@/components/phenyx/navigation";
import { HeroSection } from "@/components/phenyx/hero-section";
import { ManifestoSection } from "@/components/phenyx/manifesto-section";
import { HowItWorksSection } from "@/components/phenyx/how-it-works-section";
import { MissionSection } from "@/components/phenyx/mission-section";
import { PolarisSection } from "@/components/phenyx/polaris-section";
import { CtaSection } from "@/components/phenyx/cta-section";
import { FooterSection } from "@/components/phenyx/footer-section";
import { EntryModal } from "@/components/phenyx/entry-modal";
import { CustomCursor } from "@/components/phenyx/custom-cursor";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openEntryModal = () => setIsModalOpen(true);
  const closeEntryModal = () => setIsModalOpen(false);

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

        <ManifestoSection />

        <HowItWorksSection />

        <MissionSection />

        <PolarisSection />

        <CtaSection onEnterClick={openEntryModal} />

        <FooterSection />

        <EntryModal isOpen={isModalOpen} onClose={closeEntryModal} />
      </main>
    </>
  );
}
