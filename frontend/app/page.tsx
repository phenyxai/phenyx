"use client";

import { useState } from "react";
import { Navigation } from "@/components/phenyx/navigation";
import { HeroSection } from "@/components/phenyx/hero-section";
import { ManifestoSection } from "@/components/phenyx/manifesto-section";
import { HowItWorksSection } from "@/components/phenyx/how-it-works-section";
import { MissionSection } from "@/components/phenyx/mission-section";
import { CtaSection } from "@/components/phenyx/cta-section";
import { FooterSection } from "@/components/phenyx/footer-section";
import { EntryModal } from "@/components/phenyx/entry-modal";

export default function Home() {
  // Page-level modal state is the single source of truth: every `enter` source
  // (hero, nav, CTA, mobile dropdown) shares the one `openEntryModal` handler so
  // exactly one Entry Choice Modal (PHE-8) is ever mounted.
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openEntryModal = () => setIsModalOpen(true);
  const closeEntryModal = () => setIsModalOpen(false);

  return (
    <>
      <main className="landing-v66">
        <Navigation onEnterClick={openEntryModal} />

        <HeroSection onEnterClick={openEntryModal} />

        <ManifestoSection />

        <HowItWorksSection />

        <MissionSection />

        <CtaSection onEnterClick={openEntryModal} />

        <FooterSection />

        <EntryModal isOpen={isModalOpen} onClose={closeEntryModal} />
      </main>
    </>
  );
}
