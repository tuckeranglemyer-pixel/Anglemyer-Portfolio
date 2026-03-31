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
const CHAR_RADIUS  = 30    // px — characters within this distance respond
const CHAR_PUSH    = 24    // px — max radial push when orb is at full radius
const FIN_Y_OFFSET = 10    // shift exclusion centre down slightly (fin body, not tip)
const DESKTOP_MIN_W = 400  // below this width: skip animation, just draw text
const LERP_IN      = 0.20  // orb lerp speed while cursor is in container
const LERP_OUT     = 0.07  // orb lerp speed after cursor leaves (~300 ms settle)

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

// ─── PretextHero ──────────────────────────────────────────────────────────────
// CHARACTER-LEVEL text flow:
//   1. Layout all lines at natural width (no exclusion zone manipulation).
//   2. For each character in each line, measure its x position with measureText.
//   3. If the character centre falls within the animated orb radius, push it
//      radially outward by up to CHAR_PUSH px (easeOutQuad falloff, scaled by
//      orb.r so the effect ramps up smoothly on cursor entry).
//
// The result: individual glyphs part around the cursor like water molecules,
// not whole lines jumping sideways.
export default function PretextHero({ color, accent, mode }: PretextHeroProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const preparedRef   = useRef<PreparedTextWithSegments | null>(null)
  const fontStringRef = useRef('')

  // Animated orb: lerps between cursor-following and ambient Lissajous drift.
  // orb.r ramps from 0 on mount; scales the push so entry is always smooth.
  const animOrbRef = useRef<{ x: number; y: number; r: number } | null>(null)

  const mouseInHeroRef = useRef(false)
  const mousePosRef    = useRef<{ x: number; y: number } | null>(null)

  const colorRef  = useRef(color)
  const modeRef   = useRef(mode)
  const accentRef = useRef(accent) // eslint-disable-line @typescript-eslint/no-unused-vars
  const [fallback, setFallback] = useState(false)

  colorRef.current  = color
  modeRef.current   = mode
  accentRef.current = accent

  // ── draw ──────────────────────────────────────────────────────────────────
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

      // Only apply character displacement on desktop
      const orb = cssWidth >= DESKTOP_MIN_W ? animOrbRef.current : null

      // ── Step 1: full layout — natural line breaks, no exclusion ───────────
      let lc: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
      let lineY = 0
      const lines: { text: string; y: number }[] = []
      const MAX_LINES = 60

      while (lines.length < MAX_LINES) {
        const line = layoutNextLine(prepared, lc, cssWidth)
        if (line === null) break
        lines.push({ text: line.text, y: lineY })
        lc     = line.end
        lineY += lineHeight
      }

      const cssHeight = Math.max(lineY, lineHeight)

      // Resize canvas only when dimensions change — resizing resets context state
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

      // ── Step 2: draw each character with radial displacement ──────────────
      // Characters directly under the orb centre are pushed the full CHAR_PUSH;
      // the push falls off with easeOutQuad as distance approaches orb.r.
      // Scaling push by (orb.r / CHAR_RADIUS) means the effect is gentle while
      // the orb ramps up on entry and fades back to the ambient size on exit.
      for (const { text, y } of lines) {
        let charX = 0

        for (const ch of text) {
          const cw  = ctx.measureText(ch).width
          const ccx = charX + cw * 0.5       // glyph visual centre x
          const ccy = y     + fontSize * 0.5  // glyph visual centre y

          let dx = 0
          let dy = 0

          if (orb && orb.r > 0.5) {
            const dist = Math.hypot(ccx - orb.x, ccy - orb.y)
            if (dist < orb.r && dist > 0.5) {
              const t        = dist / orb.r
              const strength = 1 - t * t                    // easeOutQuad falloff
              const scale    = orb.r / CHAR_RADIUS           // smooth ramp-in/out
              const push     = CHAR_PUSH * strength * scale
              dx = ((ccx - orb.x) / dist) * push
              dy = ((ccy - orb.y) / dist) * push
            }
          }

          ctx.fillText(ch, charX + dx, y + dy)
          charX += cw
        }
      }

      ctx.restore()
    } catch (err) {
      console.warn('PretextHero draw error', err)
    }
  }, [])

  // ── prepare ──────────────────────────────────────────────────────────────
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
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mousePosRef.current    = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top + FIN_Y_OFFSET,
      }
      mouseInHeroRef.current = true
    }

    const onMouseLeave = () => {
      mouseInHeroRef.current = false
      mousePosRef.current    = null
    }

    container.addEventListener('mousemove',  onMouseMove,  { passive: true })
    container.addEventListener('mouseleave', onMouseLeave)
    return () => {
      container.removeEventListener('mousemove',  onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  // ── Unified animation loop ─────────────────────────────────────────────────
  // Manages one orb that lerps between:
  //   • cursor hover  → cursor position, r = CHAR_RADIUS, fast LERP_IN
  //   • idle/ambient  → slow Lissajous figure-8, r = CHAR_RADIUS*0.4, slow LERP_OUT
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

      // Slow Lissajous — drifts gently through the paragraph
      const elapsed = (now - startMs) / 10000 * Math.PI * 2
      const ambX    = cssWidth * 0.70 + Math.sin(2 * elapsed) * 28
      const ambY    = lineHeight * 4   + Math.sin(elapsed)    * lineHeight * 2

      const mp     = mousePosRef.current
      const inHero = mouseInHeroRef.current && mp !== null

      const targetX = inHero ? mp!.x             : ambX
      const targetY = inHero ? mp!.y             : ambY
      const targetR = inHero ? CHAR_RADIUS : CHAR_RADIUS * 0.4

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

  useEffect(() => { draw() }, [color, draw])

  // ── Fallback ──────────────────────────────────────────────────────────────
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
