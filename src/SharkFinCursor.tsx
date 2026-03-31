import { useEffect, useRef } from 'react'

interface SharkFinCursorProps {
  accent: string // reserved for future use
}

// ─── SharkFinCursor ───────────────────────────────────────────────────────────
// Minimal clean fin. Features:
//   • Narrow triangular SVG fin, white 0.8 opacity
//   • Smooth 360° rotation toward direction of travel (lerp 0.1)
//   • Fill turns blood-red while hovering the hero name h1
// No wake, no particles, no trail — clean foundation to build on.
export default function SharkFinCursor({ accent: _accent }: SharkFinCursorProps) {
  const finRef     = useRef<SVGSVGElement>(null)
  const finPathRef = useRef<SVGPathElement>(null)
  const cursorRef  = useRef({ x: -200, y: -200 })

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

    let prevX      = -200
    let prevY      = -200
    let currentRot = 0
    let heroEl: Element | null = null

    let raf: number
    function tick() {
      const fin  = finRef.current
      const path = finPathRef.current
      if (!fin) { raf = requestAnimationFrame(tick); return }

      const { x, y } = cursorRef.current

      // ── Velocity & rotation ──────────────────────────────────────────────
      const isFirstEntry = prevX === -200 && x !== -200
      const vx = isFirstEntry ? 0 : x - prevX
      const vy = isFirstEntry ? 0 : y - prevY
      prevX = x
      prevY = y
      const speed = Math.sqrt(vx * vx + vy * vy)

      // Full 360° — 0° = pointing up, +90° = pointing right
      let targetRot = 0
      if (speed > 0.5) {
        const rawDeg = (Math.atan2(vy, vx) + Math.PI / 2) * (180 / Math.PI)
        let norm = ((rawDeg % 360) + 360) % 360
        if (norm > 180) norm -= 360
        targetRot = norm
      }

      // Shortest-path lerp — gradual banking into turns
      let diff = targetRot - currentRot
      if (diff >  180) diff -= 360
      if (diff < -180) diff += 360
      currentRot += diff * 0.1

      // Tip of fin (5, 0 in viewBox) pinned to cursor via translate + transformOrigin
      fin.style.transform = `translate(${x - 5}px, ${y}px) rotate(${currentRot.toFixed(2)}deg)`

      // ── Hero name color swap ─────────────────────────────────────────────
      if (!heroEl) heroEl = document.querySelector('[data-hero-name]')
      if (path) {
        let overHero = false
        if (heroEl) {
          const r = heroEl.getBoundingClientRect()
          overHero = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom
        }
        path.setAttribute('fill', overHero ? 'rgba(200,40,40,0.8)' : 'rgba(255,255,255,0.8)')
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      document.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
      document.head.removeChild(style)
    }
  }, [])

  const isTouch =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
  if (isTouch) return null

  return (
    // transformOrigin: 5px 0px — pivots rotation around the fin tip at (5,0)
    // so the hotspot stays pinned to the cursor for any rotation angle.
    <svg
      ref={finRef}
      width="10"
      height="24"
      viewBox="0 0 10 24"
      style={{
        position:        'fixed',
        top:             0,
        left:            0,
        zIndex:          9999,
        pointerEvents:   'none',
        overflow:        'visible',
        transformOrigin: '5px 0px',
      }}
    >
      {/* Narrow isosceles triangle with a slightly curved leading edge */}
      <path
        ref={finPathRef}
        d="M 5 0 C 7 4 9 14 8 24 Q 5 21 2 24 C 1 14 3 4 5 0 Z"
        fill="rgba(255,255,255,0.8)"
      />
    </svg>
  )
}
