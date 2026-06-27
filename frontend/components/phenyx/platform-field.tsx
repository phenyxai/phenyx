"use client";

import { useEffect, useRef } from "react";
import { useSessionColor } from "@/contexts/session-color-context";

/**
 * Floating platform icons for the "who are you, really?" section. Ported from
 * the reference `s0PlatformField`: 6 platform icons spawn into a 3x2 grid,
 * stagger in, drift gently within their own cell, and respawn a different icon
 * elsewhere on hover. Icons are recolored to the session color. Hidden on
 * mobile. Boxes are created imperatively, so base/hover styling is applied
 * inline (styled-jsx class scoping does not reach dynamically-created nodes).
 */

const CARD_BG = "#121212";

function buildIcons(color: string): Record<string, string> {
  // reference SVGs use #9DBCEF for the icon color and var(--card) for cutouts
  return {
    linkedin: `<svg viewBox="0 0 24 24" fill="${color}"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.119 20.452H3.554V9h3.565v11.452Z"/></svg>`,
    instagram: `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="${color}" stroke="none"/></svg>`,
    pinterest: `<svg viewBox="0 0 24 24" fill="${color}"><path d="M12.017 0C5.396 0 0 5.396 0 12.017c0 5.054 3.163 9.358 7.621 11.087-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.404 2.562-5.404 5.207 0 1.034.397 2.143.893 2.749a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.749-1.378 0 0-.598 2.282-.744 2.84-.282 1.084-1.064 2.456-1.549 3.235C9.584 23.864 10.776 24 12.017 24 18.638 24 24 18.638 24 12.017 24 5.396 18.638 0 12.017 0z"/></svg>`,
    x: `<svg viewBox="0 0 24 24" fill="${color}"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.045 4.126H5.078z"/></svg>`,
    spotify: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${color}"/><path d="M6.8 9.2c3.6-1.1 8.4-.7 11.1 1.1" stroke="${CARD_BG}" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M7.4 12.4c3-.9 7-.55 9.3.95" stroke="${CARD_BG}" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M8 15.3c2.3-.65 5.3-.4 7 .75" stroke="${CARD_BG}" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>`,
    youtube: `<svg viewBox="0 0 24 24"><rect x="2" y="5.5" width="20" height="13" rx="4.2" fill="${color}"/><path d="M10 9.2l6 2.8-6 2.8z" fill="${CARD_BG}"/></svg>`,
  };
}

