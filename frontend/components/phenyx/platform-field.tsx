'use client'

import { useEffect, useRef, useState } from 'react'

// PHE-6: the floating platform-icon field for the "who are you, really?"
// section. A 3x2 grid of cells is populated with distinct platform glyphs that
// drift within their own cell, fade out on hover, and respawn as a *different*
// currently-unused platform in a free cell.
//
// Note on the icon pool: the ticket names six platforms for a six-cell grid,
// but the hover behaviour requires respawning "a different (unused) icon" —
// impossible when six icons exactly fill six cells (the only free icon at
// respawn time is the one that just left). We add one extra on-brand platform
// (tiktok, referenced throughout the landing copy) so the pool (7) always
// exceeds the cell count (6), guaranteeing a genuinely different respawn.
//
// Everything here is decorative: the host wrapper is aria-hidden.

const ICON_COLOR = '#9DBCEF'
const GRID_COLS = 3
const GRID_ROWS = 2
const CELL_COUNT = GRID_COLS * GRID_ROWS // 6
const ICON_SIZE = 54
const CELL_PADDING = 8
const DRIFT_AMP_X_MAX = 42
const DRIFT_AMP_Y_MAX = 12
const SPAWN_STAGGER_MS = 220
const FADE_OUT_MS = 1100
const FADE_IN_MS = 700

const ICON_KEYS = [
  'linkedin',
  'instagram',
  'pinterest',
  'x',
  'spotify',
  'youtube',
  'tiktok',
] as const
type IconKey = (typeof ICON_KEYS)[number]

interface Box {
  id: number
  icon: IconKey
  cell: number
  // Motion primitives are stored as seeds; pixel amplitudes/positions are
  // derived from the live cell size so a resize never breaks the layout.
  phaseX: number
  phaseY: number
  speed: number
  ampFracX: number
  ampFracY: number
  jitterFracX: number
  jitterFracY: number
  entered: boolean
  fading: boolean
}

let nextBoxId = 0

function makeSeed() {
  return {
    phaseX: Math.random() * Math.PI * 2,
    phaseY: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 0.6, // rad/sec — gentle, ~6–15s period
    ampFracX: Math.random(),
    ampFracY: Math.random(),
    jitterFracX: Math.random() * 2 - 1,
    jitterFracY: Math.random() * 2 - 1,
  }
}

// Derive a box's base (untranslated) position and drift amplitude for a given
// field size. Jitter + drift amplitude are kept within `halfFree` of the cell
// centre so an icon never crosses into a neighbouring cell.
function boxGeometry(box: Pick<Box, 'cell' | 'ampFracX' | 'ampFracY' | 'jitterFracX' | 'jitterFracY'>, w: number, h: number) {
  const col = box.cell % GRID_COLS
  const row = Math.floor(box.cell / GRID_COLS)
  const cw = w / GRID_COLS
  const ch = h / GRID_ROWS
  const halfFreeX = Math.max(0, cw / 2 - ICON_SIZE / 2 - CELL_PADDING)
  const halfFreeY = Math.max(0, ch / 2 - ICON_SIZE / 2 - CELL_PADDING)
  const ampX = Math.min(DRIFT_AMP_X_MAX, halfFreeX) * (0.35 + box.ampFracX * 0.45)
  const ampY = Math.min(DRIFT_AMP_Y_MAX, halfFreeY) * (0.35 + box.ampFracY * 0.45)
  const jitterX = box.jitterFracX * Math.max(0, halfFreeX - ampX)
  const jitterY = box.jitterFracY * Math.max(0, halfFreeY - ampY)
  const baseLeft = col * cw + cw / 2 - ICON_SIZE / 2 + jitterX
  const baseTop = row * ch + ch / 2 - ICON_SIZE / 2 + jitterY
  return { baseLeft, baseTop, ampX, ampY }
}

// Choose a free cell + an unused icon (never the icon just removed). Returns
// null when either the cells or the icon pool are exhausted.
function pickSpawn(current: Box[], excludeIcon?: IconKey): Box | null {
  const occupied = new Set(current.map((b) => b.cell))
  const active = new Set(current.map((b) => b.icon))
  const freeCells: number[] = []
  for (let c = 0; c < CELL_COUNT; c++) if (!occupied.has(c)) freeCells.push(c)
  const freeIcons = ICON_KEYS.filter((k) => !active.has(k) && k !== excludeIcon)
  if (!freeCells.length || !freeIcons.length) return null
  const cell = freeCells[Math.floor(Math.random() * freeCells.length)]
  const icon = freeIcons[Math.floor(Math.random() * freeIcons.length)]
  return { id: nextBoxId++, icon, cell, ...makeSeed(), entered: false, fading: false }
}

