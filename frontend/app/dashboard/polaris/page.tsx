import { IntroBanner } from "@/components/phenyx/intro-banner";
import { PolarisTab } from "@/components/phenyx/polaris-tab";

/** Polaris tab (PHE-23). The first-visit intro banner sits above the chat
 * surface; the surface itself (main view + chat view) lives in the client
 * `PolarisTab` component. */
export default function PolarisTabPage() {
  return (
    <section className="flex h-screen flex-col">
      {/*
        PHE-33 first-visit intro banner. Copy passed as a literal (kept verbatim
        in sync with INTRO_COPY.polaris) so this stays a server component — the
        INTRO_COPY map lives behind a "use client" boundary and can't be read
        server-side.
      */}
      <IntroBanner
        tab="polaris"
        copy="polaris answers what you ask, using only what your constellation has already shown."
        className="mx-6 mt-6 shrink-0"
      />
      <div className="min-h-0 flex-1">
        <PolarisTab />
      </div>
    </section>
  );
}
