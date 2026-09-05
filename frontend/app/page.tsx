"use client";

import { SessionColorProvider } from "@/contexts/session-color-context";
import { LandingV110 } from "@/components/phenyx/landing-v110";
import "@/styles/v110-landing.css";

export default function Home() {
  return (
    <SessionColorProvider>
      <LandingV110 />
    </SessionColorProvider>
  );
}
