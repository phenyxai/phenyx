'use client'

import { useEffect, useRef } from 'react'

// PHE-6: the hero particle field. ~30 periwinkle particles drift ambiently
// around fixed "home" positions and loosely gather toward the cursor when it
// enters the field. Colour is the spec'd periwinkle (#9DBCEF), independent of
// the session/stellar colour — this is a fixed ambient treatment behind the
// hero, not a per-user accent. The whole field is decorative (aria-hidden on
// the host wrapper) so it carries no semantic weight.

const PARTICLE_COUNT = 30
const PARTICLE_RGB = '157,188,239' // #9DBCEF periwinkle
const GATHER_RADIUS = 260
const GATHER_STRENGTH = 0.05
const RETURN_STRENGTH = 0.025
// Below this width (and on coarse pointers) we skip cursor-follow entirely.
const CURSOR_FOLLOW_MIN_WIDTH = 780

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

interface Particle {
  // Home is stored as a fraction of the field so it survives resizes.
  fx: number
  fy: number
  homeX: number
  homeY: number
  x: number
  y: number
  r: number
  alpha: number
  driftPhase: number
  driftSpeed: number
  driftAmpX: number
  driftAmpY: number
  // Per-particle lag so the cursor trail is loose rather than uniform.
  gatherLag: number
}

interface IdentityParticlesProps {
  prefersReducedMotion?: boolean
}

export function IdentityParticles({ prefersReducedMotion = false }: IdentityParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = 0
    let H = 0

    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      fx: Math.random(),
      fy: Math.random(),
      homeX: 0,
      homeY: 0,
      x: 0,
      y: 0,
      r: rand(1.1, 2.6),
      alpha: rand(0.25, 0.7),
      driftPhase: Math.random() * Math.PI * 2,
      driftSpeed: rand(0.4, 1.1),
      driftAmpX: rand(8, 22),
      driftAmpY: rand(6, 16),
      gatherLag: rand(0.6, 1.4),
    }))

    const syncHomes = () => {
      for (const p of particles) {
        p.homeX = p.fx * W
        p.homeY = p.fy * H
      }
    }

    const resize = () => {
      W = canvas.clientWidth
      H = canvas.clientHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      // Draw in CSS pixels; the backing store handles device-pixel scaling.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      syncHomes()
    }

    resize()
    for (const p of particles) {
      p.x = p.homeX
      p.y = p.homeY
    }

    const drawStatic = () => {
      ctx.clearRect(0, 0, W, H)
      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.homeX, p.homeY, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${PARTICLE_RGB},${p.alpha})`
        ctx.fill()
      }
    }

    // Reduced motion: render a single static scatter, no RAF, no listeners.
    if (prefersReducedMotion) {
      drawStatic()
      const ro = new ResizeObserver(() => {
        resize()
        drawStatic()
      })
      ro.observe(canvas)
      return () => ro.disconnect()
    }

    // Cursor-follow is skipped on coarse pointers and narrow viewports.
    const canFollow =
      window.matchMedia('(pointer: fine)').matches &&
      window.innerWidth > CURSOR_FOLLOW_MIN_WIDTH

    let mouse: { x: number; y: number } | null = null
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const onLeave = () => {
      mouse = null
    }

    if (canFollow) {
      canvas.addEventListener('mousemove', onMove)
      canvas.addEventListener('mouseleave', onLeave)
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(canvas)

    let raf = 0
    const start = performance.now()

    const tick = (now: number) => {
      const t = (now - start) / 1000
      ctx.clearRect(0, 0, W, H)

      for (const p of particles) {
        // Ambient target: gentle sine/cosine orbit around the home position.
        let targetX = p.homeX + Math.sin(t * p.driftSpeed + p.driftPhase) * p.driftAmpX
        let targetY = p.homeY + Math.cos(t * p.driftSpeed + p.driftPhase) * p.driftAmpY
        let strength = RETURN_STRENGTH

        if (mouse) {
          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const dist = Math.hypot(dx, dy)
          if (dist < GATHER_RADIUS) {
            // Within gather range: ease toward the cursor with per-particle lag.
            targetX = mouse.x
            targetY = mouse.y
            strength = GATHER_STRENGTH * p.gatherLag
          }
        }

        p.x += (targetX - p.x) * strength
        p.y += (targetY - p.y) * strength

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${PARTICLE_RGB},${p.alpha})`
        ctx.fill()
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [prefersReducedMotion])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
}
