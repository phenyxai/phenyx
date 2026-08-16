import type { Metadata } from "next";
import { LegalDocument, LegalMail } from "@/components/phenyx/legal-document";

export const metadata: Metadata = {
  title: "Privacy Policy | PHENYX",
  description: "Privacy Policy for PHENYX INC.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument title="Privacy Policy" current="privacy">
      <p className="legal-doc__lead">
        This Privacy Policy describes how PHENYX INC. (&quot;PHENYX,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) collects, uses, and shares your information when you use our website and services (the &quot;Platform&quot;). By using the Platform, you agree to the terms of this Privacy Policy. If you have questions, contact us at <LegalMail />.
      </p>
      <p>
        PHENYX INC. was formerly known as PHENYX COLLECTIVE, INC. References to the prior name in earlier agreements or communications refer to the same company.
      </p>

      <h2>Information We Collect</h2>
      <p>
        <strong>Information You Provide Directly.</strong> We collect information you voluntarily provide, including your name, email address, username, passphrase, profile content, personal narratives, and any other information you submit when creating or managing your account or completing our waitlist or onboarding forms.
      </p>
      <p>
        <strong>Email Verification.</strong> We use Resend to deliver one-time passcode (OTP) verification to your email address during account creation and login. Your email address is transmitted to Resend solely for OTP delivery and is not retained by Resend after verification is complete. For support, contact <LegalMail />.
      </p>
      <p>
        <strong>User-Generated Content.</strong> We collect content you create or share on the Platform, including text, reflections, and responses to identity prompts submitted as part of your PHENYX experience.
      </p>
      <p>
        <strong>Linked Accounts and Platform Data.</strong> A core part of the PHENYX experience involves optionally connecting your existing digital presence to build your identity constellation. When you choose to link social media accounts, professional profiles, or third-party platforms via OAuth authorization, we temporarily access information from those sources. This data is processed in real time and is never written to PHENYX servers in its raw form. Only the synthesized observations derived from this data are retained.
      </p>
      <p>
        <strong>Third-Party Data Processing (Onairos).</strong> To power the platform-data synthesis features of PHENYX, we use Onairos, a third-party identity intelligence service, to facilitate connections to your linked platforms and generate structured insights from your authorized data. Onairos processes your platform data on our behalf as a data processor, in accordance with a Data Processing Agreement between PHENYX and Onairos. Onairos does not retain, sell, or share your raw platform data or identity insights for any purpose other than providing services to PHENYX. For more information about how Onairos handles data, please refer to their privacy policy at{" "}
        <a href="https://onairos.uk" target="_blank" rel="noopener">onairos.uk</a>.
      </p>

      <h2>Data Security and Encryption</h2>
      <p>
        We implement reasonable technical and organizational measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. Sensitive user content, including reflection text and AI-generated observations, is encrypted at rest using AES-256-GCM encryption. Data in transit between your device and our servers is protected by TLS encryption. We regularly review and update our security practices to address evolving threats. Despite these measures, no system or internet transmission can be guaranteed to be 100% secure. We cannot promise that unauthorized third parties will never defeat our security measures. Transmission of personal information to and from the Platform is at your own risk. In the event of a data breach affecting your personal information, we will notify you and, where applicable, the relevant supervisory authority, in accordance with applicable law and within the timeframes required by law (including the 72-hour notification window required under the EU General Data Protection Regulation).
      </p>

      <h2>How We Use Your Information</h2>
      <p>
        We use the information we collect to: create and manage your account and waitlist position; synthesize data from your linked platforms to develop your personal identity constellation and observations; generate personalized AI reflections and Polaris responses based on your specific identity data; provide, personalize, and improve your Platform experience; enable community features and identity-resonance matching between members; communicate with you about waitlist updates, platform launches, and platform activity; detect and prevent fraud or unauthorized activity; comply with applicable legal obligations; and for other purposes with your explicit consent.
      </p>

      <h2>Legal Bases for Processing (GDPR)</h2>
      <p>
        If you are located in the European Economic Area, the United Kingdom, or Switzerland, we process your personal data under the following legal bases: <strong>(a) Consent:</strong> We rely on your consent to process your linked platform data, to generate AI-powered observations from your authorized data, and to use cookies and tracking technologies for non-essential purposes. You may withdraw your consent at any time by contacting us at <LegalMail /> or through your account settings. <strong>(b) Contract Performance:</strong> We process your name, email address, and account data to the extent necessary to provide you with access to the Platform and fulfill our obligations under our Terms of Service. <strong>(c) Legitimate Interests:</strong> We may process certain usage and technical data on the basis of our legitimate interest in operating, maintaining, and improving the Platform, preventing fraud, and ensuring platform security, provided such interests are not overridden by your rights and freedoms. <strong>(d) Legal Obligation:</strong> We may process your data to comply with applicable legal requirements, including responding to lawful requests from public authorities.
      </p>

      <h2>Cookies and Tracking Technologies</h2>
      <p>
        We use cookies, web beacons, pixels, and similar technologies to maintain platform security, save your preferences, and analyze usage. You may adjust cookie preferences through your browser settings, though some features may not function properly if cookies are disabled. Most browsers include a Do-Not-Track (&quot;DNT&quot;) setting. Because no uniform standard for recognizing DNT signals currently exists, we do not respond to them at this time.
      </p>

      <h2>How We Share Your Information</h2>
      <p>
        We do not sell your personal information. We may share your information with: Onairos, Supabase, Vercel, Render, Stripe, Resend, Anthropic, and other service providers who operate on our behalf (including infrastructure hosting, database services, payment processing, AI processing, analytics, and communication delivery), under confidentiality obligations and data processing agreements; other users when you choose to make elements of your constellation or profile visible within the collective; legal authorities when required by law or to protect the rights and safety of our users or the public; and successors in the event of a merger, acquisition, or sale of assets, with prior notice to you.
      </p>

      <h2>Data Retention</h2>
      <p>
        We retain your synthesized identity data and account information for as long as your account is active or as needed to fulfill the purposes in this Privacy Policy, unless a longer period is required by law. Raw platform data accessed through OAuth connections is processed and discarded immediately after synthesis. Only synthesized observations are retained. When your information is no longer needed, we delete or anonymize it. Onairos processes data ephemerally, in memory only, and does not write raw platform data to disk. For details on Onairos data handling, please review their privacy policy at{" "}
        <a href="https://onairos.uk" target="_blank" rel="noopener">onairos.uk</a>.
      </p>

      <h2>Minors</h2>
      <p>
        Our Platform is not directed to individuals under 18 years of age. By using the Platform, you represent that you are at least 18. If we learn that we have collected personal information from a user under 18, we will deactivate the account and promptly delete the data. To report such a case, contact us at <LegalMail />.
      </p>

      <h2>Your Privacy Rights</h2>
      <p>
        Depending on your location, you may have the right to: access the personal information we hold about you; request correction of inaccurate data; request deletion of your personal information; restrict or object to processing of your personal data; withdraw consent where processing is based on consent; opt out of targeted advertising or data sharing; receive a portable copy of your data in a structured, machine-readable format; and lodge a complaint with a supervisory authority. To exercise any of these rights, email us at <LegalMail />. We will verify your identity before processing your request and respond in accordance with applicable law. We will not discriminate against you for exercising any privacy rights available to you.
      </p>

      <h2>International Users</h2>
      <p>
        PHENYX is based in the United States. If you are accessing the Platform from outside the United States, including from the European Economic Area, the United Kingdom, or Switzerland, please be aware that your information may be transferred to, stored in, and processed in the United States and other jurisdictions where our service providers operate. By using the Platform, you acknowledge and consent to such transfer and processing in accordance with this Privacy Policy. Where required by applicable law, including the GDPR, we implement appropriate safeguards for international transfers of personal data, including Standard Contractual Clauses approved by the European Commission or equivalent transfer mechanisms. To obtain information about our transfer safeguards, contact us at <LegalMail />. If you are located in the European Economic Area or the United Kingdom and believe our processing of your personal data violates applicable data protection law, you have the right to lodge a complaint with the supervisory authority in your country of residence or the country where the alleged violation occurred.
      </p>

      <h2>US State Privacy Rights</h2>
      <p>
        If you are a resident of California, Colorado, Connecticut, Delaware, Florida, Indiana, Iowa, Kentucky, Montana, New Hampshire, New Jersey, Oregon, Tennessee, Texas, Utah, or Virginia, you may have additional rights regarding your personal information under applicable state law. In the past twelve months, we have collected the following categories of personal information: identifiers, personal information under the California Customer Records statute, demographic information, internet and network activity, and inferences drawn from the above to support identity features. We have not sold or shared personal information for commercial purposes and do not intend to do so. California residents have the right to: know what personal information we collect, use, disclose, and sell; delete personal information we have collected; correct inaccurate personal information; opt out of the sale or sharing of personal information; limit the use or disclosure of sensitive personal information; and not be discriminated against for exercising these rights. To exercise your California privacy rights, contact us at <LegalMail />.
      </p>

      <h2>Social Logins and Linked Accounts</h2>
      <p>
        If you register or log in using a social media account, we receive certain profile information from that provider, which may include your name, email address, profile photo, and username. We use this information only as described in this Privacy Policy. We are not responsible for the privacy practices of third-party platforms, including Onairos, and encourage you to review their policies independently.
      </p>

      <h2>Updates to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be communicated via a prominent notice on the Platform or by direct notification. The &quot;Last Updated&quot; date at the top of this policy reflects the most recent revision. Continued use of the Platform following any update constitutes your acceptance of the revised policy. If material changes affect how we process previously collected data, we will seek fresh consent where required by applicable law.
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
