import type { Metadata } from "next";
import { Suspense } from "react";

import { IntroBanner } from "@/components/phenyx/intro-banner";
import { PolarisTab } from "@/components/phenyx/polaris-tab";

export const metadata: Metadata = {
  title: "Polaris",
};

/** Polaris tab (PHE-73, modes from PHE-123, PHE-129). Home + conversation live
 * in the client `PolarisTab`. Deep-link `?q=&mode=&context=` is consumed inside
 * it. The panel is a definite-height flex column (never display:block) that
 * scrolls inside itself, so the composer stays pinned to its foot in chat. On
 * phones the height leaves out the top bar and the bottom nav. */
export default function PolarisTabPage() {
  return (
    <section
      className="flex h-screen flex-col [@media(max-width:760px)]:h-[calc(100svh-124px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))]"
      style={{ display: "flex" }}
    >
      <IntroBanner
        tab="polaris"
        copy="polaris answers what you ask, using only what your constellation has already shown."
        className="mx-6 mt-6 shrink-0"
      />
      <div
        className="min-h-0 flex-1"
        style={{ display: "flex", flexDirection: "column" }}
      >
        <Suspense fallback={null}>
          <PolarisTab />
        </Suspense>
      </div>
    </section>
  );
}
