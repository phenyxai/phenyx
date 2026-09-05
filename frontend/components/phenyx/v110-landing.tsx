"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HeroStarfield } from "./hero-starfield";
import { IdentityParticles } from "./identity-particles";
import { PlatformField } from "./platform-field";
import { ConstellationExample } from "./constellation-example";
import "@/styles/v110-landing.css";

interface V110LandingProps {
  onScroll?: () => void;
}

export function V110Landing({ onScroll }: V110LandingProps) {
  const router = useRouter();
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isNavDropdownOpen, setIsNavDropdownOpen] = useState(false);
  const [currentQAIndex, setCurrentQAIndex] = useState(0);

  const openEntryModal = () => setIsEntryModalOpen(true);
  const closeEntryModal = () => setIsEntryModalOpen(false);
  const toggleLandingNavMenu = () => setIsNavDropdownOpen(!isNavDropdownOpen);
  const closeLandingNavMenu = () => setIsNavDropdownOpen(false);

  const smoothScrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    return false;
  };

  // Nav menu button visibility on mobile
  useEffect(() => {
    const btn = document.getElementById("landingNavMenuBtn");
    const navLinks = document.querySelector(".landing-nav-links");
    if (btn && navLinks) {
      const checkResize = () => {
        const needsMobile = window.innerWidth < 900;
        btn.style.display = needsMobile ? "flex" : "none";
      };
      checkResize();
      window.addEventListener("resize", checkResize);
      return () => window.removeEventListener("resize", checkResize);
    }
  }, []);

  // Platform field animation
  useEffect(() => {
    const field = document.getElementById("s0PlatformField");
    if (!field) return;

    const platforms: Array<{ name: string; label: string; icon: string; viewBox: string; bg?: boolean; stroke?: boolean; circle?: boolean }> = [
      { name: "spotify", label: "Spotify", icon: "M16.9 16.35a.62.62 0 0 1-.86.21c-2.35-1.44-5.3-1.76-8.79-.96a.62.62 0 1 1-.28-1.21c3.81-.87 7.08-.5 9.72 1.11.29.18.38.56.21.85ZM18.2 13.44a.78.78 0 0 1-1.07.26c-2.69-1.65-6.79-2.13-9.97-1.17a.78.78 0 1 1-.45-1.49c3.63-1.1 8.15-.56 11.24 1.33.36.23.48.7.25 1.07ZM18.31 10.42c-3.23-1.92-8.55-2.09-11.63-1.16a.93.93 0 1 1-.54-1.79c3.54-1.07 9.42-.87 13.13 1.34a.93.93 0 1 1-.96 1.61Z", viewBox: "0 0 24 24", bg: true },
      { name: "youtube", label: "YouTube", icon: "M21.58 7.19a2.51 2.51 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.81.42a2.51 2.51 0 0 0-1.77 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81a2.51 2.51 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.81-.42a2.51 2.51 0 0 0 1.77-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81ZM10 15.02 15.2 12 10 8.98v6.04Z", viewBox: "0 0 24 24" },
      { name: "instagram", label: "Instagram", icon: "M3 3h18v18H3V3zm0 0", viewBox: "0 0 24 24", stroke: true, circle: true },
      { name: "pinterest", label: "Pinterest", icon: "M12 2.2a9.8 9.8 0 0 0-3.57 18.93c-.03-.78 0-1.74.2-2.58l1.03-4.39s-.26-.52-.26-1.3c0-1.22.7-2.13 1.58-2.13.74 0 1.1.56 1.1 1.22 0 .74-.47 1.86-.71 2.9-.2.88.44 1.59 1.3 1.59 1.56 0 2.61-2 2.61-4.36 0-1.8-1.22-3.16-3.44-3.16-2.5 0-4.06 1.87-4.06 3.95 0 .72.21 1.22.53 1.61.15.18.17.25.12.45l-.17.69c-.06.22-.25.3-.46.22-1.28-.52-1.88-1.92-1.88-3.48 0-2.58 2.18-5.67 6.48-5.67 3.45 0 5.71 2.5 5.71 5.17 0 3.53-1.96 6.15-4.86 6.15-.97 0-1.87-.52-2.18-1.11l-.6 2.31c-.22.83-.64 1.8-1.03 2.5.78.24 1.61.37 2.47.37a9.8 9.8 0 1 0 0-19.6Z", viewBox: "0 0 24 24" },
      { name: "github", label: "GitHub", icon: "M12 2.2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.11-1.46-1.11-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.93 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.8c.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.83-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.75c0 .27.18.58.69.48A10 10 0 0 0 12 2.2Z", viewBox: "0 0 24 24" },
      { name: "strava", label: "Strava", icon: "M9.6 2 3.4 14.1h3.7L9.6 9l2.5 5.1h3.6L9.6 2ZM16.1 14.1 14.5 17l-1.6-2.9h-2.6L14.5 22l4.2-7.9h-2.6Z", viewBox: "0 0 24 24" },
    ];

    const w = field.offsetWidth;
    const h = field.offsetHeight;
    const boxes = platforms.map((p, i) => {
      const box = document.createElement("div");
      box.className = "s0-pbox";
      box.style.opacity = "0";
      box.style.left = `${Math.random() * (w - 64)}px`;
      box.style.top = `${Math.random() * (h - 64)}px`;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", p.viewBox);
      svg.setAttribute("aria-label", p.label);
      
      if (p.bg) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "12");
        circle.setAttribute("r", "10");
        circle.setAttribute("fill", "currentColor");
        svg.appendChild(circle);
      }

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      if (p.stroke) {
        path.setAttribute("d", "M3 3h18v18H3V3z");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "1.7");
        path.setAttribute("stroke-linecap", "round");
        if (p.circle) {
          const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          c.setAttribute("cx", "12");
          c.setAttribute("cy", "12");
          c.setAttribute("r", "3.9");
          c.setAttribute("stroke", "currentColor");
          c.setAttribute("stroke-width", "1.7");
          c.setAttribute("fill", "none");
          svg.appendChild(c);
          const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          dot.setAttribute("cx", "17.1");
          dot.setAttribute("cy", "6.9");
          dot.setAttribute("r", "1.15");
          dot.setAttribute("fill", "currentColor");
          svg.appendChild(dot);
        }
      } else {
        path.setAttribute("d", p.icon);
        path.setAttribute("fill", p.bg ? "#080808" : "currentColor");
      }
      svg.appendChild(path);
      box.appendChild(svg);
      field.appendChild(box);
      return box;
    });

    setTimeout(() => {
      boxes.forEach((b, i) => {
        setTimeout(() => {
          b.style.opacity = "1";
        }, i * 120);
      });
    }, 300);

    return () => {
      boxes.forEach((b) => field.removeChild(b));
    };
  }, []);

  // How signal path animation
  useEffect(() => {
    const path = document.getElementById("howSignalPath");
    const list = document.getElementById("howSignalList");
    if (!path || !list) return;

    const items = Array.from(list.querySelectorAll<HTMLSpanElement>("span"));
    const w = list.offsetWidth;
    const h = list.offsetHeight;

    const points = items.map((item) => {
      const nyStr = item.style.getPropertyValue("--ny");
      const nxStr = item.style.getPropertyValue("--nx");
      const ny = parseFloat(nyStr || "0.5");
      const nx = parseFloat(nxStr || "0.5");
      return { x: nx * w, y: ny * h };
    });

    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const cpDist = Math.min(dist * 0.4, 60);
      d += ` C${prev.x + dx * 0.5},${prev.y - cpDist} ${curr.x - dx * 0.5},${curr.y - cpDist} ${curr.x},${curr.y}`;
    }

    path.innerHTML = `<path d="${d}" fill="none" stroke="rgba(136,170,238,0.2)" stroke-width="1" />`;
  }, []);

  // Main constellation canvas
  useEffect(() => {
    const canvas = document.getElementById("mainConstellation") as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w;
    canvas.height = h;

    const points = [
      { name: "origin", x: 0.12, y: 0.88 },
      { name: "emergence", x: 0.37, y: 0.87 },
      { name: "self-creation", x: 0.18, y: 0.47 },
      { name: "convergence", x: 0.38, y: 0.52 },
      { name: "becoming", x: 0.61, y: 0.48 },
      { name: "recognition", x: 0.80, y: 0.39 },
      { name: "transcendence", x: 0.88, y: 0.12 },
    ];

    const lines = [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [4, 5], [5, 6]];

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,253,253,0.16)";
    ctx.lineWidth = 1;

    lines.forEach(([from, to]) => {
      ctx.beginPath();
      ctx.moveTo(points[from].x * w, points[from].y * h);
      ctx.lineTo(points[to].x * w, points[to].y * h);
      ctx.stroke();
    });

    ctx.fillStyle = "rgba(136,170,238,0.75)";
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    const hoverName = document.getElementById("constHoverName");
    let currentHover = -1;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      let found = -1;
      for (let i = 0; i < points.length; i++) {
        const px = points[i].x * w;
        const py = points[i].y * h;
        const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
        if (dist < 20) {
          found = i;
          break;
        }
      }

      if (found !== currentHover) {
        currentHover = found;
        if (hoverName) {
          if (found >= 0) {
            hoverName.textContent = points[found].name;
            hoverName.style.opacity = "1";
          } else {
            hoverName.style.opacity = "0";
          }
        }
      }

      canvas.style.cursor = found >= 0 ? "pointer" : "default";
    };

    canvas.addEventListener("mousemove", onMove);
    return () => canvas.removeEventListener("mousemove", onMove);
  }, []);

  // Polaris QA cycling
  useEffect(() => {
    const examples = [
      {
        pillar: "convergence",
        question: '"am i moving as fast as i think i am?"',
        answer: "you tend to describe the work as fast, but what you save and return to has slowed steadily across <b>three years</b>, on both accounts.",
        src1: "spotify",
        src2: "pinterest",
        span: "3 years / 2 sources",
      },
      {
        pillar: "becoming",
        question: '"is there any warning before something shifts in me?"',
        answer: "yes. what you listen to drops in tempo about <b>nine days</b> before you go quiet. it has held 14 of the last 17 times.",
        src1: "spotify",
        src2: "instagram",
        span: "17 releases / 3 years",
      },
      {
        pillar: "origin",
        question: '"what was actually going on with me in 2019?"',
        answer: "march 2019 is where it turns. shoegaze fell from 40% of your listening to under 3%, and what replaced it is what you still play today.",
        src1: "spotify",
        src2: "pinterest",
        span: "march 2019 / 11 years",
      },
    ];

    const interval = setInterval(() => {
      setCurrentQAIndex((prev) => (prev + 1) % examples.length);
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  const examples = [
    {
      pillar: "convergence",
      question: '"am i moving as fast as i think i am?"',
      answer: "you tend to describe the work as fast, but what you save and return to has slowed steadily across <b>three years</b>, on both accounts.",
      src1: "spotify",
      src2: "pinterest",
      span: "3 years / 2 sources",
    },
    {
      pillar: "becoming",
      question: '"is there any warning before something shifts in me?"',
      answer: "yes. what you listen to drops in tempo about <b>nine days</b> before you go quiet. it has held 14 of the last 17 times.",
      src1: "spotify",
      src2: "instagram",
      span: "17 releases / 3 years",
    },
    {
      pillar: "origin",
      question: '"what was actually going on with me in 2019?"',
      answer: "march 2019 is where it turns. shoegaze fell from 40% of your listening to under 3%, and what replaced it is what you still play today.",
      src1: "spotify",
      src2: "pinterest",
      span: "march 2019 / 11 years",
    },
  ];

  const currentExample = examples[currentQAIndex];

  return (
    <div className="scr landing-scr on" id="s0" style={{ position: "fixed", inset: 0, top: 0, overflowY: "auto", zIndex: 10, justifyContent: "initial", alignItems: "initial" }}>
      <nav className="landing-nav">
        <a href="#s0-top" className="landing-nav-logo" onClick={() => { smoothScrollTo("s0-top"); return false; }}>
          <img
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3CradialGradient id='g'%3E%3Cstop offset='.45' stop-color='%23B9D5FF'/%3E%3Cstop offset='.62' stop-color='%236E8FD0' stop-opacity='.5'/%3E%3Cstop offset='1' stop-color='%236E8FD0' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='32' cy='32' r='32' fill='url(%23g)'/%3E%3Ccircle cx='32' cy='32' r='17' fill='%23B9D5FF'/%3E%3C/svg%3E"
            alt=""
            className="landing-nav-dot-img"
            style={{ width: 18, height: 18, borderRadius: "50%", display: "block" }}
          />
          <span className="landing-nav-word">PHENYX</span>
        </a>
        <div className="landing-nav-links">
          <a href="#s0-about" className="landing-nav-link" onClick={() => { smoothScrollTo("s0-about"); return false; }}>
            first look
          </a>
          <a href="#s0-how" className="landing-nav-link" onClick={() => { smoothScrollTo("s0-how"); return false; }}>
            how it works
          </a>
          <a href="#s0-mission" className="landing-nav-link" onClick={() => { smoothScrollTo("s0-mission"); return false; }}>
            your constellation
          </a>
          <a href="#s0-polaris" className="landing-nav-link" onClick={() => { smoothScrollTo("s0-polaris"); return false; }}>
            polaris
          </a>
        </div>
        <button type="button" className="landing-nav-enter" onClick={openEntryModal}>
          enter
        </button>
        <button
          type="button"
          className={`landing-nav-menu-btn ${isNavDropdownOpen ? "open" : ""}`}
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

      <div className={`landing-nav-dropdown ${isNavDropdownOpen ? "show" : ""}`} id="landingNavDropdown">
        <a
          href="#s0-about"
          className="landing-nav-dd-link"
          onClick={() => { closeLandingNavMenu(); smoothScrollTo("s0-about"); return false; }}
        >
          first look
        </a>
        <a
          href="#s0-how"
          className="landing-nav-dd-link"
          onClick={() => { closeLandingNavMenu(); smoothScrollTo("s0-how"); return false; }}
        >
          how it works
        </a>
        <a
          href="#s0-mission"
          className="landing-nav-dd-link"
          onClick={() => { closeLandingNavMenu(); smoothScrollTo("s0-mission"); return false; }}
        >
          your constellation
        </a>
        <a
          href="#s0-polaris"
          className="landing-nav-dd-link"
          onClick={() => { closeLandingNavMenu(); smoothScrollTo("s0-polaris"); return false; }}
        >
          polaris
        </a>
        <a
          href="#"
          className="landing-nav-dd-link landing-nav-dd-enter"
          onClick={() => { closeLandingNavMenu(); openEntryModal(); return false; }}
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
          <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <IdentityParticles />
          </div>
          <div className="hero-particles" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            <HeroStarfield />
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
              <p className="s2-sub">every place you use asks for one part of you: the listener, the maker, the one who saves things for later.</p>
              <p className="s2-sub s2-sub-mid">each one keeps a version of you that is true, but not one shows what it all adds up to.</p>
              <p className="s2-sub s2-sub-mid">so there has never been one place that holds all of you at once. every moment came from the same life, but nothing has ever gathered them in the same place.</p>
              <p className="section-thesis">so we made one.</p>
            </div>
            <div className="s0-platform-field" id="s0PlatformField"></div>
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
                <p className="how-chart-copy">what you listen to, watch, save, post and build, from only the places you choose.</p>
              </article>
              <article className="how-step-card">
                <p className="how-chart-kicker">layer two</p>
                <h3 className="how-chart-title">assemble</h3>
                <p className="how-chart-copy">everything lands on one timeline, so repeats and shifts finally sit next to each other.</p>
              </article>
              <article className="how-step-card">
                <p className="how-chart-kicker">layer three</p>
                <h3 className="how-chart-title">reveal</h3>
                <p className="how-chart-copy">the shape no single account could show, with the moments and evidence that made it visible.</p>
              </article>
            </div>

            <article className="how-system-bottom how-band">
              <div className="how-band-part how-band-part--signals">
                <p className="how-signal-label">what comes into view</p>
                <div className="how-signal-list" id="howSignalList">
                  <svg className="how-signal-path" id="howSignalPath" aria-hidden="true"></svg>
                  <span style={{ "--ny": 0.62, "--ns": "5px", "--nx": 0 } as React.CSSProperties}>
                    <i className="sig-node"></i>what keeps returning
                  </span>
                  <span style={{ "--ny": 0.24, "--ns": "4px", "--nx": 1 } as React.CSSProperties}>
                    <i className="sig-node"></i>what overlaps
                  </span>
                  <span style={{ "--ny": 0.80, "--ns": "4.5px", "--nx": 0.42 } as React.CSSProperties}>
                    <i className="sig-node"></i>creative rhythms
                  </span>
                  <span style={{ "--ny": 0.30, "--ns": "5.5px", "--nx": 1 } as React.CSSProperties}>
                    <i className="sig-node"></i>turning points
                  </span>
                  <span style={{ "--ny": 0.12, "--ns": "4px", "--nx": 0.28 } as React.CSSProperties}>
                    <i className="sig-node"></i>how you decide
                  </span>
                  <span style={{ "--ny": 0.54, "--ns": "5px", "--nx": 0.86 } as React.CSSProperties}>
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
              <p className="identity-copy-second">seven points run from where you began to where you are heading, each looking at one question through <span className="no-wrap">the evidence of your life.</span></p>
              <p className="identity-copy-second">it is not a profile you finish. new things appear, old ones return, some fall away, and the shape keeps enough of you to notice when you change.</p>
              <p className="section-thesis">the points stay the same. what fills them is yours.</p>
            </div>
            <div className="identity-visual">
              <div className="identity-stack" role="img" aria-label="Seven-point constellation: origin, emergence, self-creation, convergence, becoming, recognition, and transcendence. Each point reflects a different part of your life across time.">
                <canvas id="mainConstellation" aria-hidden="true" style={{ width: "100%", height: "400px" }}></canvas>
                <p className="const-hover-name" id="constHoverName" aria-live="polite" style={{ opacity: 0, textAlign: "center", marginTop: "10px", fontSize: "13px", color: "rgba(255,253,253,0.6)" }}></p>
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
                <b className="pol-pair">the constellation lets you see yourself. polaris lets you use what you see.</b> ask about something you keep returning to, or where it might be leading. polaris answers from the context already here, so you never start by explaining yourself.
              </p>
              <p className="usecase-lead polaris-observations">and when you arrive with no question, a few things come forward on their own.</p>
              <p className="section-thesis polaris-thesis">you bring the question. the context is already here.</p>
            </div>
            <div className="usecase-card">
              <div className="usecase-qa" id="usecaseQA">
                <p className="usecase-qa-pillar" id="qaPillar">{currentExample.pillar}</p>
                <p className="usecase-chat-q" id="qaQ">{currentExample.question}</p>
                <p className="usecase-chat-a" id="qaA" dangerouslySetInnerHTML={{ __html: currentExample.answer }}></p>
                <div className="usecase-qa-meta" id="qaMeta">
                  <span className="usecase-qa-dot"></span>
                  <span id="qaSrc1">{currentExample.src1}</span>
                  <span className="usecase-qa-dot"></span>
                  <span id="qaSrc2">{currentExample.src2}</span>
                  <span className="usecase-qa-span" id="qaSpan">{currentExample.span}</span>
                </div>
              </div>
              <div className="usecase-qa-dots" id="qaDots">
                {examples.map((_, i) => (
                  <span
                    key={i}
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: i === currentQAIndex ? "rgba(136,170,238,0.8)" : "rgba(255,253,253,0.2)",
                      display: "inline-block",
                      margin: "0 4px",
                    }}
                  ></span>
                ))}
              </div>
            </div>
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
            <a href="/privacy-policy" className="footer-link">
              privacy
            </a>
            <a href="/terms" className="footer-link">
              terms
            </a>
            <a href="mailto:contact@phenyxai.com" className="footer-link">
              contact@phenyxai.com
            </a>
          </div>
        </div>
        <span className="footer-meta">© 2026 PHENYX INC.</span>
      </footer>

      {isEntryModalOpen && (
        <>
          <div className="entry-modal-overlay" id="entryModalOverlay" onClick={closeEntryModal}></div>
          <div className="entry-modal" id="entryModal">
            <button type="button" className="entry-modal-close" onClick={closeEntryModal} aria-label="close">
              ×
            </button>
            <p className="entry-modal-title">come in</p>
            <p className="entry-modal-sub">return to your view, or look around before you connect anything.</p>
            <button
              type="button"
              className="entry-modal-btn"
              onClick={() => {
                closeEntryModal();
                router.push("/signin");
              }}
            >
              <span>i have been here</span>
              <span className="entry-modal-btn-sub">return to the view you already built</span>
            </button>
            <button
              type="button"
              className="entry-modal-btn"
              onClick={() => {
                closeEntryModal();
                router.push("/join");
              }}
            >
              <span>this is my first time</span>
              <span className="entry-modal-btn-sub">nothing connects until you choose it</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