export function PlatformField() {
  const { sessionColor } = useSessionColor();
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    const ICONS = buildIcons(sessionColor || "#B9D5FF");
    const KEYS = Object.keys(ICONS);
    const activeKeys = new Set<string>();

    const GRID_COLS = 3;
    const GRID_ROWS = 2;
    const occupiedCells = new Set<number>();

    let mounted = true;
    const rafIds = new Set<number>();
    const timeoutIds = new Set<ReturnType<typeof setTimeout>>();
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    function rand(min: number, max: number) {
      return min + Math.random() * (max - min);
    }

    function pickUnusedKey() {
      const available = KEYS.filter((k) => !activeKeys.has(k));
      if (available.length === 0) return null;
      return available[Math.floor(Math.random() * available.length)];
    }

    function pickFreeCell() {
      const all: number[] = [];
      for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++) all.push(r * GRID_COLS + c);
      const free = all.filter((idx) => !occupiedCells.has(idx));
      if (free.length === 0) return null;
      return free[Math.floor(Math.random() * free.length)];
    }

    function cellToPosition(cellIdx: number, fw: number, fh: number) {
      const col = cellIdx % GRID_COLS;
      const row = Math.floor(cellIdx / GRID_COLS);
      const cellW = fw / GRID_COLS;
      const cellH = fh / GRID_ROWS;
      const pad = 8;
      const maxX = Math.max(0, cellW - 64 - pad * 2);
      const maxY = Math.max(0, cellH - 64 - pad * 2);
      const x = col * cellW + pad + rand(0, maxX);
      const y = row * cellH + pad + rand(0, maxY);
      return { x, y };
    }

    function spawnBox(): HTMLDivElement | null {
      if (!mounted) return null;
      const key = pickUnusedKey();
      if (!key) return null;
      const cellIdx = pickFreeCell();
      if (cellIdx === null) return null;

      activeKeys.add(key);
      occupiedCells.add(cellIdx);

      const box = document.createElement("div");
      box.innerHTML = ICONS[key];
      // base styling (reference .s0-pbox)
      box.style.position = "absolute";
      box.style.width = "64px";
      box.style.height = "64px";
      box.style.border = "1px solid #2e2e2e";
      box.style.borderRadius = "14px";
      box.style.background = CARD_BG;
      box.style.display = "flex";
      box.style.alignItems = "center";
      box.style.justifyContent = "center";
      box.style.cursor = "pointer";
      box.style.transition =
        "opacity 1.1s ease, border-color .3s ease, box-shadow .3s ease";
      box.style.willChange = "opacity";
      const svgEl = box.querySelector("svg");
      if (svgEl) {
        svgEl.style.width = "26px";
        svgEl.style.height = "26px";
        svgEl.style.opacity = "0.75";
        svgEl.style.transition = "opacity .3s ease";
      }

      const fw = field!.clientWidth || 320;
      const fh = field!.clientHeight || 420;
      const pos = cellToPosition(cellIdx, fw, fh);
      const startX = pos.x;
      const startY = pos.y;
      box.style.left = startX + "px";
      box.style.top = startY + "px";
      box.style.opacity = "0";
      field!.appendChild(box);

      if (reduceMotion) {
        // static render: no fade, no drift, no hover respawn
        box.style.transition = "none";
        box.style.opacity = "0.85";
        return box;
      }

      const fadeInRaf = requestAnimationFrame(() => {
        box.style.opacity = "0.85";
      });
      rafIds.add(fadeInRaf);

      const col = cellIdx % GRID_COLS;
      const row = Math.floor(cellIdx / GRID_COLS);
      const baseX = startX;
      const baseY = startY;
      const driftSpeedX = rand(0.00025, 0.00045);
      const driftSpeedY = rand(0.0005, 0.0008);
      const phaseX = rand(0, Math.PI * 2);
      const phaseY = rand(0, Math.PI * 2);
      let alive = true;

      function drift(t: number) {
        if (!alive || !mounted) return;
        const fw2 = field!.clientWidth || fw;
        const fh2 = field!.clientHeight || fh;
        const cellW = fw2 / GRID_COLS;
        const cellH = fh2 / GRID_ROWS;
        const cellMinX = col * cellW + 4;
        const cellMaxX = (col + 1) * cellW - 64 - 4;
        const cellMinY = row * cellH + 4;
        const cellMaxY = (row + 1) * cellH - 64 - 4;
        const driftAmpX = Math.min(42, Math.max(8, (cellMaxX - cellMinX) / 2 - 6));
        const driftAmpY = Math.min(12, Math.max(4, (cellMaxY - cellMinY) / 2 - 6));
        let x = baseX + Math.sin(t * driftSpeedX + phaseX) * driftAmpX;
        let y = baseY + Math.sin(t * driftSpeedY + phaseY) * driftAmpY;
        x = Math.max(cellMinX, Math.min(cellMaxX, x));
        y = Math.max(cellMinY, Math.min(cellMaxY, y));
        box.style.left = x + "px";
        box.style.top = y + "px";
        const id = requestAnimationFrame(drift);
        rafIds.add(id);
      }
      const driftId = requestAnimationFrame(drift);
      rafIds.add(driftId);

      box.addEventListener("mouseenter", function () {
        if (!alive || !mounted) return;
        alive = false;
        box.style.borderColor = sessionColor;
        box.style.boxShadow = `0 0 24px ${sessionColor}30`;
        box.style.transition = "opacity 1.1s ease";
        box.style.opacity = "0";
        activeKeys.delete(key);
        occupiedCells.delete(cellIdx);
        const tid = setTimeout(() => {
          box.remove();
          spawnBox();
        }, 1100);
        timeoutIds.add(tid);
      });

      return box;
    }

    KEYS.forEach((_, i) => {
      const tid = setTimeout(() => spawnBox(), reduceMotion ? 0 : i * 220);
      timeoutIds.add(tid);
    });

    return () => {
      mounted = false;
      rafIds.forEach((id) => cancelAnimationFrame(id));
      timeoutIds.forEach((id) => clearTimeout(id));
      if (field) field.innerHTML = "";
    };
  }, [sessionColor]);

  return (
    <div
      ref={fieldRef}
      aria-hidden="true"
      className="max-lg:hidden relative w-full overflow-hidden"
      style={{ height: "420px" }}
    />
  );
}
