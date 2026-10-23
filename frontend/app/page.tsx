"use client";

import { useRouter } from "next/navigation";
import { Navigation } from "@/components/phenyx/navigation";
import { HeroSection } from "@/components/phenyx/hero-section";
import { ManifestoSection } from "@/components/phenyx/manifesto-section";
import { HowItWorksSection } from "@/components/phenyx/how-it-works-section";
import { PromiseSection } from "@/components/phenyx/promise-section";
import { CtaSection } from "@/components/phenyx/cta-section";
import { FooterSection } from "@/components/phenyx/footer-section";
import { ScrollIndicator } from "@/components/phenyx/scroll-indicator";

/** PHE-144: "enter" goes straight to sign-in with Google, no popup first. */
const ENTER_HREF = "/signin";

export default function Home() {
  const router = useRouter();
  const enter = () => router.push(ENTER_HREF);

  return (
    <>
      <main className="landing-vnext">
        <Navigation onEnterClick={enter} />

        <HeroSection onEnterClick={enter} />
        <ScrollIndicator />

        <ManifestoSection />

        <HowItWorksSection />

        <PromiseSection />

        <CtaSection onEnterClick={enter} />

        <FooterSection />
      </main>
    </>
  );
}
