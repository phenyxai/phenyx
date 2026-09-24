"use client";

import { useEffect } from "react";
import { chapterOpacity } from "@/lib/landing-motion";
import { watchLandingScroll } from "./landing-dom";

// Chapters come into focus (v610 in the Sept 23 export): each landing section
// dims when it is away from the middle of the screen and brightens as it
// arrives, so the reader's eye lands on one chapter at a time. Skipped for
// reduced motion, where every chapter stays fully lit.
export function useChapterFocus(ids: readonly string[]) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chapters = ids
      .map((id) => document.getElementById(id))
      .filter((chapter): chapter is HTMLElement => Boolean(chapter));
    if (!chapters.length) return;

    chapters.forEach((chapter) => chapter.setAttribute("data-chapter", ""));
    const stop = watchLandingScroll(chapters[0], (scroller) => {
      const view = scroller.getBoundingClientRect();
      for (const chapter of chapters) {
        const rect = chapter.getBoundingClientRect();
        chapter.style.opacity = String(chapterOpacity(rect, { top: view.top, height: view.height }));
      }
    });
    return () => {
      stop();
      chapters.forEach((chapter) => {
        chapter.style.opacity = "";
        chapter.removeAttribute("data-chapter");
      });
    };
  }, [ids]);
}
