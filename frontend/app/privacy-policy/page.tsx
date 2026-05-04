import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DM_Sans, DM_Serif_Display } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-dm-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Privacy Policy — PHENYX COLLECTIVE",
  description: "Privacy Policy for PHENYX COLLECTIVE",
};

interface PolicySectionProps {
  title: string;
  children: React.ReactNode;
}

function PolicySection({ title, children }: PolicySectionProps) {
  return (
    <section className="mb-12">
      <h2
        className="uppercase text-xs tracking-[0.2em] mb-4"
        style={{
          fontFamily: dmSans.style.fontFamily,
          color: "rgba(255,253,253,0.6)",
          fontWeight: 500,
        }}
      >
        {title}
      </h2>
      <div
        className="text-base leading-[1.8]"
        style={{
          fontFamily: dmSans.style.fontFamily,
          color: "rgba(255,253,253,0.85)",
          fontWeight: 300,
        }}
      >
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div
      className={`min-h-screen ${dmSans.variable} ${dmSerifDisplay.variable}`}
      style={{ backgroundColor: "#0a0a0a" }}
    >
      {/* Header */}
      <header className="px-6 md:px-20 py-8 border-b border-white/10">
        <a
          href="https://phenyxcollective.com"
          className="inline-flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/phenyx-logo.png"
            width={32}
            height={32}
            alt="PHENYX COLLECTIVE"
          />
          <span
            className="uppercase text-sm tracking-[0.15em]"
            style={{
              fontFamily: dmSans.style.fontFamily,
              color: "#FFFDFD",
              fontWeight: 400,
            }}
          >
            PHENYX COLLECTIVE
          </span>
        </a>
      </header>

      {/* Main Content */}
      <main className="px-6 md:px-20 py-16 max-w-4xl">
        {/* Page Title */}
        <h1
          className="text-4xl md:text-5xl mb-4"
          style={{
            fontFamily: dmSerifDisplay.style.fontFamily,
            color: "#FFFDFD",
            fontWeight: 400,
          }}
        >
          Privacy Policy
        </h1>

        {/* Last Updated */}
        <p
          className="text-sm mb-16"
          style={{
            fontFamily: dmSans.style.fontFamily,
            color: "rgba(255,253,253,0.5)",
          }}
        >
          Last Updated: April 29, 2026
        </p>

        {/* Introduction */}
        <div
          className="text-base leading-[1.8] mb-12"
          style={{
            fontFamily: dmSans.style.fontFamily,
            color: "rgba(255,253,253,0.85)",
            fontWeight: 300,
          }}
        >
          This Privacy Policy describes how PHENYX COLLECTIVE, INC. (&quot;PHENYX COLLECTIVE,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, and shares your information when you use our website (the &quot;Platform&quot;). By using the Platform, you agree to the terms of this Privacy Policy. If you have questions, contact us at contact@phenyxcollective.com.
        </div>

        {/* Information We Collect */}
        <PolicySection title="Information We Collect">
          <p className="mb-4">
            <strong style={{ fontWeight: 500 }}>Information You Provide Directly.</strong> We collect information you voluntarily provide, including your name, email address, username, password, profile content, personal narratives, and any other information you submit when creating or managing your account or completing our waitlist or onboarding forms.
          </p>
          <p className="mb-4">
            <strong style={{ fontWeight: 500 }}>Email and SMS Verification.</strong> We use Twilio to deliver one-time passcode (OTP) verification to your email address and/or mobile phone number during account creation and login. Your email address and phone number are transmitted to Twilio solely for OTP delivery and are not stored by PHENYX COLLECTIVE or Twilio after verification is complete. Message and data rates may apply. Message frequency varies. Reply HELP for help or STOP to opt out of SMS messages. For support, contact contact@phenyxcollective.com.
          </p>
          <p className="mb-4">
            <strong style={{ fontWeight: 500 }}>User-Generated Content.</strong> We collect content you create or share on the Platform, including text, images, reflections, journal entries, and responses to identity formation prompts submitted as part of your PHENYX COLLECTIVE experience.
          </p>
          <p className="mb-4">
            <strong style={{ fontWeight: 500 }}>Linked Accounts and Platform Data.</strong> A core part of the PHENYX COLLECTIVE experience involves optionally connecting your existing digital presence to support identity formation. When you choose to link social media accounts, professional profiles, or third-party platforms via OAuth authorization, we temporarily access information from those sources. This data is processed in real time and is never written to PHENYX COLLECTIVE servers in its raw form. Only the synthesized insights derived from this data are retained.
          </p>
          <p>
            <strong style={{ fontWeight: 500 }}>Third-Party Data Processing (Onairos).</strong> To power the platform data synthesis features of PHENYX COLLECTIVE, we use Onairos, a third-party identity intelligence service, to facilitate connections to your linked platforms and generate structured personality insights from your authorized data. Onairos processes your platform data on our behalf as a data processor, in accordance with a Data Processing Agreement between PHENYX COLLECTIVE and Onairos. Onairos does not retain, sell, or share your raw platform data or identity insights for any purpose other than providing services to PHENYX COLLECTIVE. For more information about how Onairos handles data, please refer to their privacy policy at onairos.uk.
          </p>
        </PolicySection>

        {/* Data Security and Encryption */}
        <PolicySection title="Data Security and Encryption">
          <p>
            We implement reasonable technical and organizational measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. Sensitive user content, including reflection text and AI-generated identity insights, is encrypted at rest using AES-256-GCM encryption. Data in transit between your device and our servers is protected by TLS encryption. We regularly review and update our security practices to address evolving threats. Despite these measures, no system or internet transmission can be guaranteed to be 100% secure. We cannot promise that unauthorized third parties will never defeat our security measures. Transmission of personal information to and from the Platform is at your own risk. In the event of a data breach affecting your personal information, we will notify you and, where applicable, the relevant supervisory authority, in accordance with applicable law and within the timeframes required by law (including the 72-hour notification window required under the EU General Data Protection Regulation).
          </p>
        </PolicySection>

        {/* How We Use Your Information */}
        <PolicySection title="How We Use Your Information">
          <p>
            We use the information we collect to: create and manage your account and waitlist position; synthesize data from your linked platforms to develop your personal identity constellation and formation insights; generate personalized AI reflection prompts based on your specific identity data; provide, personalize, and improve your Platform experience; enable community features and identity-resonance matching between members; communicate with you about waitlist updates, platform launches, and platform activity; detect and prevent fraud or unauthorized activity; comply with applicable legal obligations; and for other purposes with your explicit consent.
          </p>
        </PolicySection>

        {/* Legal Bases for Processing (GDPR) */}
        <PolicySection title="Legal Bases for Processing (GDPR)">
          <p>
            If you are located in the European Economic Area, the United Kingdom, or Switzerland, we process your personal data under the following legal bases: (a) Consent: We rely on your consent to process your linked platform data, to generate AI-powered identity insights from your authorized data, and to use cookies and tracking technologies for non-essential purposes. You may withdraw your consent at any time by contacting us at contact@phenyxcollective.com or through your account settings. (b) Contract Performance: We process your name, email address, and account data to the extent necessary to provide you with access to the Platform and fulfill our obligations under our Terms of Service. (c) Legitimate Interests: We may process certain usage and technical data on the basis of our legitimate interest in operating, maintaining, and improving the Platform, preventing fraud, and ensuring platform security, provided such interests are not overridden by your rights and freedoms. (d) Legal Obligation: We may process your data to comply with applicable legal requirements, including responding to lawful requests from public authorities.
          </p>
        </PolicySection>

        {/* Cookies and Tracking Technologies */}
        <PolicySection title="Cookies and Tracking Technologies">
          <p>
            We use cookies, web beacons, pixels, and similar technologies to maintain platform security, save your preferences, and analyze usage. You may adjust cookie preferences through your browser settings, though some features may not function properly if cookies are disabled. Most browsers include a Do-Not-Track (&quot;DNT&quot;) setting. Because no uniform standard for recognizing DNT signals currently exists, we do not respond to them at this time.
          </p>
        </PolicySection>

        {/* How We Share Your Information */}
        <PolicySection title="How We Share Your Information">
          <p>
            We do not sell your personal information. We may share your information with: Onairos, Supabase, Vercel, Twilio, and other service providers who operate on our behalf (including infrastructure hosting, database services, analytics, and communication delivery), under confidentiality obligations and data processing agreements; other users when you choose to make elements of your constellation or profile visible within the collective; legal authorities when required by law or to protect the rights and safety of our users or the public; and successors in the event of a merger, acquisition, or sale of assets, with prior notice to you.
          </p>
        </PolicySection>

        {/* Data Retention */}
        <PolicySection title="Data Retention">
          <p>
            We retain your synthesized identity data and account information for as long as your account is active or as needed to fulfill the purposes in this Privacy Policy, unless a longer period is required by law. Raw platform data accessed through OAuth connections is processed and discarded immediately after synthesis. Only synthesized identity insights are retained. When your information is no longer needed, we delete or anonymize it. Onairos processes data ephemerally, in memory only, and does not write raw platform data to disk. For details on Onairos data handling, please review their privacy policy at onairos.uk.
          </p>
        </PolicySection>

        {/* Minors */}
        <PolicySection title="Minors">
          <p>
            Our Platform is not directed to individuals under 18 years of age. By using the Platform, you represent that you are at least 18. If we learn that we have collected personal information from a user under 18, we will deactivate the account and promptly delete the data. To report such a case, contact us at contact@phenyxcollective.com.
          </p>
        </PolicySection>

        {/* Your Privacy Rights */}
        <PolicySection title="Your Privacy Rights">
          <p>
            Depending on your location, you may have the right to: access the personal information we hold about you; request correction of inaccurate data; request deletion of your personal information; restrict or object to processing of your personal data; withdraw consent where processing is based on consent; opt out of targeted advertising or data sharing; receive a portable copy of your data in a structured, machine-readable format; and lodge a complaint with a supervisory authority. To exercise any of these rights, email us at contact@phenyxcollective.com. We will verify your identity before processing your request and respond in accordance with applicable law. We will not discriminate against you for exercising any privacy rights available to you.
          </p>
        </PolicySection>

        {/* International Users */}
        <PolicySection title="International Users">
          <p>
            PHENYX COLLECTIVE is based in the United States. If you are accessing the Platform from outside the United States, including from the European Economic Area, the United Kingdom, or Switzerland, please be aware that your information may be transferred to, stored in, and processed in the United States and other jurisdictions where our service providers operate. By using the Platform, you acknowledge and consent to such transfer and processing in accordance with this Privacy Policy. Where required by applicable law, including the GDPR, we implement appropriate safeguards for international transfers of personal data, including Standard Contractual Clauses approved by the European Commission or equivalent transfer mechanisms. To obtain information about our transfer safeguards, contact us at contact@phenyxcollective.com. If you are located in the European Economic Area or the United Kingdom and believe our processing of your personal data violates applicable data protection law, you have the right to lodge a complaint with the supervisory authority in your country of residence or the country where the alleged violation occurred.
          </p>
        </PolicySection>

        {/* US State Privacy Rights */}
        <PolicySection title="US State Privacy Rights">
          <p>
            If you are a resident of California, Colorado, Connecticut, Delaware, Florida, Indiana, Iowa, Kentucky, Montana, New Hampshire, New Jersey, Oregon, Tennessee, Texas, Utah, or Virginia, you may have additional rights regarding your personal information under applicable state law. In the past twelve months, we have collected the following categories of personal information: identifiers, personal information under the California Customer Records statute, demographic information, internet and network activity, and inferences drawn from the above to support identity formation features. We have not sold or shared personal information for commercial purposes and do not intend to do so. California residents have the right to: know what personal information we collect, use, disclose, and sell; delete personal information we have collected; correct inaccurate personal information; opt out of the sale or sharing of personal information; limit the use or disclosure of sensitive personal information; and not be discriminated against for exercising these rights. To exercise your California privacy rights, contact us at contact@phenyxcollective.com.
          </p>
        </PolicySection>

        {/* Social Logins and Linked Accounts */}
        <PolicySection title="Social Logins and Linked Accounts">
          <p>
            If you register or log in using a social media account, we receive certain profile information from that provider, which may include your name, email address, profile photo, and username. We use this information only as described in this Privacy Policy. We are not responsible for the privacy practices of third-party platforms, including Onairos, and encourage you to review their policies independently.
          </p>
        </PolicySection>

        {/* Updates to This Policy */}
        <PolicySection title="Updates to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Material changes will be communicated via a prominent notice on the Platform or by direct notification. The &quot;Last Updated&quot; date at the top of this policy reflects the most recent revision. Continued use of the Platform following any update constitutes your acceptance of the revised policy. If material changes affect how we process previously collected data, we will seek fresh consent where required by applicable law.
          </p>
        </PolicySection>

        {/* Contact Us */}
        <PolicySection title="Contact Us">
          <p>
            PHENYX COLLECTIVE, INC.<br />
            Email: contact@phenyxcollective.com<br />
            Website: phenyxcollective.com
          </p>
        </PolicySection>
      </main>

      {/* Footer */}
      <footer className="px-6 md:px-20 py-8 border-t border-white/10">
        <Link
          href="/terms"
          className="text-sm hover:opacity-80 transition-opacity"
          style={{
            fontFamily: dmSans.style.fontFamily,
            color: "rgba(255,253,253,0.6)",
          }}
        >
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
