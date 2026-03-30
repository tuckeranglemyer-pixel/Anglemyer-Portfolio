import { useEffect, useRef, useCallback, useState } from 'react'
import {
  prepareWithSegments,
  layoutNextLine,
  type PreparedTextWithSegments,
  type LayoutCursor,
} from '@chenglou/pretext'

type Mode = 'pro' | 'creative'

export interface PretextHeroProps {
  text?:   string
  font?:   string
  color:   string
  accent:  string
  mode:    Mode
}

// ─── constants ────────────────────────────────────────────────────────────────
const ORB_RADIUS = 30   // half of 60px orb
const ORB_GAP    = 14   // breathing room between orb edge and text

// ─── helpers ──────────────────────────────────────────────────────────────────
function getFontSize(mode: Mode, containerWidth: number): number {
  return containerWidth < 600 ? 48 : mode === 'pro' ? 80 : 72
}

function getFontString(mode: Mode, fontSize: number): string {
  return mode === 'pro'
    ? `400 ${fontSize}px "Instrument Serif"`
    : `700 ${fontSize}px "Space Mono"`
}

function getModeText(mode: Mode): string {
  return mode === 'pro' ? 'Tucker Anglemyer' : 'ANGLEMYER'
}

// ─── exclusion zone math ──────────────────────────────────────────────────────
// For a horizontal band [lineY, lineY+lineHeight] and a circular orb,
// return the xOffset (where text starts) and maxWidth (available text width).
// Uses the chord of the circle at the band's closest point to the orb center.
function getLineExclusion(
  lineY:          number,
  lineHeight:     number,
  orb:            { x: number; y: number } | null,
  containerWidth: number,
): { xOffset: number; maxWidth: number } {
  if (!orb) return { xOffset: 0, maxWidth: containerWidth }

  const r = ORB_RADIUS + ORB_GAP

  // Nearest y on the band to the orb center
  const clampedY = Math.max(lineY, Math.min(orb.y, lineY + lineHeight))
  const dy       = Math.abs(orb.y - clampedY)

  if (dy >= r) return { xOffset: 0, maxWidth: containerWidth }

  const chordHalf = Math.sqrt(r * r - dy * dy)
  const orbLeft   = orb.x - chordHalf
  const orbRight  = orb.x + chordHalf

  if (orb.x <= containerWidth / 2) {
    // Orb on left — text starts after orb right edge
    const xOff = Math.max(0, Math.min(orbRight, containerWidth * 0.75))
    return { xOffset: xOff, maxWidth: Math.max(60, containerWidth - xOff) }
  } else {
    // Orb on right — text is limited to orb left edge
    return { xOffset: 0, maxWidth: Math.max(60, orbLeft) }
  }
}

