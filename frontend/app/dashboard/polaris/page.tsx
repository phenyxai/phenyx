import { IntroBanner } from "@/components/phenyx/intro-banner";

/** Placeholder — the Polaris tab is built out in lane 05 (05-polaris.md). */
export default function PolarisTabPage() {
  return (
    <section className="p-10">
      {/*
        PHE-33 first-visit intro banner. Copy passed as a literal (kept verbatim
        in sync with INTRO_COPY.polaris) so this stays a server component — the
        INTRO_COPY map lives behind a "use client" boundary and can't be read
        server-side. The rest of the page is untouched for the lane-05 rebuild.
      */}
      <IntroBanner
        tab="polaris"
        copy="polaris answers what you ask, using only what your constellation has already shown."
        className="mb-6"
      />
      <div className="text-[14px] font-light lowercase text-[#FFFDFD]/40">polaris</div>
    </section>
  );
}
