import { Suspense } from "react";

import { IntroBanner } from "@/components/phenyx/intro-banner";
import { PolarisTab } from "@/components/phenyx/polaris-tab";

/** Polaris tab (PHE-73). Idle + chat live in the client `PolarisTab`.
 * Deep-link `?q=&pillar=` is consumed inside that client tab (Daily explore).
 * The panel is a definite-height flex column (never display:block) so the
 * composer stays pinned to the foot in chat. */
export default function PolarisTabPage() {
  return (
    <section
      className="flex h-screen flex-col"
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
