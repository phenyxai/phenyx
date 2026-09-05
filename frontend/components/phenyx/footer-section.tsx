import Link from "next/link";
import { footerCopy } from "@/lib/landing-copy";

export function FooterSection() {
  return (
    <footer className="landing-vnext__footer">
      <div className="landing-vnext__footer-left">
        <span className="landing-vnext__footer-dot" aria-hidden="true" />
        <div className="landing-vnext__footer-links">
        <Link href={footerCopy.privacyHref}>{footerCopy.privacyLabel}</Link>
        <Link href={footerCopy.termsHref}>{footerCopy.termsLabel}</Link>
        <a href={`mailto:${footerCopy.contactEmail}`}>{footerCopy.contactEmail}</a>
        </div>
      </div>
      <span className="landing-vnext__footer-meta">{footerCopy.copyright}</span>
    </footer>
  );
}