interface PlatformFieldProps {
  prefersReducedMotion?: boolean
}

export function PlatformField({ prefersReducedMotion = false }: PlatformFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [boxes, setBoxes] = useState<Box[]>([])

  const boxesRef = useRef<Box[]>([])
  const sizeRef = useRef(size)
  const elRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const fadingIdsRef = useRef<Set<number>>(new Set())

  // Mirror state into refs so the RAF loop and timers read live values without
  // being torn down on every render.
  useEffect(() => {
    boxesRef.current = boxes
  }, [boxes])
  useEffect(() => {
    sizeRef.current = size
  }, [size])

  // Measure the field and keep it current across layout changes.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Staggered initial populate (motion allowed only).
  useEffect(() => {
    if (prefersReducedMotion) return
    const timeouts = timeoutsRef.current
    for (let i = 0; i < CELL_COUNT; i++) {
      const t = setTimeout(() => {
        timeouts.delete(t)
        setBoxes((prev) => {
          const nb = pickSpawn(prev)
          return nb ? [...prev, nb] : prev
        })
      }, i * SPAWN_STAGGER_MS)
      timeouts.add(t)
    }
    return () => {
      timeouts.forEach(clearTimeout)
      timeouts.clear()
      fadingIdsRef.current.clear()
    }
  }, [prefersReducedMotion])

  // Fade newly-spawned icons in on the next frame (0 -> 1 opacity transition).
  useEffect(() => {
    if (prefersReducedMotion) return
    if (!boxes.some((b) => !b.entered && !b.fading)) return
    const raf = requestAnimationFrame(() => {
      setBoxes((prev) => prev.map((b) => (!b.entered && !b.fading ? { ...b, entered: true } : b)))
    })
    return () => cancelAnimationFrame(raf)
  }, [boxes, prefersReducedMotion])

  // Per-frame drift, applied via transform on each live element.
  useEffect(() => {
    if (prefersReducedMotion) return
    let raf = 0
    const start = performance.now()
    const loop = (now: number) => {
      const t = (now - start) / 1000
      const { w, h } = sizeRef.current
      if (w > 0 && h > 0) {
        for (const box of boxesRef.current) {
          if (box.fading) continue
          const el = elRefs.current.get(box.id)
          if (!el) continue
          const { ampX, ampY } = boxGeometry(box, w, h)
          const dx = Math.sin(t * box.speed + box.phaseX) * ampX
          const dy = Math.cos(t * box.speed + box.phaseY) * ampY
          el.style.transform = `translate(${dx}px, ${dy}px)`
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [prefersReducedMotion])

  const handleEnter = (id: number) => {
    if (fadingIdsRef.current.has(id)) return
    fadingIdsRef.current.add(id)
    setBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, fading: true } : b)))
    const t = setTimeout(() => {
      timeoutsRef.current.delete(t)
      fadingIdsRef.current.delete(id)
      setBoxes((prev) => {
        const removed = prev.find((b) => b.id === id)
        const remaining = prev.filter((b) => b.id !== id)
        const nb = pickSpawn(remaining, removed?.icon)
        return nb ? [...remaining, nb] : remaining
      })
    }, FADE_OUT_MS)
    timeoutsRef.current.add(t)
  }

  // Reduced motion: a static, fully-opaque 3x2 grid — no RAF, drift, or hover.
  if (prefersReducedMotion) {
    return (
      <div ref={containerRef} aria-hidden className="relative w-full h-full overflow-visible">
        {Array.from({ length: CELL_COUNT }).map((_, cell) => {
          const { baseLeft, baseTop } = boxGeometry(
            { cell, ampFracX: 0, ampFracY: 0, jitterFracX: 0, jitterFracY: 0 },
            size.w,
            size.h
          )
          return (
            <div
              key={cell}
              className="landing-vnext__platform-icon"
              style={{
                position: 'absolute',
                left: baseLeft,
                top: baseTop,
                width: ICON_SIZE,
                height: ICON_SIZE,
                color: ICON_COLOR,
              }}
            >
              <PlatformIcon icon={ICON_KEYS[cell]} />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div ref={containerRef} aria-hidden className="relative w-full h-full overflow-visible">
      {boxes.map((box) => {
        const { baseLeft, baseTop } = boxGeometry(box, size.w, size.h)
        return (
          <div
            key={box.id}
            className="landing-vnext__platform-icon"
            ref={(el) => {
              if (el) elRefs.current.set(box.id, el)
              else elRefs.current.delete(box.id)
            }}
            onMouseEnter={() => handleEnter(box.id)}
            style={{
              position: 'absolute',
              left: baseLeft,
              top: baseTop,
              width: ICON_SIZE,
              height: ICON_SIZE,
              color: ICON_COLOR,
              opacity: box.fading ? 0 : box.entered ? 1 : 0,
              transition: `opacity ${box.fading ? FADE_OUT_MS : FADE_IN_MS}ms ease`,
              willChange: 'transform, opacity',
            }}
          >
            <PlatformIcon icon={box.icon} />
          </div>
        )
      })}
    </div>
  )
}

// --- Inline platform glyphs, coloured via `currentColor` (#9DBCEF) ------------

function PlatformIcon({ icon }: { icon: IconKey }) {
  switch (icon) {
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden>
          <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
        </svg>
      )
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <rect x="2" y="2" width="20" height="20" rx="5.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'pinterest':
      return (
        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden>
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.08 3.16 9.42 7.62 11.17-.11-.95-.2-2.4.04-3.44.22-.93 1.4-5.94 1.4-5.94s-.36-.72-.36-1.78c0-1.67.97-2.92 2.17-2.92 1.02 0 1.52.77 1.52 1.69 0 1.03-.66 2.57-1 4-.28 1.2.6 2.18 1.78 2.18 2.14 0 3.78-2.26 3.78-5.51 0-2.88-2.07-4.9-5.02-4.9-3.42 0-5.43 2.56-5.43 5.21 0 1.03.4 2.14.89 2.74a.36.36 0 0 1 .08.34c-.09.37-.29 1.2-.33 1.36-.05.22-.17.27-.4.16-1.5-.7-2.43-2.89-2.43-4.65 0-3.78 2.75-7.26 7.92-7.26 4.16 0 7.39 2.96 7.39 6.92 0 4.13-2.6 7.45-6.22 7.45-1.21 0-2.35-.63-2.74-1.38l-.75 2.85c-.27 1.04-1 2.35-1.49 3.15C9.57 23.83 10.76 24 12 24c6.63 0 12-5.37 12-12S18.63 0 12 0z" />
        </svg>
      )
    case 'x':
      return (
        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden>
          <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.63 7.58H.49l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41z" />
        </svg>
      )
    case 'spotify':
      return (
        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden>
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.32a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.11-10.55-1.16a.75.75 0 1 1-.33-1.46c4.57-1.04 8.5-.59 11.66 1.34.35.22.46.68.25 1.03zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.98-8.15-2.56-11.97-1.4a.94.94 0 1 1-.55-1.8c4.37-1.33 9.79-.68 13.5 1.6.44.27.58.85.31 1.29zm.13-3.4C15.26 8.42 8.83 8.2 5.1 9.33a1.13 1.13 0 1 1-.66-2.16c4.28-1.3 11.38-1.05 15.87 1.61a1.13 1.13 0 1 1-1.15 1.94z" />
        </svg>
      )
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden>
          <path d="M23.5 6.2a3 3 0 0 0-2.11-2.13C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.39.52A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.13c1.89.52 9.39.52 9.39.52s7.5 0 9.39-.52a3 3 0 0 0 2.11-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" aria-hidden>
          <path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.3v13.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1-2.58-2.59 2.59 2.59 0 0 1 3.4-2.46V8.5a5.88 5.88 0 0 0-.82-.06A5.9 5.9 0 0 0 4 14.32a5.9 5.9 0 0 0 11.79 0V8.9a7.5 7.5 0 0 0 4.4 1.42V7.02a4.28 4.28 0 0 1-3.59-1.2z" />
        </svg>
      )
    default:
      return null
  }
}
