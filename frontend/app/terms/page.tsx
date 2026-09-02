import type { Metadata } from "next";
import { LegalDocument, LegalMail } from "@/components/phenyx/legal-document";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for PHENYX INC.",
};

export default function TermsOfServicePage() {
  return (
    <LegalDocument title="Terms of Service" current="terms">
      <p className="legal-doc__lead">
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of the website, applications, and services provided by PHENYX INC. (&quot;PHENYX,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By creating an account or using the Platform, you agree to these Terms. If you do not agree, do not use the Platform.
      </p>
      <p>
        PHENYX INC. was formerly known as PHENYX COLLECTIVE, INC. References to the prior name in earlier agreements refer to the same company.
      </p>

      <h2>Eligibility</h2>
      <p>
        You must be at least 18 years old to use the Platform. By using the Platform, you represent and warrant that you are 18 or older and that you have the legal capacity to enter into these Terms.
      </p>

      <h2>Your Account</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials, including your passphrase, and for all activity that occurs under your account. You agree to provide accurate information when creating your account and to keep it current. Notify us at <LegalMail /> if you believe your account has been compromised.
      </p>

      <h2>The Service</h2>
      <p>
        PHENYX is an identity platform that reads behavioral signals from the accounts you choose to connect, synthesizes them into a personal constellation of observations, and lets you explore them, including through Polaris, our AI feature. Observations are generated from your authorized data and are provided for personal reflection. They are not professional, medical, psychological, legal, or financial advice, and should not be relied on as such.
      </p>

      <h2>Connecting Accounts</h2>
      <p>
        Connecting third-party accounts is optional and is done through OAuth authorization, facilitated by Onairos. You may disconnect any connected platform at any time from your profile. Your use of third-party platforms remains governed by those platforms&apos; own terms and policies, and you are responsible for complying with them. How we handle data from connected accounts is described in our Privacy Policy.
      </p>

      <h2>Acceptable Use</h2>
      <p>
        You agree not to: use the Platform in violation of any law; attempt to access another user&apos;s account or data; reverse-engineer, scrape, or interfere with the Platform or its infrastructure; upload malicious code; misrepresent your identity or impersonate others; or use the Platform to harass, abuse, or harm anyone. We may suspend or terminate accounts that violate these Terms.
      </p>

      <h2>Your Content</h2>
      <p>
        You retain ownership of the content you create or submit on the Platform, including reflections and profile content. By submitting content, you grant PHENYX a limited, non-exclusive license to store, process, and display that content solely to operate and provide the Platform to you. Observations and other outputs generated for you from your authorized data belong to you, and you may export or delete them, as described in our Privacy Policy.
      </p>

      <h2>Intellectual Property</h2>
      <p>
        The Platform, including its software, design, constellation framework, Polaris, and all associated trademarks and content that we provide, is owned by PHENYX and protected by intellectual property laws. These Terms do not grant you any right to our trademarks or to copy, modify, or create derivative works from the Platform, except as expressly permitted.
      </p>

      <h2>Fees and Subscriptions</h2>
      <p>
        Some features of the Platform are offered on a paid basis. Pricing and billing terms are presented at the point of purchase. Paid subscriptions renew automatically unless cancelled before the renewal date. Payments are processed by our payment provider; we do not store full payment card details. Except where required by law, fees are non-refundable.
      </p>

      <h2>Beta and Changes to the Service</h2>
      <p>
        The Platform, or features within it, may be offered on a pre-release or beta basis and may change, be interrupted, or be discontinued at any time. We may add, modify, or remove features without notice. We are not liable for any modification, suspension, or discontinuation of the Platform or any feature.
      </p>

      <h2>Disclaimers</h2>
      <p>
        The Platform is provided &quot;as is&quot; and &quot;as available,&quot; without warranties of any kind, whether express or implied, including warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that the Platform will be uninterrupted, error-free, or secure, or that observations generated will be accurate or complete.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, PHENYX and its officers, directors, employees, and agents will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for any loss of data, profits, or goodwill, arising from your use of the Platform. Our total liability for any claim arising out of these Terms or the Platform will not exceed the greater of the amount you paid us in the twelve months before the claim or one hundred U.S. dollars.
      </p>

      <h2>Indemnification</h2>
      <p>
        You agree to indemnify and hold harmless PHENYX from any claims, damages, liabilities, and expenses arising from your use of the Platform, your content, or your violation of these Terms or of any law or third-party right.
      </p>

      <h2>Termination</h2>
      <p>
        You may stop using the Platform and delete your account at any time. We may suspend or terminate your access if you violate these Terms or if we discontinue the Platform. Provisions that by their nature should survive termination, including ownership, disclaimers, limitation of liability, and indemnification, will survive.
      </p>

      <h2>Governing Law and Disputes</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, without regard to its conflict-of-laws rules. Any dispute arising out of or relating to these Terms or the Platform will be resolved in the state or federal courts located in Delaware, and you consent to their jurisdiction, except where applicable law grants you the right to bring a claim in your local jurisdiction.
      </p>

      <h2>Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be communicated via a prominent notice on the Platform or by direct notification. The &quot;Last Updated&quot; date reflects the most recent revision. Continued use of the Platform after an update constitutes your acceptance of the revised Terms.
      </p>

      <h2>Contact Us</h2>
      <p className="legal-doc__contact">
        PHENYX INC.<br />
        Email: <LegalMail /><br />
        Website: <a href="https://phenyxai.com">phenyxai.com</a>
      </p>
    </LegalDocument>
  );
}
