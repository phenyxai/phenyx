import Link from "next/link";
import { footerCopy } from "@/lib/landing-copy";

export function FooterSection() {
  return (
    <footer className="landing-vnext__footer">
      <span className="landing-vnext__footer-brand">
        <span className="landing-vnext__brand-dot landing-vnext__footer-dot" aria-hidden="true" />
        <span className="landing-vnext__footer-word">{footerCopy.brand}</span>
      </span>
      <div className="landing-vnext__footer-links">
        <a href={`mailto:${footerCopy.contactEmail}`}>{footerCopy.contactEmail}</a>
        <Link href={footerCopy.privacyHref}>{footerCopy.privacyLabel}</Link>
        <Link href={footerCopy.termsHref}>{footerCopy.termsLabel}</Link>
      </div>
      <span className="landing-vnext__footer-meta">{footerCopy.copyright}</span>
    </footer>
  );
}
