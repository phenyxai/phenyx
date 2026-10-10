"use client";

import { useState } from "react";
import { Navigation } from "@/components/phenyx/navigation";
import { HeroSection } from "@/components/phenyx/hero-section";
import { ManifestoSection } from "@/components/phenyx/manifesto-section";
import { HowItWorksSection } from "@/components/phenyx/how-it-works-section";
import { PromiseSection } from "@/components/phenyx/promise-section";
import { CtaSection } from "@/components/phenyx/cta-section";
import { FooterSection } from "@/components/phenyx/footer-section";
import { EntryModal } from "@/components/phenyx/entry-modal";
import { ScrollIndicator } from "@/components/phenyx/scroll-indicator";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openEntryModal = () => setIsModalOpen(true);
  const closeEntryModal = () => setIsModalOpen(false);

  return (
    <>
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
