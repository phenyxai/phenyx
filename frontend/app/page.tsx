"use client";

import { useState } from "react";
import { SessionColorProvider } from "@/contexts/session-color-context";
import { Navigation } from "@/components/phenyx/navigation";
import { HeroSection } from "@/components/phenyx/hero-section";
import { ManifestoSection } from "@/components/phenyx/manifesto-section";
import { HowItWorksSection } from "@/components/phenyx/how-it-works-section";
import { PromiseSection } from "@/components/phenyx/promise-section";
import { CtaSection } from "@/components/phenyx/cta-section";
import { FooterSection } from "@/components/phenyx/footer-section";
import { WaitlistModal } from "@/components/phenyx/waitlist-modal";
import { ScrollIndicator } from "@/components/phenyx/scroll-indicator";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openWaitlist = () => setIsModalOpen(true);
  const closeWaitlist = () => setIsModalOpen(false);

  return (
    <SessionColorProvider>
      <main className="landing-vnext">
        <Navigation onEnterClick={openWaitlist} />

        <HeroSection onEnterClick={openWaitlist} />
        <ScrollIndicator isHidden={isModalOpen} />

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
