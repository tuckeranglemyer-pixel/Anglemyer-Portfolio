import { useEffect, useRef, useCallback, useState } from 'react'
import {
  prepareWithSegments,
  layoutNextLine,
  type PreparedTextWithSegments,
  type LayoutCursor,
} from '@chenglou/pretext'

type Mode = 'pro' | 'creative'

export interface PretextHeroProps {
  color:  string
  accent: string
  mode:   Mode
}

// ─── orb type ─────────────────────────────────────────────────────────────────
type Orb = { x: number; y: number; r: number }

// ─── constants ────────────────────────────────────────────────────────────────
// Ambient floating orb — large, gentle drift
const ORB_EFFECTIVE_R = 55
// Fin cursor — 55px radius spans ~3–4 lines at 18px/1.7 line-height, very obvious
const FIN_EFFECTIVE_R = 55
// Y offset so exclusion centers on the fin body, not the sharp tip
const FIN_Y_OFFSET    = 10
// Minimum container width to run the orb/fin effect (desktop only)
const DESKTOP_MIN_W   = 400

// ─── helpers ──────────────────────────────────────────────────────────────────
// Body-paragraph sizes — same on all screen widths
function getFontSize(mode: Mode, _containerWidth?: number): number {
  return mode === 'pro' ? 18 : 16
}

function getFontString(mode: Mode, fontSize: number): string {
  return mode === 'pro'
    ? `400 ${fontSize}px "Instrument Serif"`
    : `400 ${fontSize}px "Space Mono"`
}

function getModeText(mode: Mode): string {
  return mode === 'pro'
    ? 'Builder, founder, operator. Providence College double major in Accounting and Finance. Incoming PwC. Founded Untracked — an AI-powered music discovery platform for DJs. First place at the yconic New England Inter-Collegiate AI Hackathon. D1 athlete. Friars Club tour guide. Student Congress. The kind of person who debugs production on the bus home from giving a campus tour in a blazer.'
    : 'I go to shows alone and talk to strangers about four-on-the-floor kicks. I code AI agents at 2am and give campus tours in a blazer the next morning. I can explain deferred tax assets and why UK garage never got the American respect it deserved — same breath. Built a hackathon-winning AI engine with a two-person team against CS grad students from Brown and Northeastern. The range is the point.'
}

// ─── exclusion zone ───────────────────────────────────────────────────────────
// For a circular orb at (orb.x, orb.y) with effective radius orb.r,
// compute the xOffset and maxWidth for a line in the band [lineY, lineY+lineHeight].
function getLineExclusion(
  lineY:          number,
  lineHeight:     number,
  orb:            Orb | null,
  containerWidth: number,
): { xOffset: number; maxWidth: number } {
  if (!orb) return { xOffset: 0, maxWidth: containerWidth }

  // Nearest y on the band to the orb center
  const clampedY = Math.max(lineY, Math.min(orb.y, lineY + lineHeight))
  const dy       = Math.abs(orb.y - clampedY)

  if (dy >= orb.r) return { xOffset: 0, maxWidth: containerWidth }

  const chordHalf = Math.sqrt(orb.r * orb.r - dy * dy)
  const orbLeft   = orb.x - chordHalf
  const orbRight  = orb.x + chordHalf

  if (orb.x <= containerWidth / 2) {
    // Orb on left — text starts after right edge of exclusion chord
    const xOff = Math.max(0, Math.min(orbRight, containerWidth * 0.75))
    return { xOffset: xOff, maxWidth: Math.max(60, containerWidth - xOff) }
  } else {
    // Orb on right — text is limited to left edge of exclusion chord
    return { xOffset: 0, maxWidth: Math.max(60, orbLeft) }
  }
}

