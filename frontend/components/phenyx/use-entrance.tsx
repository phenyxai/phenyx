"use client";

import { Fragment, useEffect, useState } from "react";
import { entrancePlan } from "@/lib/landing-motion";

// The entrance every landing section plays (v1800 in the Oct 4 export). Mark
// a section's parts with `data-entrance`: "eyebrow", "headline" (its words
// wrapped by `EntranceWords`), "lede" and "block". The section starts when
// its headline is 35% visible, so nothing in it shows before its heading;
// each block also waits until it is on screen. A heading already cut off at
// the top of the screen counts as passed: the section starts at once, and a
// block that arrives after it plays at once. The CSS hides the parts
// only when motion is allowed, so reduced motion shows the end state.
//
// Returns whether the section's text has landed: the gate that stories
// running on their own (the your space rail, the constellation formation)
// wait for before they start.

const HEADLINE_SHARE = 0.35;
// 0 as well, so a heading that turns up cut off at the top still reports in
const HEADLINE_SEEN = { threshold: [0, HEADLINE_SHARE], rootMargin: "0px 0px -6% 0px" };
const BLOCK_SEEN = { threshold: 0.12 };
// a block that turns up after its heading has gone plays almost at once
const LATE_BLOCK_S = 0.15;

export function useEntrance(sectionRef: React.RefObject<HTMLElement | null>): boolean {
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const headline = section?.querySelector<HTMLElement>('[data-entrance="headline"]');
    if (!section || !headline) return;
    const parts = (kind: string) => Array.from(section.querySelectorAll<HTMLElement>(`[data-entrance="${kind}"]`));
    const eyebrow = parts("eyebrow")[0];
    const ledes = parts("lede");
    const blocks = parts("block");
    const show = (el: HTMLElement, delay: number) => {
      el.style.setProperty("--d", `${Math.max(0, delay).toFixed(3)}s`);
      el.dataset.in = "true";
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      [headline, ...parts("eyebrow"), ...ledes, ...blocks].forEach((el) => show(el, 0));
      setLanded(true);
      return;
    }

    const plan = entrancePlan({
      hasEyebrow: Boolean(eyebrow),
      words: headline.querySelectorAll(".landing-vnext__word").length,
      ledes: ledes.length,
      blocks: blocks.length,
    });
    headline.style.setProperty("--hd", `${plan.headline}s`);

    let startedAt: number | null = null;
    const waiting = new Set<HTMLElement>();
    let landTimer: ReturnType<typeof setTimeout> | undefined;
    // a block plays at its planned moment after the start, or now if that has passed
    const playBlock = (block: HTMLElement, planned: number) =>
      show(block, startedAt === null ? 0 : (startedAt + planned * 1000 - performance.now()) / 1000);
    const plannedFor = (block: HTMLElement) => plan.blocks[blocks.indexOf(block)];

    const start = (headingPassed: boolean) => {
      if (startedAt !== null) return;
      startedAt = performance.now();
      headlineObserver.disconnect();
      headline.dataset.in = "true";
      if (eyebrow) show(eyebrow, 0);
      ledes.forEach((lede, i) => show(lede, plan.ledes[i]));
      waiting.forEach((block) => playBlock(block, plannedFor(block)));
      waiting.clear();
      landTimer = setTimeout(() => setLanded(true), (headingPassed ? LATE_BLOCK_S : plan.landed) * 1000);
    };

    const headlineObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      const passed = entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
      if (passed || entry.intersectionRatio >= HEADLINE_SHARE) start(passed);
    }, HEADLINE_SEEN);
    const blockObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const block = entry.target as HTMLElement;
        blockObserver.unobserve(block);
        if (headline.getBoundingClientRect().top < 0) {
          start(true);
          playBlock(block, Math.min(plannedFor(block), LATE_BLOCK_S));
        } else if (startedAt !== null) playBlock(block, plannedFor(block));
        else waiting.add(block);
      }
    }, BLOCK_SEEN);
    headlineObserver.observe(headline);
    blocks.forEach((block) => blockObserver.observe(block));

    return () => {
      headlineObserver.disconnect();
      blockObserver.disconnect();
      clearTimeout(landTimer);
    };
  }, [sectionRef]);

  return landed;
}

/** A headline's words, each in its own span so they can rise one after another. */
export function EntranceWords({ text }: { text: string }) {
  return text.split(" ").map((word, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className="landing-vnext__word" style={{ "--i": i } as React.CSSProperties}>{word}</span>
    </Fragment>
  ));
}
