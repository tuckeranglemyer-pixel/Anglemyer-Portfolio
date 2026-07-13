import { useRef, useEffect, useCallback } from 'react'

/**
 * The one "signature" moment kept from the old site: the hero name whose
 * letters push away from the cursor. Pure DOM + rAF (no WebGL/canvas), so it
 * loads instantly and degrades to a plain heading on touch / reduced-motion.
 */
export default function MagneticName({ text }: { text: string }) {
  const rootRef = useRef<HTMLHeadingElement>(null)
  const letterRefs = useRef<HTMLSpanElement[]>([])
  const rafRef = useRef(0)
  const targetRef = useRef({ x: -1e6, y: -1e6 })

  const setLetter = useCallback((el: HTMLSpanElement | null, i: number) => {
    if (el) letterRefs.current[i] = el
  }, [])

  useEffect(() => {
    const canHover =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!canHover) return

    const RADIUS = 130
    const STRENGTH = 26

    const animate = () => {
      const { x: mx, y: my } = targetRef.current
      for (const el of letterRefs.current) {
        if (!el) continue
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dx = cx - mx
        const dy = cy - my
        const dist = Math.hypot(dx, dy)
        let tx = 0
        let ty = 0
        if (dist < RADIUS) {
          const f = (1 - dist / RADIUS) * STRENGTH
          const a = Math.atan2(dy, dx)
          tx = Math.cos(a) * f
          ty = Math.sin(a) * f
        }
        // ease toward target for smoothness
        const prev = (el as HTMLSpanElement & { _t?: [number, number] })._t ?? [0, 0]
        const nx = prev[0] + (tx - prev[0]) * 0.18
        const ny = prev[1] + (ty - prev[1]) * 0.18
        ;(el as HTMLSpanElement & { _t?: [number, number] })._t = [nx, ny]
        el.style.transform = `translate(${nx.toFixed(2)}px, ${ny.toFixed(2)}px)`
      }
      rafRef.current = requestAnimationFrame(animate)
    }

    const onMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY }
    }
    const onLeave = () => {
      targetRef.current = { x: -1e6, y: -1e6 }
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseout', onLeave, { passive: true })
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseout', onLeave)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  let counter = 0
  return (
    <h1 ref={rootRef} className="magnetic-name" aria-label={text}>
      {text.split(' ').map((word, wi) => (
        <span className="magnetic-word" key={wi} aria-hidden="true">
          {word.split('').map((ch) => {
            const i = counter++
            return (
              <span className="magnetic-letter" key={i} ref={(el) => setLetter(el, i)}>
                {ch}
              </span>
            )
          })}
        </span>
      ))}
    </h1>
  )
}
