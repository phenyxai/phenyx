"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export default function PrivacyPage() {
  const [stellarColor, setStellarColor] = useState("#5599FF");

  useEffect(() => {
    const stored = localStorage.getItem("phenyx_stellar_color");
    if (stored) {
      setStellarColor(stored);
      document.documentElement.style.setProperty("--color-stellar", stored);
    }
  }, []);

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: "12px",
    color: stellarColor,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    fontWeight: 500,
    marginBottom: "12px",
  };

  const sectionBodyStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "#666",
    fontWeight: 300,
    lineHeight: 1.8,
    marginBottom: "32px",
  };

  return (
    <main 
      className="min-h-screen bg-[#0A0A0A] animate-fade-in"
      style={{ padding: "60px 32px" }}
    >
      <div style={{ maxWidth: "680px", margin: "0 auto" }}>
        {/* Logo header */}
        <Link href="/" className="flex items-center mb-12" style={{ gap: "8px" }}>
          <Image 
            src="/phenyx-logo.png" 
            alt="PHENYX COLLECTIVE" 
            width={20} 
            height={20}
            style={{ opacity: 0.9 }}
          />
          <span 
            style={{ 
              fontSize: "11px", 
              letterSpacing: "0.2em", 
              fontWeight: 600, 
              color: "#FFFDFD",
              opacity: 0.9 
            }}
          >
            PHENYX COLLECTIVE
          </span>
        </Link>

        {/* Title */}
        <h1
          style={{
            fontSize: "20px",
            fontWeight: 500,
            color: "#FFFDFD",
            marginBottom: "6px",
          }}
        >
          privacy policy
        </h1>
        <p style={{ fontSize: "12px", color: "#444", marginBottom: "4px" }}>
          PHENYX COLLECTIVE, INC.
        </p>
        <p style={{ fontSize: "11px", color: "#333", marginBottom: "48px" }}>
          last updated: april 7, 2026
        </p>

        {/* Section 1 */}
        <section>
          <h2 style={sectionTitleStyle}>what we collect</h2>
          <p style={sectionBodyStyle}>
            we collect information you voluntarily provide, including your name, email address, and any reflections or responses you submit during your PHENYX COLLECTIVE experience.
          </p>
          <p style={sectionBodyStyle}>
            we use supabase to manage authentication and deliver one time passcode verification. your contact information is transmitted solely for verification and account creation.
          </p>
          <p style={sectionBodyStyle}>
            when you choose to connect your platforms through onairos, we temporarily access information from those sources. this data is processed in real time and never written to our servers in raw form. only the synthesized insights derived from this data are retained.
          </p>
        </section>

        {/* Section 2 */}
        <section>
          <h2 style={sectionTitleStyle}>what we analyze</h2>
          <p style={sectionBodyStyle}>
            our AI layer, in conjunction with onairos, analyzes tone and voice patterns, content themes over time, pivotal moments in your digital presence, and language evolution. these signals are mapped to our seven pillar identity formation model to generate your personal constellation.
          </p>
          <p style={sectionBodyStyle}>
            the resulting analysis may include personality tendencies and a personal summary derived from your connected platform data.
          </p>
        </section>

        {/* Section 3 */}
        <section>
          <h2 style={sectionTitleStyle}>what we never do</h2>
          <p style={sectionBodyStyle}>
            we do not store raw platform data. we process and discard, retaining only synthesized identity insights.
          </p>
          <p style={sectionBodyStyle}>
            we do not collect or store biometric data of any kind.
          </p>
          <p style={sectionBodyStyle}>
            we do not access your data without your explicit consent. every connection is OAuth authorized and revocable at any time from your settings.
          </p>
          <p style={sectionBodyStyle}>
            we do not sell your personal information to any third party.
          </p>
          <p style={sectionBodyStyle}>
            we do not use your data to assign you a fixed label or category. our AI reflects identity patterns. it does not permanently categorize.
          </p>
        </section>

        {/* Section 4 */}
        <section>
          <h2 style={sectionTitleStyle}>how we use your information</h2>
          <p style={sectionBodyStyle}>
            we use the information we collect to create and manage your account, synthesize your identity constellation, generate personalized reflection prompts, and improve your experience on the platform.
          </p>
          <p style={sectionBodyStyle}>
            we may communicate with you about platform updates and activity. we detect and prevent unauthorized activity and comply with applicable legal obligations.
          </p>
        </section>

        {/* Section 5 */}
        <section>
          <h2 style={sectionTitleStyle}>how we share your information</h2>
          <p style={sectionBodyStyle}>
            we do not sell your personal information.
          </p>
          <p style={sectionBodyStyle}>
            we share your information only with service providers who operate on our behalf, including onairos for identity synthesis, supabase for authentication, and resend for email delivery, under confidentiality obligations.
          </p>
          <p style={sectionBodyStyle}>
            we may share information with legal authorities when required by law, or with successors in the event of a merger or acquisition, with prior notice to you.
          </p>
        </section>

        {/* Section 6 */}
        <section>
          <h2 style={sectionTitleStyle}>data retention</h2>
          <p style={sectionBodyStyle}>
            we retain your synthesized identity data and account information for as long as your account is active.
          </p>
          <p style={sectionBodyStyle}>
            raw platform data accessed through connected accounts is processed and discarded immediately after synthesis. only synthesized insights are retained.
          </p>
          <p style={sectionBodyStyle}>
            when your account is deleted, all associated data is permanently removed within 24 hours. nothing is archived. nothing is retained.
          </p>
        </section>

        {/* Section 7 */}
        <section>
          <h2 style={sectionTitleStyle}>data security</h2>
          <p style={sectionBodyStyle}>
            we have implemented reasonable technical and organizational measures to protect your personal information. your reflections and constellation insights are encrypted before they reach our database.
          </p>
          <p style={sectionBodyStyle}>
            no system can be guaranteed to be 100% secure. in the event of a data breach affecting your personal information, we will notify you in accordance with applicable law.
          </p>
        </section>

        {/* Section 8 */}
        <section>
          <h2 style={sectionTitleStyle}>minors</h2>
          <p style={sectionBodyStyle}>
            our platform is not directed to individuals under 18 years of age. by using the platform, you represent that you are at least 18. if we learn that we have collected information from a user under 18, we will deactivate the account and delete the data promptly.
          </p>
        </section>

        {/* Section 9 */}
        <section>
          <h2 style={sectionTitleStyle}>your privacy rights</h2>
          <p style={sectionBodyStyle}>
            depending on your location, you may have the right to access the personal information we hold about you, request correction of inaccurate data, request deletion of your personal information, withdraw consent where processing is based on consent, and receive a portable copy of your data.
          </p>
          <p style={sectionBodyStyle}>
            to exercise these rights, email us at{" "}
            <a href="mailto:contact@phenyxcollective.com" style={{ color: stellarColor }}>
              contact@phenyxcollective.com
            </a>
            . we will verify your identity before processing your request.
          </p>
        </section>

        {/* Section 10 */}
        <section>
          <h2 style={sectionTitleStyle}>us state privacy rights</h2>
          <p style={sectionBodyStyle}>
            if you are a resident of california, colorado, connecticut, or other states with applicable privacy laws, you may have additional rights regarding your personal information.
          </p>
          <p style={sectionBodyStyle}>
            we have not sold or shared personal information for commercial purposes and do not intend to do so. to exercise any of the above rights, contact us at{" "}
            <a href="mailto:contact@phenyxcollective.com" style={{ color: stellarColor }}>
              contact@phenyxcollective.com
            </a>
            .
          </p>
        </section>

        {/* Section 11 */}
        <section>
          <h2 style={sectionTitleStyle}>updates to this policy</h2>
          <p style={sectionBodyStyle}>
            we may update this privacy policy from time to time. material changes will be communicated via a prominent notice on the platform or by direct notification. continued use of the platform following any update constitutes your acceptance of the revised policy.
          </p>
        </section>

        {/* Section 12 */}
        <section>
          <h2 style={sectionTitleStyle}>contact us</h2>
          <address
            style={{
              fontStyle: "normal",
              fontSize: "13px",
              color: "#555",
              lineHeight: 1.8,
            }}
          >
            PHENYX COLLECTIVE, INC.<br />
            <a href="mailto:contact@phenyxcollective.com" style={{ color: stellarColor }}>
              contact@phenyxcollective.com
            </a><br />
            phenyxcollective.com
          </address>
        </section>
      </div>
    </main>
  );
}
