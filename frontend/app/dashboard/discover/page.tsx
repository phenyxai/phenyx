import { PanelHeader } from "@/components/phenyx/panel-header";

/**
 * PLACEHOLDER for the discover issue (spec doc 3). PHE-96 adds the discover tab
 * in its nav slot and this quiet stand-in so the link resolves; the discover
 * issue replaces this file with the real carousel. No fake discoveries here.
 */
export default function DiscoverTabPage() {
  return (
    <section className="flex flex-col px-10 pt-8 pb-10">
      <div className="w-full max-w-[820px]">
        <PanelHeader
          eyebrow="discover"
          title="what could be next?"
          sub="discoveries will appear here as PHENYX finds connections across your platforms."
        />
      </div>
    </section>
  );
}
