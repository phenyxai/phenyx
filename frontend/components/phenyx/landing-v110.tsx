"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { IdentityParticles } from "./identity-particles";
import { HeroStarfield } from "./hero-starfield";
import { PlatformField } from "./platform-field";
import { MissionConstellation } from "./mission-constellation";

export function LandingV110() {
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [navDropdownOpen, setNavDropdownOpen] = useState(false);

  const openEntryModal = () => setEntryModalOpen(true);
  const closeEntryModal = () => setEntryModalOpen(false);
  
  const toggleLandingNavMenu = () => setNavDropdownOpen((prev) => !prev);
  const closeLandingNavMenu = () => setNavDropdownOpen(false);

  const smoothScrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      className="scr landing-scr on"
      id="s0"
      style={{ position: "fixed", inset: 0, top: 0, overflowY: "auto", zIndex: 10, justifyContent: "initial", alignItems: "initial" }}
    >
      <nav className="landing-nav">
        <a
          href="#s0-top"
          className="landing-nav-logo"
          onClick={(e) => {
            e.preventDefault();
            smoothScrollTo("s0-top");
          }}
        >
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3CradialGradient id='g'%3E%3Cstop offset='.45' stop-color='%23B9D5FF'/%3E%3Cstop offset='.62' stop-color='%236E8FD0' stop-opacity='.5'/%3E%3Cstop offset='1' stop-color='%236E8FD0' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='32' cy='32' r='32' fill='url(%23g)'/%3E%3Ccircle cx='32' cy='32' r='17' fill='%23B9D5FF'/%3E%3C/svg%3E"
            alt=""
            className="landing-nav-dot-img"
            style={{ width: "18px", height: "18px", borderRadius: "50%", display: "block" }}
          />
          <span className="landing-nav-word">PHENYX</span>
        </a>
        <div className="landing-nav-links">
          <a
            href="#s0-about"
            className="landing-nav-link"
            onClick={(e) => {
              e.preventDefault();
              smoothScrollTo("s0-about");
            }}
          >
            first look
          </a>
          <a
            href="#s0-how"
            className="landing-nav-link"
            onClick={(e) => {
              e.preventDefault();
              smoothScrollTo("s0-how");
            }}
          >
            how it works
          </a>
          <a
            href="#s0-mission"
            className="landing-nav-link"
            onClick={(e) => {
              e.preventDefault();
              smoothScrollTo("s0-mission");
            }}
          >
            your constellation
          </a>
          <a
            href="#s0-polaris"
            className="landing-nav-link"
            onClick={(e) => {
              e.preventDefault();
              smoothScrollTo("s0-polaris");
            }}
          >
            polaris
          </a>
        </div>
        <button type="button" className="landing-nav-enter" onClick={openEntryModal}>
          enter
        </button>
        <button
          type="button"
          className="landing-nav-menu-btn"
          id="landingNavMenuBtn"
          onClick={toggleLandingNavMenu}
          aria-label="menu"
          style={{ display: "none" }}
        >
          <span className="hb-line"></span>
          <span className="hb-line"></span>
          <span className="hb-line"></span>
        </button>
      </nav>

      <div className={`landing-nav-dropdown ${navDropdownOpen ? "open" : ""}`} id="landingNavDropdown">
        <a
          href="#s0-about"
          className="landing-nav-dd-link"
          onClick={(e) => {
            e.preventDefault();
            closeLandingNavMenu();
            smoothScrollTo("s0-about");
          }}
        >
          first look
        </a>
        <a
          href="#s0-how"
          className="landing-nav-dd-link"
          onClick={(e) => {
            e.preventDefault();
            closeLandingNavMenu();
            smoothScrollTo("s0-how");
          }}
        >
          how it works
        </a>
        <a
          href="#s0-mission"
          className="landing-nav-dd-link"
          onClick={(e) => {
            e.preventDefault();
            closeLandingNavMenu();
            smoothScrollTo("s0-mission");
          }}
        >
          your constellation
        </a>
        <a
          href="#s0-polaris"
          className="landing-nav-dd-link"
          onClick={(e) => {
            e.preventDefault();
            closeLandingNavMenu();
            smoothScrollTo("s0-polaris");
          }}
        >
          polaris
        </a>
        <a
          href="#"
          className="landing-nav-dd-link landing-nav-dd-enter"
          onClick={(e) => {
            e.preventDefault();
            closeLandingNavMenu();
            openEntryModal();
          }}
        >
          enter
        </a>
      </div>

      <header className="hero" id="s0-top">
        <div className="hero-content">
          <h1 className="hero-logo">PHENYX</h1>
          <p className="hero-tagline">your life, taking form</p>
          <p className="hero-desc">see who you've been, across everything you already use.</p>
          <button type="button" className="hero-enter" onClick={openEntryModal}>
            <span>enter</span>
          </button>
        </div>
        <div className="hero-particle-field" id="heroParticleField">
          <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
            <HeroStarfield />
          </div>
          <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
            <IdentityParticles />
          </div>
        </div>
        <div className="scroll-cue">
          <span className="scroll-cue-dot"></span>
          <span className="scroll-cue-label">scroll</span>
        </div>
      </header>

      <section className="section" id="s0-about">
        <div className="section-inner">
          <p className="s2-eyebrow">first look</p>
          <h2 className="s2-headline">you were never in pieces, only in places</h2>
          <div className="s0-about-grid">
            <div className="s0-about-text">
              <p className="s2-sub">
                every place you use asks for one part of you: the listener, the maker, the one who saves things for later.
              </p>
              <p className="s2-sub s2-sub-mid">
                each one keeps a version of you that is true, but not one shows what it all adds up to.
              </p>
              <p className="s2-sub s2-sub-mid">
                so there has never been one place that holds all of you at once. every moment came from the same life, but
                nothing has ever gathered them in the same place.
              </p>

              <p className="section-thesis">so we made one.</p>
            </div>
            <div className="s0-platform-field" id="s0PlatformField">
              <PlatformField />
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="s0-how">
        <div className="section-inner">
          <p className="s3-eyebrow">how it works</p>
          <h2 className="s3-headline">connect, assemble, reveal</h2>
          <p className="s3-lede">three layers, and nothing invented in any of them.</p>
          <div className="how-chart how-system" aria-label="How PHENYX works overview">
            <div className="how-system-steps">
              <article className="how-step-card">
                <p className="how-chart-kicker">layer one</p>
                <h3 className="how-chart-title">connect</h3>
                <p className="how-chart-copy">
                  what you listen to, watch, save, post and build, from only the places you choose.
                </p>
              </article>
              <article className="how-step-card">
                <p className="how-chart-kicker">layer two</p>
                <h3 className="how-chart-title">assemble</h3>
                <p className="how-chart-copy">
                  everything lands on one timeline, so repeats and shifts finally sit next to each other.
                </p>
              </article>
              <article className="how-step-card">
                <p className="how-chart-kicker">layer three</p>
                <h3 className="how-chart-title">reveal</h3>
                <p className="how-chart-copy">
                  the shape no single account could show, with the moments and evidence that made it visible.
                </p>
              </article>
            </div>

            <article className="how-system-bottom how-band">
              <div className="how-band-part how-band-part--signals">
                <p className="how-signal-label">what comes into view</p>
                <div className="how-signal-list" id="howSignalList">
                  <svg className="how-signal-path" id="howSignalPath" aria-hidden="true"></svg>
                  <span style={{ ["--ny" as string]: ".62", ["--ns" as string]: "5px", ["--nx" as string]: "0" }}>
                    <i className="sig-node"></i>what keeps returning
                  </span>
                  <span style={{ ["--ny" as string]: ".24", ["--ns" as string]: "4px", ["--nx" as string]: "1" }}>
                    <i className="sig-node"></i>what overlaps
                  </span>
                  <span style={{ ["--ny" as string]: ".80", ["--ns" as string]: "4.5px", ["--nx" as string]: ".42" }}>
                    <i className="sig-node"></i>creative rhythms
                  </span>
                  <span style={{ ["--ny" as string]: ".30", ["--ns" as string]: "5.5px", ["--nx" as string]: "1" }}>
                    <i className="sig-node"></i>turning points
                  </span>
                  <span style={{ ["--ny" as string]: ".12", ["--ns" as string]: "4px", ["--nx" as string]: ".28" }}>
                    <i className="sig-node"></i>how you decide
                  </span>
                  <span style={{ ["--ny" as string]: ".54", ["--ns" as string]: "5px", ["--nx" as string]: ".86" }}>
                    <i className="sig-node"></i>what stays with you
                  </span>
                </div>
              </div>

              <div className="how-band-part how-band-part--protect">
                <p className="how-signal-label">what stays yours</p>
                <div className="how-protect-grid">
                  <div className="how-protect-card">
                    <h4>your control.</h4>
                    <p>choose what comes in. disconnect whenever you want.</p>
                  </div>
                  <div className="how-protect-card">
                    <h4>your privacy.</h4>
                    <p>PHENYX keeps what it learned from your accounts, never a second copy of them.</p>
                  </div>
                  <div className="how-protect-card">
                    <h4>your meaning.</h4>
                    <p>PHENYX can show what is there. what it means stays yours.</p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="identity-section" id="s0-mission">
        <div className="section-inner">
          <p className="s3-eyebrow">your constellation</p>
          <h2 className="s3-headline">see how the parts of your life relate</h2>
          <div className="identity-grid">
            <div className="identity-body">
              <p>a constellation is not the stars. it is the shape they make once you see them together.</p>
              <p className="identity-copy-second">
                seven points run from where you began to where you are heading, each looking at one question through{" "}
                <span className="no-wrap">the evidence of your life.</span>
              </p>
              <p className="identity-copy-second">
                it is not a profile you finish. new things appear, old ones return, some fall away, and the shape keeps
                enough of you to notice when you change.
              </p>
              <p className="section-thesis">the points stay the same. what fills them is yours.</p>
            </div>
            <div className="identity-visual">
              <div
                className="identity-stack"
                role="img"
                aria-label="Seven-point constellation: origin, emergence, self-creation, convergence, becoming, recognition, and transcendence. Each point reflects a different part of your life across time."
              >
                <MissionConstellation />
                <p className="const-hover-name" id="constHoverName" aria-live="polite"></p>
              </div>
            </div>
          </div>

          <ConstellationExample />
        </div>
      </section>

      <section className="section polaris-section" id="s0-polaris">
        <div className="section-inner">
          <p className="s3-eyebrow">polaris</p>
          <h2 className="s3-headline">follow one thread all the way through</h2>
          <div className="polaris-preview">
            <div className="polaris-preview-intro">
              <p className="usecase-lead">
                <b className="pol-pair">
                  the constellation lets you see yourself. polaris lets you use what you see.
                </b>{" "}
                ask about something you keep returning to, or where it might be leading. polaris answers from the context
                already here, so you never start by explaining yourself.
              </p>
              <p className="usecase-lead polaris-observations">and when you arrive with no question, a few things come forward on their own.</p>
              <p className="section-thesis polaris-thesis">you bring the question. the context is already here.</p>
            </div>
            <PolarisCard />
          </div>
        </div>
      </section>

      <section className="cta-section" id="s0-cta">
        <h2 className="cta-headline">look again</h2>
        <p className="cta-sub">there is more of you here than you can currently see.</p>
        <button type="button" className="hero-enter" onClick={openEntryModal} style={{ margin: "0 auto" }}>
          <span>enter</span>
        </button>
      </section>

      <footer className="footer">
        <div className="footer-left">
          <span className="footer-dot" aria-hidden="true"></span>
          <div className="footer-links">
            <Link href="/privacy-policy" className="footer-link">
              privacy
            </Link>
            <Link href="/terms" className="footer-link">
              terms
            </Link>
            <a href="mailto:contact@phenyxai.com" className="footer-link">
              contact@phenyxai.com
            </a>
          </div>
        </div>
        <span className="footer-meta">© 2026 PHENYX INC.</span>
      </footer>

      {/* Entry Modal */}
      <div
        className="entry-modal-overlay"
        id="entryModalOverlay"
        onClick={closeEntryModal}
        style={{ display: entryModalOpen ? "block" : "none" }}
      ></div>
      <div className="entry-modal" id="entryModal" style={{ display: entryModalOpen ? "block" : "none" }}>
        <button type="button" className="entry-modal-close" onClick={closeEntryModal} aria-label="close">
          ×
        </button>
        <p className="entry-modal-title">come in</p>
        <p className="entry-modal-sub">return to your view, or look around before you connect anything.</p>
        <Link href="/signin" className="entry-modal-btn" style={{ display: "block", textDecoration: "none" }}>
          <span>i have been here</span>
          <span className="entry-modal-btn-sub">return to the view you already built</span>
        </Link>
        <Link href="/join" className="entry-modal-btn" style={{ display: "block", textDecoration: "none" }}>
          <span>this is my first time</span>
          <span className="entry-modal-btn-sub">nothing connects until you choose it</span>
        </Link>
      </div>
    </div>
  );
}

