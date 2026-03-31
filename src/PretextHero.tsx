import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  layout,
  prepareWithSegments,
  layoutWithLines,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'
import { ensureFontsLoaded } from './textRenderer'

export type HeroMode = 'pro' | 'creative'

const PRO = {
  text: 'Tucker Anglemyer',
  font: '400 80px "Instrument Serif", Georgia, serif',
  lineHeight: 96,
} as const

const CRE = {
  text: 'ANGLEMYER',
  font: '700 72px "Space Mono", monospace',
  lineHeight: 80,
  letterSpacingEm: 0.12,
} as const

function parseFontSizePx(font: string): number {
  const m = font.match(/(\d+(?:\.\d+)?)\s*px/)
  return m ? parseFloat(m[1]) : 16
}

type LinesResult = ReturnType<typeof layoutWithLines>

interface PretextHeroProps {
  mode: HeroMode
  active: boolean
  isMobile: boolean
}

/**
 * Hero text via Pretext: `prepareWithSegments` uses the same measurement pipeline as
 * `prepare()` (segmentation + canvas metrics). `layoutWithLines()` mirrors `layout()`’s
 * line-breaking; it returns line strings for rendering while `layout()` alone only exposes
 * aggregate line count / height.
 */
export default function PretextHero({ mode, active, isMobile }: PretextHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const proCanvasRef = useRef<HTMLCanvasElement>(null)
  const creCanvasRef = useRef<HTMLCanvasElement>(null)

  const preparedPro = useRef<PreparedTextWithSegments | null>(null)
  const preparedCre = useRef<PreparedTextWithSegments | null>(null)
  const proLinesRef = useRef<LinesResult | null>(null)
  const creLinesRef = useRef<LinesResult | null>(null)

  const [maxWidth, setMaxWidth] = useState(600)
  const [boxHeight, setBoxHeight] = useState(120)
  const [useFallback, setUseFallback] = useState(false)
  const [pretextReady, setPretextReady] = useState(false)
  const [fadeCre, setFadeCre] = useState(mode === 'creative')

  const mouseRef = useRef({ x: -1e6, y: -1e6 })
  const hoverRef = useRef(false)
  const rafRef = useRef(0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setFadeCre(mode === 'creative'))
    return () => cancelAnimationFrame(id)
  }, [mode])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await ensureFontsLoaded()
        if (cancelled) return
        preparedPro.current = prepareWithSegments(PRO.text, PRO.font)
        preparedCre.current = prepareWithSegments(CRE.text, CRE.font)
        setPretextReady(true)
        setUseFallback(false)
      } catch {
        if (!cancelled) setUseFallback(true)
      }
    })().catch(() => setUseFallback(true))
    return () => {
      cancelled = true
    }
  }, [])

  const recomputeLayout = useCallback((w: number) => {
    const pw = preparedPro.current
    const pc = preparedCre.current
    if (!pw || !pc) return
    const mw = Math.max(120, w)
    proLinesRef.current = layoutWithLines(pw, mw, PRO.lineHeight)
    creLinesRef.current = layoutWithLines(pc, mw, CRE.lineHeight)
    const hPro = layout(pw, mw, PRO.lineHeight).height
    const hCre = layout(pc, mw, CRE.lineHeight).height
    setBoxHeight(Math.max(hPro, hCre, 1))
  }, [])

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el || useFallback || !pretextReady) return
    const ro = new ResizeObserver(entries => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      const w = cr.width
      requestAnimationFrame(() => {
        setMaxWidth(w)
        recomputeLayout(w)
      })
    })
    ro.observe(el)
    const w = el.getBoundingClientRect().width
    setMaxWidth(w)
    recomputeLayout(w)
    return () => ro.disconnect()
  }, [recomputeLayout, useFallback, pretextReady])

  const drawCanvas = useCallback(
    (canvas: HTMLCanvasElement | null, which: 'pro' | 'creative', time: number) => {
      if (!canvas) return
      const lp = which === 'pro' ? proLinesRef.current : creLinesRef.current
      if (!lp || lp.lines.length === 0) return

      const spec = which === 'pro' ? PRO : CRE
      const letterSpacingEm = which === 'creative' ? CRE.letterSpacingEm : 0
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      const cssW = Math.max(1, maxWidth)
      const cssH = Math.max(1, boxHeight)

      canvas.width = Math.ceil(cssW * dpr)
      canvas.height = Math.ceil(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, cssW, cssH)
      ctx.font = spec.font
      ctx.fillStyle = 'rgba(255,255,255,0.96)'
      ctx.textBaseline = 'top'

      const fontSizePx = parseFontSizePx(spec.font)
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (let li = 0; li < lp.lines.length; li++) {
        const line = lp.lines[li]!.text
        let x = 0
        const y = li * spec.lineHeight

        if (letterSpacingEm > 0) {
          const gap = letterSpacingEm * fontSizePx
          for (let i = 0; i < line.length; i++) {
            const ch = line[i]!
            const cw = ctx.measureText(ch).width
            const cx = x + cw * 0.5
            const cy = y + fontSizePx * 0.5
            const dist = Math.hypot(mx - cx, my - cy)
            const dy =
              hoverRef.current && active
                ? Math.sin(dist * 0.045 + time * 0.003) * (3.8 * Math.exp(-dist / 105))
                : 0
            ctx.fillText(ch, x, y + dy)
            x += cw + (i < line.length - 1 ? gap : 0)
          }
        } else {
          for (let i = 0; i < line.length; i++) {
            const ch = line[i]!
            const cw = ctx.measureText(ch).width
            const cx = x + cw * 0.5
            const cy = y + fontSizePx * 0.5
            const dist = Math.hypot(mx - cx, my - cy)
            const dy =
              hoverRef.current && active
                ? Math.sin(dist * 0.045 + time * 0.003) * (3.8 * Math.exp(-dist / 105))
                : 0
            ctx.fillText(ch, x, y + dy)
            x += cw
          }
        }
      }
    },
    [maxWidth, boxHeight, active],
  )

  const tick = useCallback(() => {
    const t = performance.now()
    drawCanvas(proCanvasRef.current, 'pro', t)
    drawCanvas(creCanvasRef.current, 'creative', t)
    if (hoverRef.current && active) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [drawCanvas, active])

  useEffect(() => {
    if (useFallback || !pretextReady) return
    drawCanvas(proCanvasRef.current, 'pro', performance.now())
    drawCanvas(creCanvasRef.current, 'creative', performance.now())
  }, [useFallback, pretextReady, drawCanvas, maxWidth, boxHeight])

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    mouseRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }
    if (!hoverRef.current) {
      hoverRef.current = true
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
  }

  const onMouseEnter = () => {
    if (!active) return
    hoverRef.current = true
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }

  const onMouseLeave = () => {
    hoverRef.current = false
    cancelAnimationFrame(rafRef.current)
    mouseRef.current = { x: -1e6, y: -1e6 }
    drawCanvas(proCanvasRef.current, 'pro', performance.now())
    drawCanvas(creCanvasRef.current, 'creative', performance.now())
  }

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  if (useFallback) {
    const isProFb = mode === 'pro'
    return (
      <h1
        style={{
          fontFamily: isProFb ? '"Instrument Serif", Georgia, serif' : '"Space Mono", monospace',
          fontSize: isMobile
            ? 'clamp(2.5rem, 8vw, 5.5rem)'
            : isProFb
              ? 'clamp(2.75rem, 8vw, 4.25rem)'
              : 'clamp(2rem, 6vw, 3rem)',
          fontWeight: isProFb ? 300 : 700,
          lineHeight: isProFb ? 1.05 : 1.1,
          letterSpacing: isProFb ? '-0.02em' : '0.28em',
          textTransform: isProFb ? 'none' : 'uppercase',
          color: 'rgba(255,255,255,0.96)',
          margin: 0,
        }}
      >
        {isProFb ? PRO.text : CRE.text}
      </h1>
    )
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={active ? onMouseMove : undefined}
      onMouseEnter={active ? onMouseEnter : undefined}
      onMouseLeave={active ? onMouseLeave : undefined}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: boxHeight,
        margin: 0,
      }}
    >
      <canvas
        ref={proCanvasRef}
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'block',
          opacity: fadeCre ? 0 : 1,
          transition: 'opacity 0.6s ease',
          pointerEvents: 'none',
        }}
      />
      <canvas
        ref={creCanvasRef}
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'block',
          opacity: fadeCre ? 1 : 0,
          transition: 'opacity 0.6s ease',
          pointerEvents: 'none',
        }}
      />
      <h1
        className="visually-hidden"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          border: 0,
        }}
      >
        {mode === 'pro' ? PRO.text : CRE.text}
      </h1>
    </div>
  )
}
