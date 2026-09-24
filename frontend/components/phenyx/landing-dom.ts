// Small DOM helpers shared by the landing components.

// The landing scrolls inside `main.landing-vnext`, not the window. This calls
// `onFrame` once straight away and then at most once per animation frame while
// that container scrolls or the window resizes. The returned function stops
// watching and drops any frame still queued, so nothing runs after cleanup.
export function watchLandingScroll(from: Element, onFrame: (scroller: HTMLElement) => void): () => void {
  const scroller = from.closest<HTMLElement>(".landing-vnext");
  if (!scroller) return () => {};

  let frame = 0;
  const request = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      onFrame(scroller);
    });
  };
  scroller.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", request, { passive: true });
  onFrame(scroller);
  return () => {
    cancelAnimationFrame(frame);
    scroller.removeEventListener("scroll", request);
    window.removeEventListener("resize", request);
  };
}

/** Keyboard activation for elements given `role="button"` (SVG groups here). */
export function onActivateKey(activate: () => void) {
  return (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activate();
  };
}
