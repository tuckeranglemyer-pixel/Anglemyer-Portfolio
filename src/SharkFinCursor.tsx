import { useEffect, useRef } from 'react'

interface SharkFinCursorProps {
  accent: string
}

// ─── SharkFinCursor ───────────────────────────────────────────────────────────
// Replaces the default cursor with a shark fin SVG on desktop.
// Features:
//   • Full 360° rotation toward direction of travel (smoothed EMA velocity, lerp 0.08)
//   • Momentum coasting — fin leads cursor by inertia, drifts ~300ms after stop
//   • Motion blur SVG filter that intensifies with speed (stdDeviation 0.5→1.5)
//   • 150ms movement trail — faint 1px polyline with gradient fade at tail
//   • Idle sway — 2px sinusoidal drift after 1 s stationary, 3 s period
//   • Blood-red fin + wake while over the hero name h1
//   • Water-droplet spray particles perpendicular to movement
export default function SharkFinCursor({ accent }: SharkFinCursorProps) {
  const finRef          = useRef<SVGSVGElement>(null)
  const wakeRef         = useRef<SVGSVGElement>(null)
  const finPathRef      = useRef<SVGPathElement>(null)
  const particleContRef = useRef<HTMLDivElement>(null)
  const trailSvgRef     = useRef<SVGSVGElement>(null)
  const trailPolyRef    = useRef<SVGPolylineElement>(null)
  const trailGradRef    = useRef<SVGLinearGradientElement>(null)
  const blurRef         = useRef<SVGFEGaussianBlurElement>(null)
  const cursorRef       = useRef({ x: -200, y: -200 })
  const wakeTrailRef    = useRef({ x: -200, y: -200 }) // lerped wake position
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

    // ── Physics state ────────────────────────────────────────────────────────
    let prevX        = -200
    let prevY        = -200
    let currentRot   = 0      // interpolated rotation (degrees)
    let smoothVx     = 0      // EMA of vx — drives both rotation and coasting
    let smoothVy     = 0
    let lastMoveTime = performance.now()

    // ── Particle pool ────────────────────────────────────────────────────────
    type Particle = {
      el:   HTMLDivElement
      x:    number; y: number
      vx:   number; vy: number
      born: number; life: number
    }
    const particles: Particle[] = []
    const MAX_PARTICLES         = 20
    let   lastSpawnTime         = 0

    // ── Trail buffer ─────────────────────────────────────────────────────────
    type TrailPt = { x: number; y: number; t: number }
    const trailBuf: TrailPt[] = []

    // ── rAF loop ─────────────────────────────────────────────────────────────
    let raf: number
    function tick() {
      const fin  = finRef.current
      const wake = wakeRef.current
      const cont = particleContRef.current
      if (!fin || !wake) { raf = requestAnimationFrame(tick); return }

      const now      = performance.now()
      const { x, y } = cursorRef.current
      const wt        = wakeTrailRef.current

      // ── Raw frame velocity ───────────────────────────────────────────────
      const rawVx       = x - prevX
      const rawVy       = y - prevY
      const isFirstEntry = (prevX === -200 && x !== -200)
      const vx           = isFirstEntry ? 0 : rawVx
      const vy           = isFirstEntry ? 0 : rawVy
      prevX = x
      prevY = y
      const rawSpeed = Math.sqrt(vx * vx + vy * vy)

      // ── Smooth velocity (EMA, α = 0.12) ─────────────────────────────────
      // Accumulates when moving, decays naturally when cursor stops.
      // Used for: rotation angle, coasting offset, motion blur intensity.
      smoothVx = smoothVx * 0.88 + vx * 0.12
      smoothVy = smoothVy * 0.88 + vy * 0.12
      const smoothSpeed = Math.sqrt(smoothVx * smoothVx + smoothVy * smoothVy)

      if (rawSpeed > 0.5) lastMoveTime = now

      // ── Momentum coasting ─────────────────────────────────────────────────
      // Fin leads cursor by its own inertia (1.5× smooth velocity look-ahead).
      // When cursor stops, smoothVx/Vy decay (τ ≈ 300 ms at 60 fps) so the
      // fin drifts forward then settles — never just freezes in place.
      const COAST = 1.5
      let finX = x + smoothVx * COAST
      let finY = y + smoothVy * COAST

      // ── Idle sway ─────────────────────────────────────────────────────────
      // After 1 s of no movement, a gentle 2px sinusoidal sway begins.
      // Period: 3 s. Starts from zero amplitude so onset is seamless.
      const idleMs = now - lastMoveTime
      if (idleMs > 1000) {
        const swayT = (idleMs - 1000) / 3000 * Math.PI * 2
        finX += Math.sin(swayT) * 2
      }

      // ── Wake position (lerps behind fin, coasts with it) ─────────────────
      wt.x += (finX - wt.x) * 0.22
      wt.y += (finY - wt.y) * 0.22
      wake.style.transform = `translate(${wt.x - 16}px, ${wt.y + 20}px)`

      // ── Full 360° rotation ────────────────────────────────────────────────
      // Uses smoothed velocity so rotation banks gradually into turns.
      // 0° = upright (moving up); 90° = tilted right; 180° = pointing down.
      // No clamp — full rotation follows exact direction of travel.
      let targetRot = 0
      if (smoothSpeed > 0.3) {
        const rawDeg = (Math.atan2(smoothVy, smoothVx) + Math.PI / 2) * (180 / Math.PI)
        let norm = ((rawDeg % 360) + 360) % 360
        if (norm > 180) norm -= 360
        targetRot = norm
      }

      // Shortest-path lerp at 0.08 — slower than before for gradual banking
      let diff = targetRot - currentRot
      if (diff >  180) diff -= 360
      if (diff < -180) diff += 360
      currentRot += diff * 0.08

      fin.style.transform = `translate(${finX - 12}px, ${finY}px) rotate(${currentRot.toFixed(2)}deg)`

      // ── Motion blur ───────────────────────────────────────────────────────
      // stdDeviation: 0.5 at rest → 1.5 at full speed (≥12 px/frame).
      // Applied inside the SVG to the path only; CSS drop-shadow stays separate.
      const blur = 0.5 + Math.min(smoothSpeed / 12, 1) * 1.0
      blurRef.current?.setAttribute('stdDeviation', blur.toFixed(2))

      // ── Movement trail ────────────────────────────────────────────────────
      // Ring buffer of fin positions for the last 150 ms.
      // Rendered as a polyline with a userSpaceOnUse linearGradient so the
      // head (newest) is opaque and the tail (oldest) fades to transparent.
      trailBuf.push({ x: finX, y: finY, t: now })
      while (trailBuf.length > 1 && now - trailBuf[0].t > 150) trailBuf.shift()

      const poly = trailPolyRef.current
      const grad = trailGradRef.current
      if (poly && grad) {
        if (trailBuf.length >= 2) {
          const tail = trailBuf[0]                        // oldest → opacity 0
          const head = trailBuf[trailBuf.length - 1]     // newest → opacity 0.06
          grad.setAttribute('x1', tail.x.toFixed(1))
          grad.setAttribute('y1', tail.y.toFixed(1))
          grad.setAttribute('x2', head.x.toFixed(1))
          grad.setAttribute('y2', head.y.toFixed(1))
          poly.setAttribute('points', trailBuf.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
        } else {
          poly.setAttribute('points', '')
        }
      }

      // ── Hero name detection & color swap ─────────────────────────────────
      if (!heroEl) heroEl = document.querySelector('[data-hero-name]')
      let overHero = false
      if (heroEl) {
        const r = heroEl.getBoundingClientRect()
        overHero = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
      }

      const allLines   = Array.from(wake.querySelectorAll('line'))
      const wideLines  = allLines.filter(l => l.hasAttribute('data-wide'))
      const sharpLines = allLines.filter(l => !l.hasAttribute('data-wide'))
      const finPath    = finPathRef.current
      if (overHero) {
        sharpLines.forEach(l => {
          l.setAttribute('stroke', '#cc0000')
          l.setAttribute('stroke-opacity', '0.6')
        })
        wideLines.forEach(l => {
          l.setAttribute('stroke', '#cc0000')
          l.setAttribute('stroke-opacity', '0.15')
        })
        if (finPath) finPath.setAttribute('fill', 'rgba(255,80,80,0.75)')
      } else {
        sharpLines.forEach(l => {
          l.setAttribute('stroke', accentRef.current)
          l.setAttribute('stroke-opacity', '0.18')
        })
        wideLines.forEach(l => {
          l.setAttribute('stroke', accentRef.current)
          l.setAttribute('stroke-opacity', '0.08')
        })
        if (finPath) finPath.setAttribute('fill', 'rgba(255,255,255,0.72)')
      }

      // ── Spray particles ───────────────────────────────────────────────────
      for (let i = particles.length - 1; i >= 0; i--) {
        const p   = particles[i]
        const age = now - p.born
        if (age >= p.life) {
          p.el.remove()
          particles.splice(i, 1)
          continue
        }
        p.x  += p.vx
        p.y  += p.vy
        p.vy += 0.15   // gravity
        p.vx *= 0.97
        p.vy *= 0.98
        const frac = age / p.life
        p.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`
        p.el.style.opacity   = (0.2 * (1 - frac)).toFixed(3)
      }

      // Spawn elongated water droplets perpendicular to travel direction
      if (cont && rawSpeed > 2 && particles.length < MAX_PARTICLES && now - lastSpawnTime > 30) {
        lastSpawnTime = now
        const nx = -vy / rawSpeed
        const ny =  vx / rawSpeed
        for (const side of [1, -1] as const) {
          if (particles.length >= MAX_PARTICLES) break
          const spread = 5 + Math.random() * 5
          const el     = document.createElement('div')
          el.style.cssText =
            'position:absolute;top:0;left:0;' +
            'width:2px;height:5px;border-radius:1px;' +
            'background:rgba(255,255,255,0.2);' +
            'pointer-events:none;will-change:transform,opacity;'
          cont.appendChild(el)
          const px        = x + nx * spread * side
          const py        = y + ny * spread * side
          const perpSpeed = 0.5 + Math.random() * 0.8
          const backSpeed = 0.1 + Math.random() * 0.25
          particles.push({
            el,
            x:  px, y: py,
            vx: nx * side * perpSpeed - (vx / rawSpeed) * backSpeed,
            vy: ny * side * perpSpeed - (vy / rawSpeed) * backSpeed,
            born: now,
            life: 350 + Math.random() * 150,
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
      {/* ── Particle spray container ───────────────────────────────────────── */}
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

      {/* ── Movement trail — 1px fading polyline, last 150 ms of fin path ─── */}
      {/* gradient goes from tail (oldest, opacity 0) → head (newest, 0.06)  */}
      <svg
        ref={trailSvgRef}
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
      >
        <defs>
          <linearGradient
            ref={trailGradRef}
            id="sharkTrailGrad"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="white" stopOpacity="0"    />
            <stop offset="1" stopColor="white" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <polyline
          ref={trailPolyRef}
          stroke="url(#sharkTrailGrad)"
          strokeWidth="1"
          fill="none"
        />
      </svg>

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
        {/* Wide diffuse spread behind sharp V */}
        <line data-wide="" x1="16" y1="0" x2="0"  y2="24" stroke={accent} strokeWidth="8" strokeOpacity="0.08" strokeLinecap="round" />
        <line data-wide="" x1="16" y1="0" x2="32" y2="24" stroke={accent} strokeWidth="8" strokeOpacity="0.08" strokeLinecap="round" />
        {/* Sharp V wake */}
        <line x1="16" y1="0" x2="2"  y2="18" stroke={accent} strokeWidth="2" strokeOpacity="0.18" strokeLinecap="round" />
        <line x1="16" y1="0" x2="30" y2="18" stroke={accent} strokeWidth="2" strokeOpacity="0.18" strokeLinecap="round" />
      </svg>

      {/* ── Fin — SVG dorsal fin, tip at (12,0) is the cursor hotspot ─────── */}
      {/*
        transformOrigin: 12px 0px pivots rotation around the fin tip so the
        hotspot (12,0) maps to screen position (finX, finY) for any angle.
        opacity: 0.85 makes the fin feel embedded in the scene, not pasted on.
        The SVG filter (#fin-mb) applies motion blur to the path only;
        the CSS drop-shadow wraps around the blurred result.
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
          opacity:         0.85,
          filter:          'drop-shadow(0 0 4px rgba(255,255,255,0.28)) drop-shadow(0 2px 8px rgba(0,0,0,0.4))',
          overflow:        'visible',
          transformOrigin: '12px 0px',
        }}
      >
        <defs>
          {/* Motion blur — stdDeviation driven by smoothSpeed each frame */}
          <filter id="fin-mb" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur ref={blurRef} in="SourceGraphic" stdDeviation="0.5" />
          </filter>
        </defs>
        <path
          ref={finPathRef}
          d="M 12 0 C 18 5 24 18 22 30 Q 12 25 2 30 C 0 18 6 5 12 0 Z"
          fill="rgba(255,255,255,0.72)"
          filter="url(#fin-mb)"
        />
      </svg>
    </>
  )
}
