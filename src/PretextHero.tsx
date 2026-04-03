import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type Ref,
} from 'react'
import {
  layout,
  prepareWithSegments,
  layoutWithLines,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'
import { ensureFontsLoaded } from './textRenderer'

export type HeroMode = 'pro' | 'creative'

const PRO_TEXT = 'Tucker Anglemyer'
const CRE_TEXT = 'ANGLEMYER'

const LINE_HEIGHT_RATIO = 0.85
const PRO_LETTER_SPACING_EM = -0.03
/** NIGHT / creative: Pilowlava reads large vs Space Mono — match visual weight to DAY */
const CRE_FONT_SIZE_SCALE = 0.85
const CRE_LETTER_SPACING_EM = 0.03

function rootRemPx(): number {
  if (typeof document === 'undefined') return 16
  const fs = getComputedStyle(document.documentElement).fontSize
  return parseFloat(fs) || 16
}

/** Matches CSS `clamp(minRem, vw%, maxRem)` using viewport width. */
function clampHeroFontPx(minRem: number, vwPercent: number, maxRem: number): number {
  if (typeof window === 'undefined') {
    return minRem * rootRemPx()
  }
  const root = rootRemPx()
  const minPx = minRem * root
  const maxPx = maxRem * root
  const preferred = (vwPercent / 100) * window.innerWidth
  return Math.min(maxPx, Math.max(minPx, preferred))
}

function parseFontSizePx(font: string): number {
  const m = font.match(/(\d+(?:\.\d+)?)\s*px/)
  return m ? parseFloat(m[1]) : 16
}

function proSpec(fontPx: number) {
  return {
    text: PRO_TEXT,
    font: `400 ${fontPx}px "Instrument Serif", Georgia, serif`,
    lineHeight: fontPx * LINE_HEIGHT_RATIO,
    letterSpacingEm: PRO_LETTER_SPACING_EM,
  } as const
}

function creSpec(fontPx: number) {
  return {
    text: CRE_TEXT,
    font: `400 ${fontPx}px "Pilowlava", cursive`,
    lineHeight: fontPx * LINE_HEIGHT_RATIO,
    letterSpacingEm: CRE_LETTER_SPACING_EM,
  } as const
}

type LinesResult = ReturnType<typeof layoutWithLines>

export type HeroLayoutMode = 'main' | 'text-reveal'

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]): Ref<T> {
  return (value: T | null) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') ref(value)
      else (ref as MutableRefObject<T | null>).current = value
    }
  }
}

interface PretextHeroProps {
  mode: HeroMode
  active: boolean
  isMobile: boolean
  heroLayout?: HeroLayoutMode
  /** Optional ref to the `.pretext-hero` root. */
  heroMeasureRef?: Ref<HTMLDivElement>
  /** Hide visually (opacity 0) while IdentityCycle runs; layout preserved for measurement. */
  hiddenDuringIdentityCycle?: boolean
}

/**
 * Hero text via Pretext: `prepareWithSegments` uses the same measurement pipeline as
 * `prepare()` (segmentation + canvas metrics). `layoutWithLines()` mirrors `layout()`’s
 * line-breaking; it returns line strings for rendering while `layout()` alone only exposes
 * aggregate line count / height.
 */