// ─── PretextHero ──────────────────────────────────────────────────────────────
export default function PretextHero({ color, accent, mode }: PretextHeroProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const orbDivRef     = useRef<HTMLDivElement>(null)
  const preparedRef   = useRef<PreparedTextWithSegments | null>(null)
  const fontStringRef = useRef('')
  const colorRef      = useRef(color)
  const accentRef     = useRef(accent)
  const modeRef       = useRef(mode)
  const orbPosRef     = useRef<{ x: number; y: number } | null>(null)
  const [fallback, setFallback] = useState(false)

  colorRef.current  = color
  accentRef.current = accent
  modeRef.current   = mode

  // ── draw (hot path — runs 60fps while orb is active) ──────────────────────
  const draw = useCallback(() => {
    const canvas    = canvasRef.current
    const container = containerRef.current
    const prepared  = preparedRef.current
    if (!canvas || !container || !prepared) return

    try {
      const dpr      = window.devicePixelRatio || 1
      const cssWidth = container.offsetWidth
      if (cssWidth <= 0) return

      const currentMode = modeRef.current
      const fontSize    = getFontSize(currentMode, cssWidth)
      const lineHeight  = fontSize * 1.1

      // Only apply orb exclusion on desktop
      const orb = cssWidth >= 600 ? orbPosRef.current : null

      // ── Layout via layoutNextLine (supports per-line width) ───────────────
      let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
      let y                    = 0
      const rendered: { text: string; x: number; y: number }[] = []
      const MAX_LINES = 24

      while (rendered.length < MAX_LINES) {
        const { xOffset, maxWidth } = getLineExclusion(y, lineHeight, orb, cssWidth)

        if (maxWidth < fontSize * 0.5) {
          // Orb completely blocks this band — skip the slot
          y += lineHeight
          continue
        }

        const line = layoutNextLine(prepared, cursor, maxWidth)
        if (line === null) break

        rendered.push({ text: line.text, x: xOffset, y })
        cursor = line.end
        y += lineHeight
      }

      const cssHeight = Math.max(y, lineHeight)

      canvas.width        = Math.round(cssWidth  * dpr)
      canvas.height       = Math.round(cssHeight * dpr)
      canvas.style.width  = `${cssWidth}px`
      canvas.style.height = `${cssHeight}px`

      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.save()
      ctx.scale(dpr, dpr)

      ctx.font         = fontStringRef.current
      ctx.fillStyle    = colorRef.current
      ctx.textBaseline = 'top'

      // Letter-spacing (Chrome 99+ / Firefox 104+; no-op elsewhere)
      const lsPx = currentMode === 'pro' ? fontSize * -0.02 : fontSize * 0.08
      if ('letterSpacing' in ctx) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(ctx as any).letterSpacing = `${lsPx}px`
      }

      for (const line of rendered) {
        ctx.fillText(line.text, line.x, line.y)
      }

      ctx.restore()
    } catch (err) {
      console.warn('PretextHero: draw error', err)
    }
  }, [])

  // ── prepare (cold path) ───────────────────────────────────────────────────
  const doPrepare = useCallback(
    async (targetMode: Mode) => {
      const container = containerRef.current
      if (!container) return

      const cssWidth = container.offsetWidth || window.innerWidth
      const fontSize = getFontSize(targetMode, cssWidth)
      const fontStr  = getFontString(targetMode, fontSize)
      const text     = getModeText(targetMode)

      try {
        await document.fonts.ready
        preparedRef.current   = prepareWithSegments(text, fontStr)
        fontStringRef.current = fontStr
        draw()
      } catch (err) {
        console.warn('PretextHero: prepare failed, using fallback', err)
        setFallback(true)
      }
    },
    [draw],
  )

  // Re-prepare when mode changes
  useEffect(() => {
    doPrepare(mode)
  }, [mode, doPrepare])

  // ── Orb animation — Lissajous figure-8 via rAF (desktop only) ─────────────
  useEffect(() => {
    const container = containerRef.current
    // Don't start animation on mobile-sized containers
    if (!container || container.offsetWidth < 600) return

    const startMs = performance.now()
    let frame: number

    function animate(now: number) {
      const cont   = containerRef.current
      const orbDiv = orbDivRef.current
      if (!cont || !orbDiv) { frame = requestAnimationFrame(animate); return }

      const cssWidth = cont.offsetWidth
      if (cssWidth < 600) {
        // Fell to mobile — suspend orb but keep RAF alive for resize back
        orbPosRef.current = null
        frame = requestAnimationFrame(animate)
        return
      }

      const currentMode = modeRef.current
      const fontSize    = getFontSize(currentMode, cssWidth)
      const lineHeight  = fontSize * 1.1

      // Figure-8 (2:1 Lissajous): x = sin(2t),  y = sin(t)
      const t    = (now - startMs) / 8000 * Math.PI * 2
      const orbX = cssWidth * 0.72 + Math.sin(2 * t) * 40
      const orbY = lineHeight * 0.5 + Math.sin(t) * lineHeight * 0.32

      orbPosRef.current   = { x: orbX, y: orbY }
      orbDiv.style.left   = `${orbX}px`
      orbDiv.style.top    = `${orbY}px`

      draw()
      frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [draw])

  // ── ResizeObserver — re-layout (or re-prepare if font bucket changed) ──────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ro = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? container.offsetWidth
      if (!width) return

      const currentMode = modeRef.current
      const fontSize    = getFontSize(currentMode, width)
      const fontStr     = getFontString(currentMode, fontSize)

      if (fontStr !== fontStringRef.current) {
        doPrepare(currentMode)
      } else {
        draw()
      }
    })

    ro.observe(container)
    return () => ro.disconnect()
  }, [draw, doPrepare])

  // Re-draw when color changes (mode crossfade)
  useEffect(() => { draw() }, [color, draw])

  // ── Fallback ───────────────────────────────────────────────────────────────
  if (fallback) {
    const fontSize = getFontSize(mode, typeof window !== 'undefined' ? window.innerWidth : 1024)
    return (
      <span
        style={{
          fontFamily:    mode === 'pro' ? '"Instrument Serif", serif' : '"Space Mono", monospace',
          fontSize:      `${fontSize}px`,
          fontWeight:    mode === 'pro' ? 400 : 700,
          color,
          letterSpacing: mode === 'pro' ? '-0.02em' : '0.08em',
          textTransform: mode === 'creative' ? 'uppercase' : 'none',
          display:       'block',
          lineHeight:    1.0,
          margin:        0,
        }}
      >
        {getModeText(mode)}
      </span>
    )
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Canvas — the text surface */}
      <canvas
        ref={canvasRef}
        style={{ display: 'block', background: 'transparent' }}
      />

      {/* Orb — absolute, desktop only, positioned imperatively by rAF */}
      <div
        ref={orbDivRef}
        style={{
          position:             'absolute',
          width:                '60px',
          height:               '60px',
          borderRadius:         '50%',
          background:           `radial-gradient(circle at 38% 38%, ${accent}cc, ${accent}11)`,
          boxShadow:            `0 0 0 1.5px ${accent}44, 0 0 22px 8px ${accent}77, 0 0 55px 22px ${accent}33`,
          opacity:              0.9,
          backdropFilter:       'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          pointerEvents:        'none',
          transform:            'translate(-50%, -50%)',
          // Smooth accent color transitions when mode switches
          transition:           'box-shadow 0.7s ease, background 0.7s ease',
          willChange:           'top, left',
          // top/left intentionally omitted — set imperatively by rAF
        }}
      />
    </div>
  )
}
