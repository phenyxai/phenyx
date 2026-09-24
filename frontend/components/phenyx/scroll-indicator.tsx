"use client";

import { useEffect, useRef, useState } from "react";
import { watchLandingScroll } from "./landing-dom";

// The dot at the foot of the hero that says there is more below. It waits for
// the hero to settle before appearing and leaves as soon as the reader scrolls.

const APPEAR_AFTER_MS = 900;
const HIDE_AFTER_PX = 60;

export function ScrollIndicator() {
  const ref = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const appear = setTimeout(() => setIsReady(true), APPEAR_AFTER_MS);
    const stop = ref.current
      ? watchLandingScroll(ref.current, (scroller) => setIsScrolled(scroller.scrollTop > HIDE_AFTER_PX))
      : () => {};
    return () => {
      clearTimeout(appear);
      stop();
    };
  }, []);

  return <div ref={ref} className="landing-vnext__scroll-cue" data-visible={isReady && !isScrolled} aria-hidden="true" />;
}
