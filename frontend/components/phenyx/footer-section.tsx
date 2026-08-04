import { footerCopy, SECTION_IDS } from "@/lib/landing-copy";

export function FooterSection() {
  return (
    <footer id={SECTION_IDS.footer} className="landing-v66__footer">
      <span className="landing-v66__footer-dot" aria-hidden="true" />
      <span>{footerCopy.copyright}</span>
      <a href={`mailto:${footerCopy.contactEmail}`}>{footerCopy.contactEmail}</a>
    </footer>
  );
}