export default function PretextHero({
  mode,
  active,
  isMobile: _isMobile,
  heroLayout = 'main',
  heroMeasureRef,
  hiddenDuringIdentityCycle = false,
}: PretextHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const proCanvasRef = useRef<HTMLCanvasElement>(null)
  const creCanvasRef = useRef<HTMLCanvasElement>(null)

  const preparedPro = useRef<PreparedTextWithSegments | null>(null)
  const preparedCre = useRef<PreparedTextWithSegments | null>(null)
  const proLinesRef = useRef<LinesResult | null>(null)
  const creLinesRef = useRef<LinesResult | null>(null)

  const [metrics, setMetrics] = useState(() => ({
    pro: clampHeroFontPx(5, 15, 12),
    cre: clampHeroFontPx(6, 26, 22) * CRE_FONT_SIZE_SCALE,
  }))

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

  useLayoutEffect(() => {
    const update = () => {
      setMetrics({
        pro: clampHeroFontPx(5, 15, 12),
        cre: clampHeroFontPx(6, 26, 22) * CRE_FONT_SIZE_SCALE,
      })
    }
    update()
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [])

  const recomputeLayout = useCallback((w: number) => {
    const pw = preparedPro.current
    const pc = preparedCre.current
    if (!pw || !pc) return
    const mw = Math.max(120, w)
    const P = proSpec(metrics.pro)
    const C = creSpec(metrics.cre)
    proLinesRef.current = layoutWithLines(pw, mw, P.lineHeight)
    creLinesRef.current = layoutWithLines(pc, mw, C.lineHeight)
    const hPro = layout(pw, mw, P.lineHeight).height
    const hCre = layout(pc, mw, C.lineHeight).height
    setBoxHeight(Math.max(hPro, hCre, 1))
  }, [metrics.pro, metrics.cre])

  useEffect(() => {
    let cancelled = false
    const p = proSpec(metrics.pro)
    const c = creSpec(metrics.cre)
    ;(async () => {
      try {
        await ensureFontsLoaded()
        if (typeof document !== 'undefined' && document.fonts?.load) {
          await document.fonts.load(c.font)
        }
        if (cancelled) return
        preparedPro.current = prepareWithSegments(p.text, p.font)
        preparedCre.current = prepareWithSegments(c.text, c.font)
        setPretextReady(true)
        setUseFallback(false)
        queueMicrotask(() => {
          if (cancelled) return
          const el = containerRef.current
          if (!el) return
          const w = el.getBoundingClientRect().width
          setMaxWidth(w)
          recomputeLayout(w)
        })
      } catch {
        if (!cancelled) setUseFallback(true)
      }
    })().catch(() => setUseFallback(true))
    return () => {
      cancelled = true
    }
  }, [metrics.pro, metrics.cre, recomputeLayout])

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
  }, [recomputeLayout, useFallback, pretextReady, metrics.pro, metrics.cre])

  const drawCanvas = useCallback(
    (canvas: HTMLCanvasElement | null, which: 'pro' | 'creative', time: number) => {
      if (!canvas) return
      const lp = which === 'pro' ? proLinesRef.current : creLinesRef.current
      if (!lp || lp.lines.length === 0) return

      const spec = which === 'pro' ? proSpec(metrics.pro) : creSpec(metrics.cre)
      const letterSpacingEm = spec.letterSpacingEm
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
      ctx.fillStyle =
        heroLayout === 'text-reveal' ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.92)'
      ctx.textBaseline = 'top'

      const fontSizePx = parseFontSizePx(spec.font)
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const gap = letterSpacingEm * fontSizePx

      for (let li = 0; li < lp.lines.length; li++) {
        const line = lp.lines[li]!.text
        let x = 0
        const y = li * spec.lineHeight

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
      }
    },
    [maxWidth, boxHeight, active, metrics.pro, metrics.cre, heroLayout],
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

  const heroVisibilityStyle = {
    opacity: hiddenDuringIdentityCycle ? 0 : 1,
    transition: hiddenDuringIdentityCycle ? 'opacity 0s' : 'opacity 0.35s ease',
  } as const

  if (useFallback) {
    const isProFb = mode === 'pro'
    const inner = (
      <div
        ref={mergeRefs(containerRef, heroMeasureRef)}
        className="pretext-hero"
        data-hero-target
        style={heroVisibilityStyle}
      >
        <h1
          className={isProFb ? 'pretext-hero-fallback--pro' : 'pretext-hero-fallback--cre'}
        >
          {isProFb ? PRO_TEXT : CRE_TEXT}
        </h1>
      </div>
    )
    if (heroLayout === 'text-reveal') {
      return (
        <div className="pretext-hero-viewport-shell">
          <div className="pretext-hero--text-reveal-box">{inner}</div>
        </div>
      )
    }
    return inner
  }

  const heroInner = (
    <div
      ref={mergeRefs(containerRef, heroMeasureRef)}
      className="pretext-hero"
      data-hero-target
      onMouseMove={active ? onMouseMove : undefined}
      onMouseEnter={active ? onMouseEnter : undefined}
      onMouseLeave={active ? onMouseLeave : undefined}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: boxHeight,
        ...heroVisibilityStyle,
      }}
    >
      <div className="hero-cycle-layer" aria-hidden>
        <h1 className="hero-cycle-h1 hero-cycle-h1--pro">{PRO_TEXT}</h1>
        <h1 className="hero-cycle-h1 hero-cycle-h1--cre">{CRE_TEXT}</h1>
      </div>

      <canvas
        ref={proCanvasRef}
        className="pretext-hero-canvas"
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'block',
          opacity: fadeCre ? 0 : 1,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
        }}
      />
      <canvas
        ref={creCanvasRef}
        className="pretext-hero-canvas"
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          display: 'block',
          opacity: fadeCre ? 1 : 0,
          transition: 'opacity 0.3s ease',
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
        {mode === 'pro' ? PRO_TEXT : CRE_TEXT}
      </h1>
    </div>
  )

  if (heroLayout === 'text-reveal') {
    return (
      <div className="pretext-hero-viewport-shell">
        <div className="pretext-hero--text-reveal-box">{heroInner}</div>
      </div>
    )
  }

  return heroInner
}
