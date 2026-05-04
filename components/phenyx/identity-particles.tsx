'use client'

import { useEffect, useRef } from 'react'
import { useSessionColor } from '@/contexts/session-color-context'

export function IdentityParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { sessionColor } = useSessionColor()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.offsetWidth
    const H = canvas.offsetHeight
    canvas.width = W
    canvas.height = H

    const COUNT = 100
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 1 + Math.random() * 1.5,
      baseOpacity: 0.15 + Math.random() * 0.3,
      opacity: 0.15 + Math.random() * 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      pulseOffset: Math.random() * Math.PI * 2,
      pulseSpeed: 0.003 + Math.random() * 0.005,
    }))

    let mouse: { x: number; y: number } | null = null
    let animId: number

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    const onLeave = () => { mouse = null }

    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    function hexToRgb(hex: string) {
      const r = parseInt(hex.slice(1,3),16)
      const g = parseInt(hex.slice(3,5),16)
      const b = parseInt(hex.slice(5,7),16)
      return `${r},${g},${b}`
    }

    const rgb = hexToRgb(sessionColor || '#FFFDFD')

    function tick() {
      ctx!.clearRect(0, 0, W, H)

      particles.forEach(p => {
        p.pulseOffset += p.pulseSpeed
        const pulse = (Math.sin(p.pulseOffset) + 1) / 2
        
        if (mouse) {
          const dx = mouse.x - p.x
          const dy = mouse.y - p.y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 150 && dist > 20) {
            const force = (150 - dist) / 150 * 0.8
            p.vx += (dx / dist) * force * 0.1
            p.vy += (dy / dist) * force * 0.1
          }
          p.opacity = p.baseOpacity + (0.9 - p.baseOpacity) * Math.max(0, (150 - (Math.sqrt((mouse.x-p.x)**2+(mouse.y-p.y)**2))) / 150)
        } else {
          p.opacity = p.baseOpacity + pulse * 0.2
          p.vx *= 0.98
          p.vy *= 0.98
        }

        p.vx = Math.max(-1.5, Math.min(1.5, p.vx))
        p.vy = Math.max(-1.5, Math.min(1.5, p.vy))

        p.x += p.vx
        p.y += p.vy

        if (p.x < 0) p.x = W
        if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H
        if (p.y > H) p.y = 0

        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${rgb},${p.opacity})`
        ctx!.fill()
      })

      animId = requestAnimationFrame(tick)
    }

    tick()

    return () => {
      cancelAnimationFrame(animId)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [sessionColor])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
