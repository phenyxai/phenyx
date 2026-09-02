import Link from "next/link";
import { footerCopy, SECTION_IDS } from "@/lib/landing-copy";

export function FooterSection() {
  return (
    <footer id={SECTION_IDS.footer} className="s0-footer">
      <div className="s0-footer__links">
        <Link href={footerCopy.privacyHref}>{footerCopy.privacyLabel}</Link>
        <Link href={footerCopy.termsHref}>{footerCopy.termsLabel}</Link>
        <a href={`mailto:${footerCopy.contactEmail}`}>{footerCopy.contactEmail}</a>
      </div>
      <span className="s0-footer__meta">
        <span className="s0-footer__dot" aria-hidden="true" />
        {footerCopy.copyright}
      </span>
    </footer>
  );
}