// Constellation Example Component
function ConstellationExample() {
  return (
    <div className="const-example" id="constExample">
      <p className="const-example-label">the same seven, seen by time</p>
      <div className="const-example-axis" id="cxAxis" role="tablist" aria-label="the seven points"></div>
      <div className="const-example-body" id="cxBody">
        <p className="const-example-q" id="cxQ"></p>
        <p className="const-example-what" id="cxWhat"></p>
        <div className="cx-star" id="cxStar" style={{ display: "none" }}></div>
        <div className="const-example-rows" id="cxRows"></div>
        <p className="const-example-obs" id="cxObs"></p>
      </div>
      <p className="const-example-note">an example. yours is built only from the accounts you connect.</p>
    </div>
  );
}

// Polaris Card Component
function PolarisCard() {
  return (
    <div className="usecase-card">
      <div className="usecase-qa" id="usecaseQA">
        <p className="usecase-qa-pillar" id="qaPillar">
          convergence
        </p>
        <p className="usecase-chat-q" id="qaQ">
          "am i moving as fast as i think i am?"
        </p>
        <p className="usecase-chat-a" id="qaA">
          you tend to describe the work as fast, but what you save and return to has slowed steadily across <b>three years</b>,
          on both accounts.
        </p>
        <div className="usecase-qa-meta" id="qaMeta">
          <span className="usecase-qa-dot"></span>
          <span id="qaSrc1">spotify</span>
          <span className="usecase-qa-dot"></span>
          <span id="qaSrc2">pinterest</span>
          <span className="usecase-qa-span" id="qaSpan">
            3 years / 2 sources
          </span>
        </div>
      </div>
      <div className="usecase-qa-dots" id="qaDots"></div>
    </div>
  );
}
