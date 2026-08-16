import Link from "next/link";
import { footerCopy, SECTION_IDS } from "@/lib/landing-copy";

export function FooterSection() {
  return (
    <footer id={SECTION_IDS.footer} className="landing-v66__footer">
      <div className="landing-v66__footer-links">
        <Link href={footerCopy.privacyHref}>{footerCopy.privacyLabel}</Link>
        <Link href={footerCopy.termsHref}>{footerCopy.termsLabel}</Link>
        <a href={`mailto:${footerCopy.contactEmail}`}>{footerCopy.contactEmail}</a>
      </div>
      <span className="landing-v66__footer-meta">
        <span className="landing-v66__footer-dot" aria-hidden="true" />
        {footerCopy.copyright}
      </span>
    </footer>
  );
}
