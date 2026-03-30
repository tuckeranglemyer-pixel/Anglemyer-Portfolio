import { useEffect, useRef } from 'react'

interface SharkFinCursorProps {
  accent: string
}

// ─── SharkFinCursor ───────────────────────────────────────────────────────────
// Replaces the default cursor with a shark fin SVG on desktop.
// Wake lines trail behind the fin at a lerped position for a V-wake effect.
// Touch/mobile devices are skipped entirely — no render, no cursor:none.
export default function SharkFinCursor({ accent }: SharkFinCursorProps) {
  const finRef    = useRef<SVGSVGElement>(null)
  const wakeRef   = useRef<SVGSVGElement>(null)
  const cursorRef = useRef({ x: -200, y: -200 })  // actual cursor
  const trailRef  = useRef({ x: -200, y: -200 })  // lerped trail
  const accentRef = useRef(accent)
  accentRef.current = accent

  useEffect(() => {
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    if (isTouch) return

    // Inject global cursor:none so no default arrow shows anywhere
    const style = document.createElement('style')
    style.textContent = '*, *::before, *::after { cursor: none !important; }'
    document.head.appendChild(style)

    const onMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY }
    }
    document.addEventListener('mousemove', onMove, { passive: true })

    let raf: number
    function tick() {
      const fin  = finRef.current
      const wake = wakeRef.current
      if (fin && wake) {
        const { x, y } = cursorRef.current
        const tr = trailRef.current

        // Lerp trail toward cursor — ~3-4 frames of lag at 60fps
        tr.x += (x - tr.x) * 0.22
        tr.y += (y - tr.y) * 0.22

        // Fin: tip (at top of SVG, x=12 in viewBox) placed exactly at cursor hotspot
        fin.style.transform  = `translate(${x - 12}px, ${y}px)`

        // Wake: V-origin at fin base, at lerped position
        // Offset so V-origin (16, 0 in viewBox) is at the fin base (~20px below cursor)
        wake.style.transform = `translate(${tr.x - 16}px, ${tr.y + 20}px)`

        // Update wake stroke color imperatively to match current accent
        const lines = wake.querySelectorAll('line')
        lines.forEach(l => l.setAttribute('stroke', accentRef.current))
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

  // Skip rendering on touch/mobile
  const isTouch =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
  if (isTouch) return null

  return (
    <>
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

      {/* ── Fin — SVG dorsal fin, tip (at 12,0) is the cursor hotspot ─────── */}
      {/*
        Path description:
        - Tip at (12, 0)
        - Leading edge (right): sweeps outward like a dorsal fin
        - Concave base connecting back to trailing edge
        - Trailing edge (left): gentle curve back to tip
      */}
      <svg
        ref={finRef}
        width="24"
        height="30"
        viewBox="0 0 24 30"
        style={{
          position:      'fixed',
          top:           0,
          left:          0,
          zIndex:        9999,
          pointerEvents: 'none',
          filter:        'drop-shadow(0 0 4px rgba(255,255,255,0.28)) drop-shadow(0 2px 8px rgba(0,0,0,0.4))',
          overflow:      'visible',
        }}
      >
        <path
          d="M 12 0 C 18 5 24 18 22 30 Q 12 25 2 30 C 0 18 6 5 12 0 Z"
          fill="rgba(255,255,255,0.72)"
        />
      </svg>
    </>
  )
}
