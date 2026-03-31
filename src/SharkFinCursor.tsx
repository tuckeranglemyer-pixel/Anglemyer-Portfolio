import { useEffect, useRef } from 'react'

interface SharkFinCursorProps {
  accent: string
}

// ─── SharkFinCursor ───────────────────────────────────────────────────────────
// Replaces the default cursor with a shark fin SVG on desktop.
// Features:
//   • Fin rotates to face direction of travel (lerped, ±75° clamp)
//   • Water-spray particles spawn perpendicular to movement, fade out
//   • Blood-red fin + wake while over the hero name h1
export default function SharkFinCursor({ accent }: SharkFinCursorProps) {
  const finRef          = useRef<SVGSVGElement>(null)
  const wakeRef         = useRef<SVGSVGElement>(null)
  const finPathRef      = useRef<SVGPathElement>(null)
  const particleContRef = useRef<HTMLDivElement>(null)
  const cursorRef       = useRef({ x: -200, y: -200 })  // raw cursor
  const trailRef        = useRef({ x: -200, y: -200 })  // lerped trail
  const accentRef       = useRef(accent)
  accentRef.current = accent

  useEffect(() => {
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    if (isTouch) return

    const style = document.createElement('style')
    style.textContent = '*, *::before, *::after { cursor: none !important; }'
    document.head.appendChild(style)

    const onMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY }
    }
    document.addEventListener('mousemove', onMove, { passive: true })

    // ── Lazily cached hero h1 reference ─────────────────────────────────────
    let heroEl: Element | null = null

    // ── Fin rotation state ───────────────────────────────────────────────────
    let prevX      = -200   // cursor position last tick (for velocity)
    let prevY      = -200
    let currentRot = 0      // interpolated rotation in degrees

    // ── Particle pool ────────────────────────────────────────────────────────
    type Particle = {
      el:   HTMLDivElement
      x:    number; y: number
      vx:   number; vy: number
      born: number; life: number
    }
    const particles: Particle[]  = []
    const MAX_PARTICLES          = 20
    let   lastSpawnTime          = 0

    // ── rAF loop ─────────────────────────────────────────────────────────────
    let raf: number
    function tick() {
      const fin  = finRef.current
      const wake = wakeRef.current
      const cont = particleContRef.current
      if (!fin || !wake) { raf = requestAnimationFrame(tick); return }

      const { x, y } = cursorRef.current
      const tr        = trailRef.current

      // Velocity since last tick (capped so a first-frame jump doesn't spike)
      const rawVx = x - prevX
      const rawVy = y - prevY
      // Don't treat the very first real cursor entry as motion
      const isFirstEntry = (prevX === -200 && x !== -200)
      const vx    = isFirstEntry ? 0 : rawVx
      const vy    = isFirstEntry ? 0 : rawVy
      prevX = x
      prevY = y
      const speed = Math.sqrt(vx * vx + vy * vy)

      // Lerp wake trail toward cursor
      tr.x += (x - tr.x) * 0.22
      tr.y += (y - tr.y) * 0.22

      // ── Fin rotation ────────────────────────────────────────────────────
      // atan2(vy, vx) = 0 moving right; +π/2 rotates frame so 0° = moving up.
      // Clamp to ±75° so the fin never flips fully upside-down.
      // Scale by speed so the fin stays calm at low speed.
      let targetRot = 0
      if (speed > 0.5) {
        const rawDeg = (Math.atan2(vy, vx) + Math.PI / 2) * (180 / Math.PI)
        // Normalise to [-180, 180]
        let norm = ((rawDeg % 360) + 360) % 360
        if (norm > 180) norm -= 360
        targetRot = Math.max(-75, Math.min(75, norm))
        // Ease into full tilt — at speed ≥ 8 px/frame we get the full angle
        targetRot *= Math.min(1, speed / 8)
      }

      // Lerp with shortest-path wrapping so the fin never swings the long way
      let diff = targetRot - currentRot
      if (diff >  180) diff -= 360
      if (diff < -180) diff += 360
      currentRot += diff * 0.15

      // transform-origin: 12px 0px (set in JSX) keeps the tip pinned at cursor.
      fin.style.transform  = `translate(${x - 12}px, ${y}px) rotate(${currentRot.toFixed(2)}deg)`
      wake.style.transform = `translate(${tr.x - 16}px, ${tr.y + 20}px)`

      // ── Hero name detection & color swap ────────────────────────────────
      if (!heroEl) heroEl = document.querySelector('[data-hero-name]')
      let overHero = false
      if (heroEl) {
        const r = heroEl.getBoundingClientRect()
        overHero = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
      }

      const lines   = wake.querySelectorAll('line')
      const finPath = finPathRef.current
      if (overHero) {
        lines.forEach(l => {
          l.setAttribute('stroke', '#cc0000')
          l.setAttribute('stroke-opacity', '0.4')
        })
        if (finPath) finPath.setAttribute('fill', 'rgba(255,80,80,0.75)')
      } else {
        lines.forEach(l => {
          l.setAttribute('stroke', accentRef.current)
          l.setAttribute('stroke-opacity', '0.18')
        })
        if (finPath) finPath.setAttribute('fill', 'rgba(255,255,255,0.72)')
      }

      // ── Spray particles ──────────────────────────────────────────────────
      const now = performance.now()

      // Age-out existing particles (iterate backwards so splice is safe)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p   = particles[i]
        const age = now - p.born
        if (age >= p.life) {
          p.el.remove()
          particles.splice(i, 1)
          continue
        }
        p.x += p.vx
        p.y += p.vy
        // Slight drag so they slow down naturally
        p.vx *= 0.97
        p.vy *= 0.97
        const frac = age / p.life
        p.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`
        p.el.style.opacity   = (0.3 * (1 - frac)).toFixed(3)
      }

      // Spawn: one particle per side (left + right of travel), throttled
      if (cont && speed > 2 && particles.length < MAX_PARTICLES && now - lastSpawnTime > 25) {
        lastSpawnTime = now
        // Perpendicular to direction of travel
        const nx = -vy / speed   // left  perpendicular x (normalised)
        const ny =  vx / speed   // left  perpendicular y (normalised)

        for (const side of [1, -1] as const) {
          if (particles.length >= MAX_PARTICLES) break

          const spread = 6 + Math.random() * 6   // offset from fin body
          const el     = document.createElement('div')
          // All styles in one string for minimal reflows
          el.style.cssText =
            'position:absolute;top:0;left:0;' +
            'width:3px;height:3px;border-radius:50%;' +
            'background:rgba(255,255,255,0.3);' +
            'pointer-events:none;will-change:transform,opacity;'
          cont.appendChild(el)

          const px = x + nx * spread * side
          const py = y + ny * spread * side
          // Drift: outward (perpendicular) + gently backward (opposite travel)
          const perpSpeed = 0.6 + Math.random() * 0.9
          const backSpeed = 0.2 + Math.random() * 0.3
          particles.push({
            el,
            x:  px,
            y:  py,
            vx: nx * side * perpSpeed - (vx / speed) * backSpeed,
            vy: ny * side * perpSpeed - (vy / speed) * backSpeed,
            born: now,
            life: 300 + Math.random() * 150,
          })
        }
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      document.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
      document.head.removeChild(style)
      // Clean up any live particles
      particles.forEach(p => p.el.remove())
      particles.length = 0
    }
  }, [])

  const isTouch =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
  if (isTouch) return null

  return (
    <>
      {/* ── Particle spray container — fixed at viewport origin ──────────── */}
      <div
        ref={particleContRef}
        style={{
          position:      'fixed',
          top:           0,
          left:          0,
          width:         0,
          height:        0,
          overflow:      'visible',
          pointerEvents: 'none',
          zIndex:        9997,
        }}
      />

      {/* ── Wake — V-shaped trailing lines at lerped position ──────────────── */}
      <svg
        ref={wakeRef}
        width="32"
        height="20"
        viewBox="0 0 32 20"
        style={{
          position:      'fixed',
          top:           0,
          left:          0,
          zIndex:        9998,
          pointerEvents: 'none',
          overflow:      'visible',
        }}
      >
        <line x1="16" y1="0" x2="2"  y2="18" stroke={accent} strokeWidth="2" strokeOpacity="0.18" strokeLinecap="round" />
        <line x1="16" y1="0" x2="30" y2="18" stroke={accent} strokeWidth="2" strokeOpacity="0.18" strokeLinecap="round" />
      </svg>

      {/* ── Fin — SVG dorsal fin, tip at (12,0) is the cursor hotspot ─────── */}
      {/*
        transform-origin: 12px 0px pivots rotation around the fin tip so the
        hotspot (12,0) stays exactly at the cursor for any rotation angle.
        Proof: transform-origin inserts translate(12,0)·M·translate(-12,0),
        so the tip maps to: translate(-12,0)→(0,0), rotate→(0,0), translate(x-12,y)→(x-12,y), translate(12,0)→(x,y). ✓
      */}
      <svg
        ref={finRef}
        width="24"
        height="30"
        viewBox="0 0 24 30"
        style={{
          position:        'fixed',
          top:             0,
          left:            0,
          zIndex:          9999,
          pointerEvents:   'none',
          filter:          'drop-shadow(0 0 4px rgba(255,255,255,0.28)) drop-shadow(0 2px 8px rgba(0,0,0,0.4))',
          overflow:        'visible',
          transformOrigin: '12px 0px',   // ← pivot at fin tip
        }}
      >
        <path
          ref={finPathRef}
          d="M 12 0 C 18 5 24 18 22 30 Q 12 25 2 30 C 0 18 6 5 12 0 Z"
          fill="rgba(255,255,255,0.72)"
        />
      </svg>
    </>
  )
}
