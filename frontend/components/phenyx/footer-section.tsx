import { footerCopy } from "@/lib/landing-copy";

export function FooterSection() {
  return (
    <footer className="landing-vnext__footer">
      <div className="landing-vnext__footer-left">
        <div className="landing-vnext__footer-brand">
          <span className="landing-vnext__footer-dot" aria-hidden="true" />
          <span className="landing-vnext__footer-word">{footerCopy.brand}</span>
        </div>
      </div>
      <div className="landing-vnext__footer-links">
        <a href={`mailto:${footerCopy.contactEmail}`}>{footerCopy.contactEmail}</a>
      </div>
      <span className="landing-vnext__footer-meta">{footerCopy.copyright}</span>
    </footer>
  );
}