// ─── PretextHero ──────────────────────────────────────────────────────────────
export default function PretextHero({ color, accent, mode }: PretextHeroProps) {
  const containerRef   = useRef<HTMLDivElement>(null)
  const canvasRef      = useRef<HTMLCanvasElement>(null)
  const preparedRef    = useRef<PreparedTextWithSegments | null>(null)
  const fontStringRef  = useRef('')
  // Ambient floating orb — drives text flow when fin is not in the hero
  const orbPosRef      = useRef<Orb | null>(null)
  // Fin cursor position — overrides orbPosRef when mouse is in the hero
  const mouseInHeroRef = useRef(false)
  const mousePosRef    = useRef<Orb | null>(null)

  const colorRef  = useRef(color)
  const accentRef = useRef(accent)  // eslint-disable-line @typescript-eslint/no-unused-vars
  const modeRef   = useRef(mode)
  const [fallback, setFallback] = useState(false)

  colorRef.current  = color
  accentRef.current = accent
  modeRef.current   = mode

  // ── draw (hot path) ───────────────────────────────────────────────────────
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
      const lineHeight  = fontSize * 1.7

      // Fin cursor takes priority over floating orb when mouse is in hero
      const orb: Orb | null = cssWidth >= DESKTOP_MIN_W
        ? (mouseInHeroRef.current && mousePosRef.current
            ? mousePosRef.current
            : orbPosRef.current)
        : null

      // ── layoutNextLine loop with per-line exclusion zone ─────────────────
      let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
      let y                    = 0
      const rendered: { text: string; x: number; y: number }[] = []
      const MAX_LINES = 60

      while (rendered.length < MAX_LINES) {
        const { xOffset, maxWidth } = getLineExclusion(y, lineHeight, orb, cssWidth)

        if (maxWidth < fontSize * 2) {
          // Exclusion zone completely blocks this band — skip the slot
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

  // Re-prepare on mode change
  useEffect(() => {
    doPrepare(mode)
  }, [mode, doPrepare])

  // ── Mouse tracking — fin cursor drives exclusion when in hero ─────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mousePosRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top + FIN_Y_OFFSET,
        r: FIN_EFFECTIVE_R,
      }
      mouseInHeroRef.current = true
      draw()
    }

    const onMouseLeave = () => {
      mouseInHeroRef.current = false
      mousePosRef.current    = null
      draw()
    }

    container.addEventListener('mousemove', onMouseMove, { passive: true })
    container.addEventListener('mouseleave', onMouseLeave)
    return () => {
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [draw])

  // ── Ambient floating orb — drifts through the paragraph, desktop only ─────
  useEffect(() => {
    const container = containerRef.current
    if (!container || container.offsetWidth < DESKTOP_MIN_W) return

    const startMs = performance.now()
    let frame: number

    function animate(now: number) {
      const cont = containerRef.current
      if (!cont) { frame = requestAnimationFrame(animate); return }

      const cssWidth = cont.offsetWidth
      if (cssWidth < DESKTOP_MIN_W) {
        orbPosRef.current = null
        frame = requestAnimationFrame(animate)
        return
      }

      const currentMode = modeRef.current
      const fontSize    = getFontSize(currentMode, cssWidth)
      const lineHeight  = fontSize * 1.7

      // Figure-8 (2:1 Lissajous) — floats through ~lines 2–8 of the paragraph
      const t    = (now - startMs) / 8000 * Math.PI * 2
      const orbX = cssWidth * 0.72 + Math.sin(2 * t) * 40
      const orbY = lineHeight * 5 + Math.sin(t) * lineHeight * 3

      orbPosRef.current = { x: orbX, y: orbY, r: ORB_EFFECTIVE_R }

      // Only draw from rAF when fin is NOT in the hero — mouse events handle it otherwise
      if (!mouseInHeroRef.current) draw()

      frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [draw])

  // ── ResizeObserver ────────────────────────────────────────────────────────
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

  // Re-draw on color change
  useEffect(() => { draw() }, [color, draw])

  // ── Fallback ───────────────────────────────────────────────────────────────
  if (fallback) {
    return (
      <p
        style={{
          fontFamily:  mode === 'pro' ? '"Instrument Serif", serif' : '"Space Mono", monospace',
          fontSize:    mode === 'pro' ? '18px' : '16px',
          fontWeight:  400,
          color,
          lineHeight:  1.7,
          margin:      0,
        }}
      >
        {getModeText(mode)}
      </p>
    )
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', background: 'transparent' }}
      />
    </div>
  )
}
