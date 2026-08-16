import Link from "next/link";
import type { ReactNode } from "react";

type CurrentPage = "privacy" | "terms";

export function LegalDocument({
  title,
  current,
  children,
}: {
  title: string;
  current: CurrentPage;
  children: ReactNode;
}) {
  return (
    <div className="legal-doc">
      <nav className="legal-doc__nav">
        <Link className="legal-doc__brand" href="/">
          <span className="legal-doc__dot" aria-hidden="true" />
          PHENYX
        </Link>
        <Link className="legal-doc__back" href="/">
          ← back to phenyx
        </Link>
      </nav>
      <main className="legal-doc__wrap">
        <p className="legal-doc__eyebrow">legal</p>
        <h1>{title}</h1>
        <p className="legal-doc__updated">Last Updated: April 29, 2026</p>
        <p className="legal-doc__company">PHENYX INC.</p>
        {children}
      </main>
      <footer className="legal-doc__foot">
        <div className="legal-doc__foot-inner">
          <div className="legal-doc__foot-links">
            <Link
              href="/privacy-policy"
              aria-current={current === "privacy" ? "page" : undefined}
            >
              privacy
            </Link>
            <Link href="/terms" aria-current={current === "terms" ? "page" : undefined}>
              terms
            </Link>
            <a href="mailto:contact@phenyxai.com">contact@phenyxai.com</a>
          </div>
          <span className="legal-doc__copy">© 2026 PHENYX INC.</span>
        </div>
      </footer>
    </div>
  );
}

export function LegalMail({ children = "contact@phenyxai.com" }: { children?: string }) {
  return <a href="mailto:contact@phenyxai.com">{children}</a>;
}
