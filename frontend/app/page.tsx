"use client";

import { useState } from "react";
import { SessionColorProvider } from "@/contexts/session-color-context";
import { Navigation } from "@/components/phenyx/navigation";
import { HeroSection } from "@/components/phenyx/hero-section";
import { AboutSection } from "@/components/phenyx/manifesto-section";
import { HowItWorksSection } from "@/components/phenyx/how-it-works-section";
import { MissionSection } from "@/components/phenyx/mission-section";
import { PolarisSection } from "@/components/phenyx/polaris-section";
import { CTASection } from "@/components/phenyx/cta-section";
import { FooterSection } from "@/components/phenyx/footer-section";
import { EntryModal } from "@/components/phenyx/entry-modal";
import { CustomCursor } from "@/components/phenyx/custom-cursor";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <SessionColorProvider>
      <CustomCursor />
      <main className="min-h-screen bg-[#080808]">
        <Navigation onEnterClick={() => setIsModalOpen(true)} />

        <HeroSection onEnterClick={() => setIsModalOpen(true)} />

        <AboutSection />

        <HowItWorksSection />

        <MissionSection />

        <PolarisSection />

        <CTASection onEnterClick={() => setIsModalOpen(true)} />

        <FooterSection />
        
        <EntryModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      </main>
    </SessionColorProvider>
  );
}
