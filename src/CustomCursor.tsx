import { useEffect, useRef, useState } from 'react'

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function isUnderInteractive(x: number, y: number): boolean {
  const el = document.elementFromPoint(x, y)
  if (!el) return false
  const hit = el.closest(
    'a, button, input, textarea, select, label[for], [role="button"], [data-cursor-interactive]',
  )
  return Boolean(hit)
}

const LERP = 0.15
const BASE = 12
const HOVER_SCALE = 40 / 12

type CustomCursorProps = {
  accent: string
}

export default function CustomCursor({ accent }: CustomCursorProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef({ x: -100, y: -100 })
  const posRef = useRef({ x: -100, y: -100 })
  const rafRef = useRef(0)
  const [hoverInteractive, setHoverInteractive] = useState(false)

  useEffect(() => {
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    if (isTouch) return

    const onMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY }
      setHoverInteractive(isUnderInteractive(e.clientX, e.clientY))
    }

    const tick = () => {
      const el = outerRef.current
      if (!el) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }
      const tx = targetRef.current.x
      const ty = targetRef.current.y
      const { x, y } = posRef.current
      posRef.current = {
        x: x + (tx - x) * LERP,
        y: y + (ty - y) * LERP,
      }
      el.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) translate(-50%, -50%)`
      rafRef.current = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const isTouch =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
  if (isTouch) return null

  const { r, g, b } = hexToRgb(accent)
  const scale = hoverInteractive ? HOVER_SCALE : 1

  return (
    <div
      ref={outerRef}
      aria-hidden
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: `${BASE}px`,
          height: `${BASE}px`,
          borderRadius: '50%',
          border: `1px solid ${accent}`,
          backgroundColor: hoverInteractive ? `rgba(${r},${g},${b},0.22)` : 'transparent',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          transition: 'transform 0.2s ease, background-color 0.2s ease',
        }}
      />
    </div>
  )
}
