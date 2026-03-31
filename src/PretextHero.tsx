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

// ─── constants ────────────────────────────────────────────────────────────────
const FIN_EFFECTIVE_R = 22    // vertical reach of cursor exclusion (px)
const ORB_EFFECTIVE_R = 20    // ambient orb vertical reach — same range, tiny push
const MAX_GAP         = 8     // max horizontal push at cursor centre (px) — text nearly kisses cursor
const FIN_Y_OFFSET    = 10    // shift so exclusion centres on fin body, not tip
const DESKTOP_MIN_W   = 400   // mobile: skip animation entirely
const LERP_IN         = 0.20  // cursor-tracking lerp (≈3 frames to 50%)
const LERP_OUT        = 0.07  // exit → ambient lerp (~300ms visual return)

// ─── font helpers ─────────────────────────────────────────────────────────────
function getFontSize(mode: Mode): number {
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

// ─── surgical exclusion zone ──────────────────────────────────────────────────
// Radius (FIN_EFFECTIVE_R) controls the VERTICAL span of influence — how many
// lines are touched at all. The HORIZONTAL push is decoupled and capped at
// MAX_GAP = 8px, so text nearly kisses the cursor (≤ 8px clearance).
//
// Falloff: easeInQuad  strength = (1 − t)²
//   t = 0 (cursor centre)  → strength = 1.00  → push = MAX_GAP (8 px)
//   t = 0.5                → strength = 0.25  → push = 2 px  (barely perceptible)
//   t = 1 (radius edge)    → strength = 0.00  → push = 0 px
//
// Compared with the previous easeOutQuad (1 − t²), the easeInQuad curve is
// much steeper away from the centre — the text "knife-parts" around the cursor
// instead of spreading a diffuse force-field.
function getLineExclusion(
  lineY:          number,
  lineHeight:     number,
  orb:            { x: number; y: number; r: number } | null,
  containerWidth: number,
): { xOffset: number; maxWidth: number } {
  if (!orb || orb.r < 1) return { xOffset: 0, maxWidth: containerWidth }

  const midY = lineY + lineHeight * 0.5
  const dy   = Math.abs(orb.y - midY)
  const t    = dy / orb.r

  if (t >= 1) return { xOffset: 0, maxWidth: containerWidth }

  // easeInQuad: steep concentration near the centre, near-zero at the fringe
  const strength  = (1 - t) * (1 - t)
  const chordHalf = MAX_GAP * strength   // ≤ 8 px always

  const orbLeft  = orb.x - chordHalf
  const orbRight = orb.x + chordHalf

  if (orb.x <= containerWidth * 0.55) {
    const xOff = Math.max(0, Math.min(orbRight, containerWidth * 0.72))
    return { xOffset: xOff, maxWidth: Math.max(80, containerWidth - xOff) }
  } else {
    return { xOffset: 0, maxWidth: Math.max(80, orbLeft) }
  }
}

// ─── PretextHero ──────────────────────────────────────────────────────────────
export default function PretextHero({ color, accent, mode }: PretextHeroProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const preparedRef   = useRef<PreparedTextWithSegments | null>(null)
  const fontStringRef = useRef('')

  // Single animated orb whose position and radius are lerped each rAF frame.
  // It transitions smoothly between cursor-following (LERP_IN) and
  // ambient Lissajous drift (LERP_OUT), acting as one continuous motion.
  const animOrbRef = useRef<{ x: number; y: number; r: number } | null>(null)

  // Raw cursor state — updated on mousemove, consumed by the rAF loop
  const mouseInHeroRef = useRef(false)
  const mousePosRef    = useRef<{ x: number; y: number } | null>(null)

  const colorRef  = useRef(color)
  const modeRef   = useRef(mode)
  const accentRef = useRef(accent) // eslint-disable-line @typescript-eslint/no-unused-vars
  const [fallback, setFallback] = useState(false)

  colorRef.current  = color
  modeRef.current   = mode
  accentRef.current = accent

  // ── draw ─────────────────────────────────────────────────────────────────
  // Pure render: reads animOrbRef for the exclusion zone, never writes refs.
  // DPR scaling: canvas pixel dimensions = CSS dimensions × devicePixelRatio,
  // then ctx.scale(dpr, dpr) so all drawing uses CSS coordinates — sharp text.
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
      const fontSize    = getFontSize(currentMode)
      const lineHeight  = fontSize * 1.7

      // Mobile gets no orb; desktop gets the animated orb (may be null initially)
      const orb = cssWidth >= DESKTOP_MIN_W ? animOrbRef.current : null

      // ── Lay out lines with per-line soft exclusion ───────────────────────
      let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
      let y = 0
      const rendered: { text: string; x: number; y: number }[] = []
      const MAX_LINES = 60

      while (rendered.length < MAX_LINES) {
        const { xOffset, maxWidth } = getLineExclusion(y, lineHeight, orb, cssWidth)

        if (maxWidth < fontSize * 3) {
          // Exclusion completely covers this band — slide past it
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

      // Only update canvas dimensions when they actually change — avoids
      // resetting context state (font, fillStyle) unnecessarily every frame
      const targetW = Math.round(cssWidth  * dpr)
      const targetH = Math.round(cssHeight * dpr)
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width        = targetW
        canvas.height       = targetH
        canvas.style.width  = `${cssWidth}px`
        canvas.style.height = `${cssHeight}px`
      }

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
      console.warn('PretextHero draw error', err)
    }
  }, [])

  // ── prepare ───────────────────────────────────────────────────────────────
  const doPrepare = useCallback(
    async (targetMode: Mode) => {
      const container = containerRef.current
      if (!container) return

      const fontSize = getFontSize(targetMode)
      const fontStr  = getFontString(targetMode, fontSize)
      const text     = getModeText(targetMode)

      try {
        await document.fonts.ready
        preparedRef.current   = prepareWithSegments(text, fontStr)
        fontStringRef.current = fontStr
        draw()
      } catch (err) {
        console.warn('PretextHero prepare failed, using fallback', err)
        setFallback(true)
      }
    },
    [draw],
  )

  useEffect(() => { doPrepare(mode) }, [mode, doPrepare])

  // ── Mouse tracking ────────────────────────────────────────────────────────
  // Only updates refs — the unified rAF loop owns all drawing.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mousePosRef.current   = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top + FIN_Y_OFFSET,
      }
      mouseInHeroRef.current = true
    }

    const onMouseLeave = () => {
      mouseInHeroRef.current = false
      mousePosRef.current    = null
    }

    container.addEventListener('mousemove', onMouseMove, { passive: true })
    container.addEventListener('mouseleave', onMouseLeave)
    return () => {
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  // ── Unified animation loop ────────────────────────────────────────────────
  // Manages one animated orb that smoothly switches between two targets:
  //   • In hero  → cursor position, r = FIN_EFFECTIVE_R, fast lerp (LERP_IN)
  //   • Out/idle → ambient Lissajous, r = ORB_EFFECTIVE_R, slow lerp (LERP_OUT)
  //
  // This means "exit" animation = orb drifts from cursor back to ambient
  // over ~300ms (at LERP_OUT = 0.07, 73% settled in 18 frames = 300ms).
  useEffect(() => {
    const container = containerRef.current
    if (!container || container.offsetWidth < DESKTOP_MIN_W) return

    const startMs = performance.now()
    let frame: number

    function tick(now: number) {
      const cont = containerRef.current
      if (!cont) { frame = requestAnimationFrame(tick); return }

      const cssWidth    = cont.offsetWidth
      const currentMode = modeRef.current
      const fontSize    = getFontSize(currentMode)
      const lineHeight  = fontSize * 1.7

      // Ambient Lissajous — slow 2:1 figure-8, right-side drift through paragraph
      const elapsed = (now - startMs) / 10000 * Math.PI * 2
      const ambX    = cssWidth * 0.70 + Math.sin(2 * elapsed) * 28
      const ambY    = lineHeight * 4   + Math.sin(elapsed)    * lineHeight * 2

      // Target: cursor or ambient
      const mp      = mousePosRef.current
      const inHero  = mouseInHeroRef.current && mp !== null
      const targetX = inHero ? mp!.x          : ambX
      const targetY = inHero ? mp!.y          : ambY
      const targetR = inHero ? FIN_EFFECTIVE_R : ORB_EFFECTIVE_R

      // Initialise animated orb at the ambient position with r = 0 so it
      // gently ramps up rather than snapping on the first frame
      if (!animOrbRef.current) {
        animOrbRef.current = { x: ambX, y: ambY, r: 0 }
      }

      const anim = animOrbRef.current
      const lf   = inHero ? LERP_IN : LERP_OUT

      anim.x += (targetX - anim.x) * lf
      anim.y += (targetY - anim.y) * lf
      anim.r += (targetR - anim.r) * lf

      draw()

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
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
      const fontSize    = getFontSize(currentMode)
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

  // Re-draw when color prop changes
  useEffect(() => { draw() }, [color, draw])

  // ── Fallback ───────────────────────────────────────────────────────────────
  if (fallback) {
    return (
      <p
        style={{
          fontFamily: mode === 'pro' ? '"Instrument Serif", serif' : '"Space Mono", monospace',
          fontSize:   mode === 'pro' ? '18px' : '16px',
          fontWeight: 400,
          color,
          lineHeight: 1.7,
          margin:     0,
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
