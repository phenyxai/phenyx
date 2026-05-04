"use client";

import { useState } from "react";
import { SessionColorProvider } from "@/contexts/session-color-context";
import { Navigation } from "@/components/phenyx/navigation";
import { HeroSection } from "@/components/phenyx/hero-section";
import { ManifestoSection } from "@/components/phenyx/manifesto-section";
import { HowItWorksSection } from "@/components/phenyx/how-it-works-section";
import { ProductPreviewSection } from "@/components/phenyx/product-preview-section";
import { MissionSection } from "@/components/phenyx/mission-section";
import { FooterSection } from "@/components/phenyx/footer-section";
import { WaitlistModal } from "@/components/phenyx/waitlist-modal";
import { CustomCursor } from "@/components/phenyx/custom-cursor";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <SessionColorProvider>
      <CustomCursor />
      <main className="min-h-screen bg-[#0a0a0a]">
        <Navigation onEnterClick={() => setIsModalOpen(true)} />
        
        <HeroSection onEnterClick={() => setIsModalOpen(true)} />
        
        <ManifestoSection />
        
        <HowItWorksSection />
        
        <MissionSection />
        
        <ProductPreviewSection />
        
        <FooterSection />
        
        <WaitlistModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      </main>
    </SessionColorProvider>
  );
}
