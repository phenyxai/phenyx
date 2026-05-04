"use client";

import { DM_Sans, DM_Serif_Display } from "next/font/google";
import Image from "next/image";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500"] });
const dmSerifDisplay = DM_Serif_Display({ subsets: ["latin"], weight: ["400"] });

export default function TermsOfServicePage() {
  return (
    <main
      className={`${dmSans.className} min-h-screen`}
      style={{ backgroundColor: "#0a0a0a", color: "#FFFDFD" }}
    >
      {/* Header */}
      <header className="px-6 md:px-20 py-8">
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
            className="uppercase text-sm tracking-widest"
            style={{ letterSpacing: "0.15em" }}
          >
            PHENYX COLLECTIVE
          </span>
        </a>
      </header>

      {/* Content */}
      <div className="px-6 md:px-20 pb-24" style={{ maxWidth: "800px" }}>
        {/* Title */}
        <h1
          className={`${dmSerifDisplay.className} mb-4`}
          style={{ fontSize: "48px", fontWeight: 400, lineHeight: 1.1 }}
        >
          Terms of Service
        </h1>

        {/* Last Updated */}
        <p
          className="uppercase mb-12"
          style={{
            fontSize: "11px",
            letterSpacing: "0.15em",
            color: "rgba(255,253,253,0.6)",
          }}
        >
          Last Updated: April 29, 2026
        </p>

        {/* Intro */}
        <p
          className="mb-12"
          style={{
            fontSize: "16px",
            lineHeight: 1.8,
            color: "rgba(255,253,253,0.9)",
          }}
        >
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the PHENYX COLLECTIVE website (the &quot;Platform&quot;), operated by PHENYX COLLECTIVE, INC. (&quot;PHENYX COLLECTIVE,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), a Delaware corporation. PHENYX COLLECTIVE is an identity formation platform that synthesizes your digital presence into a living portrait of your identity called a constellation. By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree, do not use the Platform. PLEASE READ SECTION 14 OF THESE TERMS CAREFULLY. IT CONTAINS AN ARBITRATION AGREEMENT THAT REQUIRES, WITH LIMITED EXCEPTIONS, THAT ALL DISPUTES BETWEEN YOU AND PHENYX COLLECTIVE BE RESOLVED BY BINDING INDIVIDUAL ARBITRATION. BY ACCEPTING THESE TERMS, YOU AGREE TO GIVE UP YOUR RIGHT TO GO TO COURT AND TO PARTICIPATE IN A CLASS ACTION LAWSUIT OR CLASS-WIDE ARBITRATION.
        </p>

        {/* Sections */}
        <div className="space-y-12">
          {/* Section 1 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              1. Eligibility
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              You must be at least 18 years old to use the Platform. By creating an account or joining the waitlist, you represent and warrant that you are at least 18 years of age, that you have the legal capacity to enter into these Terms, and that all information you provide is accurate and complete. If you are accessing the Platform on behalf of an organization, you represent that you have authority to bind that organization to these Terms.
            </p>
          </section>

          {/* Section 2 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              2. Waitlist and Account Registration
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              You may join our waitlist to be among the first to access new Platform features as they become available. By joining the waitlist, you agree to receive communications about PHENYX COLLECTIVE including launch updates and early access invitations. When registering for an account, you agree to: provide accurate, current, and complete information during registration; maintain and promptly update your account information; keep your password confidential and not share it with others; notify us immediately at contact@phenyxcollective.com if you suspect unauthorized access to your account; and accept responsibility for all activity that occurs under your account. We reserve the right to suspend or terminate accounts that contain false information or that violate these Terms.
            </p>
          </section>

          {/* Section 3 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              3. Platform Use and Acceptable Conduct
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              PHENYX COLLECTIVE is a platform for identity formation, self-reflection, and community connection built on the principle that identity is not discovered, it is formed. You agree to use the Platform in a manner consistent with its purpose and in compliance with all applicable laws. You agree not to: post, share, or submit content that is harmful, abusive, harassing, threatening, defamatory, obscene, or discriminatory; impersonate any person, entity, or brand; use the Platform for any unlawful purpose or in violation of any applicable local, state, national, or international law; attempt to gain unauthorized access to any part of the Platform or other users&apos; accounts; interfere with or disrupt the integrity or performance of the Platform; scrape, crawl, or collect data from the Platform without our express written permission; use automated tools, bots, or scripts to access or interact with the Platform; upload or transmit viruses, malware, or any other malicious code; engage in any activity designed to manipulate or misrepresent your identity formation data; or engage in any activity that could damage, disable, or impair the Platform. We reserve the right to investigate and take appropriate action against violations of these Terms, including content removal and permanent termination of your account.
            </p>
          </section>

          {/* Section 4 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              4. Identity Data and the Constellation
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              PHENYX COLLECTIVE&apos;s core functionality involves generating a personal constellation from your identity data. By using the Platform you understand and agree that: your constellation is generated from data you provide directly through reflection prompts and optionally from data you authorize us to access from connected platforms through our third-party data partner Onairos; the AI layer analyzes patterns in your data to generate identity insights, reflection prompts, and community resonance matches; these outputs are generated by an AI system and are not professional psychological assessments or therapeutic advice; your constellation is a living portrait that evolves over time as you add to it and is not a fixed declaration of identity; and you may disconnect any linked platform account at any time through your account settings, which will stop future data collection from that source. PHENYX COLLECTIVE is not a mental health platform, a clinical tool, or a substitute for professional psychological, therapeutic, or psychiatric care. If you are experiencing a mental health crisis, please contact a qualified healthcare professional or a crisis service such as the 988 Suicide and Crisis Lifeline (call or text 988 in the United States) or the Crisis Text Line (text HOME to 741741). Our platform includes crisis detection technology that screens reflection submissions for acute distress signals before AI processing. If our crisis detection system identifies potential distress in your submission, that submission will not be processed by the AI layer and you will be directed to relevant support resources.
            </p>
          </section>

          {/* Section 5 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              5. User-Generated Content
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              You retain ownership of the content you create and submit to the Platform (&quot;User Content&quot;). By submitting User Content, you grant PHENYX COLLECTIVE a non-exclusive, worldwide, royalty-free, sublicensable license to use, display, reproduce, modify, and distribute your User Content solely for the purposes of operating and improving the Platform. You represent and warrant that: you own or have the rights to submit your User Content; your User Content does not infringe any third-party intellectual property, privacy, or other rights; and your User Content complies with these Terms and all applicable laws. We reserve the right to remove any User Content that violates these Terms or that we determine, in our sole discretion, is harmful, inappropriate, or inconsistent with the spirit of the Platform.
            </p>
          </section>

          {/* Section 6 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              6. Linked Accounts and Third-Party Data
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              By optionally linking a social media or third-party account, you authorize us and our data processing partner Onairos to access and process data from that account as described in our Privacy Policy. You are responsible for ensuring you have the right to share any data you connect to the Platform and that doing so does not violate the terms of any third-party platform. We are not responsible for the practices, content, or availability of third-party platforms or services including Onairos.
            </p>
          </section>

          {/* Section 7 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              7. Intellectual Property
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              All content, features, design, branding, and technology on the Platform, excluding User Content, are owned by or licensed to PHENYX COLLECTIVE and protected by applicable intellectual property laws. The PHENYX COLLECTIVE name, phoenix mark, constellation model, seven-pillar identity formation system, and all related marks and concepts are intellectual property of PHENYX COLLECTIVE, INC. You may not copy, reproduce, distribute, modify, or create derivative works of any Platform content without our prior written consent. Nothing in these Terms grants you any right to use our trademarks, service marks, trade dress, or other intellectual property.
            </p>
          </section>

          {/* Section 8 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              8. DMCA and Copyright Policy
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              PHENYX COLLECTIVE respects the intellectual property rights of others and expects users of the Platform to do the same. If you believe that content on the Platform infringes your copyright, you may submit a notification pursuant to the Digital Millennium Copyright Act (17 U.S.C. Section 512) by providing our designated copyright agent with the following information in writing: (a) identification of the copyrighted work claimed to have been infringed; (b) identification of the material claimed to be infringing, with sufficient detail to allow us to locate it on the Platform; (c) your contact information, including name, address, telephone number, and email address; (d) a statement that you have a good faith belief that use of the material is not authorized by the copyright owner, its agent, or the law; (e) a statement made under penalty of perjury that the above information is accurate and that you are the copyright owner or authorized to act on the owner&apos;s behalf; and (f) your physical or electronic signature. Designated Copyright Agent: contact@phenyxcollective.com.
            </p>
          </section>

          {/* Section 9 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              9. Paid Features and Subscriptions
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              PHENYX COLLECTIVE does not currently offer paid features or subscriptions. When paid features are introduced, additional terms governing pricing, billing, cancellation, and refunds will be provided at that time and will be incorporated into these Terms by reference. By continuing to use the Platform after such terms are introduced, you agree to be bound by them.
            </p>
          </section>

          {/* Section 10 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              10. Privacy
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              Your use of the Platform is also governed by our Privacy Policy, available at phenyxcollective.com/privacy-policy, which is incorporated into these Terms by reference. By using the Platform, you consent to the collection and use of your information as described in the Privacy Policy, including processing by our third-party data partner Onairos.
            </p>
          </section>

          {/* Section 11 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              11. Termination
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              You may terminate your account at any time by contacting us at contact@phenyxcollective.com. We reserve the right to permanently terminate your access to the Platform at any time, with or without notice, for any reason, including but not limited to violation of these Terms. Upon termination, your right to use the Platform ceases immediately. Provisions of these Terms that by their nature should survive termination will survive, including intellectual property, disclaimers, and limitations of liability.
            </p>
          </section>

          {/* Section 12 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              12. Disclaimers
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. TO THE FULLEST EXTENT PERMITTED BY LAW, PHENYX COLLECTIVE DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. AI-GENERATED IDENTITY INSIGHTS AND REFLECTION PROMPTS ARE NOT PROFESSIONAL PSYCHOLOGICAL, THERAPEUTIC, OR MEDICAL ADVICE. PHENYX COLLECTIVE IS NOT A CLINICAL TOOL AND IS NOT A SUBSTITUTE FOR PROFESSIONAL MENTAL HEALTH CARE.
            </p>
          </section>

          {/* Section 13 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              13. Limitation of Liability
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, PHENYX COLLECTIVE AND ITS OFFICERS, DIRECTORS, STOCKHOLDERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF OR INABILITY TO USE THE PLATFORM, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM THESE TERMS OR YOUR USE OF THE PLATFORM SHALL NOT EXCEED THE GREATER OF ONE HUNDRED US DOLLARS ($100.00) OR THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          {/* Section 14 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              14. Dispute Resolution and Arbitration Agreement
            </h2>
            <div className="space-y-4" style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              <p>
                <strong>14.1 Informal Resolution.</strong> Before initiating arbitration, you agree to first contact PHENYX COLLECTIVE at contact@phenyxcollective.com and attempt to resolve any dispute informally. You and PHENYX COLLECTIVE agree to negotiate in good faith for a period of sixty (60) days following written notice of a dispute. If the dispute is not resolved within that period, either party may initiate arbitration as provided in this Section.
              </p>
              <p>
                <strong>14.2 Agreement to Arbitrate.</strong> Except as set forth in Section 14.5 below, you and PHENYX COLLECTIVE agree that any and all disputes, claims, or controversies arising out of or relating to these Terms, the Platform, or your relationship with PHENYX COLLECTIVE shall be resolved exclusively by binding, individual arbitration administered by JAMS under its most current applicable rules, and not in a court of law. The Federal Arbitration Act (9 U.S.C. Section 1 et seq.) governs the interpretation and enforcement of this arbitration agreement. The arbitration shall be conducted by a single arbitrator, and judgment on the award rendered may be entered in any court having jurisdiction.
              </p>
              <p>
                <strong>14.3 Class Action Waiver.</strong> YOU AND PHENYX COLLECTIVE AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.
              </p>
              <p>
                <strong>14.4 Jury Trial Waiver.</strong> TO THE EXTENT PERMITTED BY APPLICABLE LAW, YOU AND PHENYX COLLECTIVE WAIVE ANY CONSTITUTIONAL AND STATUTORY RIGHTS TO SUE IN COURT AND HAVE A TRIAL IN FRONT OF A JUDGE OR A JURY.
              </p>
              <p>
                <strong>14.5 Exceptions.</strong> Either party may seek emergency injunctive or other equitable relief in a court of competent jurisdiction where necessary to prevent irreparable harm. Either party may also bring an individual claim in small claims court if the claim qualifies.
              </p>
              <p>
                <strong>14.6 Opt Out.</strong> You may opt out of this arbitration agreement by notifying PHENYX COLLECTIVE in writing at contact@phenyxcollective.com within thirty (30) days of the date you first access the Platform. Your opt-out notice must include your name, mailing address, email address, and a clear statement that you wish to opt out of arbitration. If you do not opt out within the thirty (30) day period, you will be bound by this arbitration agreement.
              </p>
            </div>
          </section>

          {/* Section 15 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              15. Indemnification
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              You agree to indemnify, defend, and hold harmless PHENYX COLLECTIVE and its officers, directors, stockholders, employees, and agents from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys&apos; fees) arising out of or related to your use of the Platform, your User Content, your violation of these Terms, or your violation of any third-party rights.
            </p>
          </section>

          {/* Section 16 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              16. Changes to These Terms
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              We may update these Terms from time to time. Material changes will be communicated via a prominent notice on the Platform or by direct notification. The &quot;Last Updated&quot; date at the top reflects the most recent revision. Continued use of the Platform following any update constitutes your acceptance of the revised Terms. If you do not agree to any revised Terms, you must stop using the Platform.
            </p>
          </section>

          {/* Section 17 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              17. General
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              These Terms constitute the entire agreement between you and PHENYX COLLECTIVE regarding the Platform and supersede all prior agreements relating to the same subject matter. Our failure to exercise or enforce any right or provision of these Terms shall not operate as a waiver of such right or provision. If any provision of these Terms is found to be invalid or unenforceable, that provision will be limited or eliminated to the minimum extent necessary so that these Terms shall otherwise remain in full force and effect. You may not assign your rights or obligations under these Terms without our prior written consent. We may freely assign these Terms.
            </p>
          </section>

          {/* Section 18 */}
          <section>
            <h2
              className="uppercase mb-4"
              style={{
                fontSize: "11px",
                letterSpacing: "0.15em",
                color: "rgba(255,253,253,0.6)",
              }}
            >
              18. Contact Us
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.8, color: "rgba(255,253,253,0.9)" }}>
              PHENYX COLLECTIVE, INC.<br />
              Email: contact@phenyxcollective.com<br />
              Website: phenyxcollective.com
            </p>
          </section>
        </div>

        {/* Footer link */}
        <div className="mt-16 pt-8 border-t border-white/10">
          <a
            href="/privacy-policy"
            className="text-sm hover:opacity-80 transition-opacity"
            style={{ color: "rgba(255,253,253,0.6)" }}
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </main>
  );
}
