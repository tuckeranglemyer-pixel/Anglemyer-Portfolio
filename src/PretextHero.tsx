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
/** Match water ripple influence: 0 displacement at edge; full push at cursor center. */
const RADIUS_PX = 45
const MAX_DISPLACE = 16 // px max horizontal push at cursor center
const DESKTOP_MIN_W = 400
const LERP_IN = 0.4 // toward displaced position while cursor in container
const LERP_OUT = 0.35 // snap back when cursor leaves

/** easeOutQuad on [0,1]: slow finish — used for falloff from center to RADIUS_PX. */
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

/** Horizontal push magnitude from 2D distance (px): easeOutQuad falloff, 0 beyond RADIUS_PX. */
function pushMagnitudeAtDistance(dist: number): number {
  if (dist <= 1e-4 || dist > RADIUS_PX) return 0
  const t = dist / RADIUS_PX // 0 at center → 1 at edge
  return MAX_DISPLACE * easeOutQuad(1 - t)
}

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
// Horizontal parting only (dy=0): easeOutQuad falloff 16px @ center → 0 @ 45px; lerp in/out.
export default function PretextHero({ color, accent, mode }: PretextHeroProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const preparedRef   = useRef<PreparedTextWithSegments | null>(null)
  const fontStringRef = useRef('')

  const mouseInHeroRef = useRef(false)
  const mousePosRef    = useRef<{ x: number; y: number } | null>(null)

  const dxRef = useRef<Float32Array | null>(null)
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const colorRef  = useRef(color)
  const modeRef   = useRef(mode)
  const accentRef = useRef(accent) // eslint-disable-line @typescript-eslint/no-unused-vars
  const [fallback, setFallback] = useState(false)

  colorRef.current  = color
  modeRef.current   = mode
  accentRef.current = accent

  const draw = useCallback(() => {
    const canvas    = canvasRef.current
    const container = containerRef.current
    const prepared  = preparedRef.current
    if (!canvas || !container || !prepared) return

    try {
      const dpr      = window.devicePixelRatio || 1
      const rawW     = container.offsetWidth
      const cssWidth = Math.max(100, rawW - 2 * MAX_DISPLACE)
      if (rawW <= 0) return

      const currentMode = modeRef.current
      const fontSize    = getFontSize(currentMode)
      const lineHeight  = fontSize * 1.7

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

      let charIdx = 0
      for (const { text, y } of lines) {
        let charX = 0

        for (const ch of text) {
          const cw  = ctx.measureText(ch).width

          let dx = 0
          const dxa = dxRef.current
          if (dxa && charIdx < dxa.length) dx = dxa[charIdx]

          ctx.fillText(ch, charX + dx, y)
          charX += cw
          charIdx++
        }
      }

      ctx.restore()
    } catch (err) {
      console.warn('PretextHero draw error', err)
    }
  }, [])

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
        if (!measureCanvasRef.current) measureCanvasRef.current = document.createElement('canvas')
        const n = text.length
        dxRef.current = new Float32Array(n)
        draw()
      } catch (err) {
        console.warn('PretextHero prepare failed, using fallback', err)
        setFallback(true)
      }
    },
    [draw],
  )

  useEffect(() => { doPrepare(mode) }, [mode, doPrepare])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mousePosRef.current    = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
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

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let frame: number

    function tick() {
      const cont = containerRef.current
      const prepared = preparedRef.current
      if (!cont || !prepared) { frame = requestAnimationFrame(tick); return }

      const rawW = cont.offsetWidth
      const cssWidth = Math.max(100, rawW - 2 * MAX_DISPLACE)
      if (rawW < DESKTOP_MIN_W) {
        const zx = dxRef.current
        if (zx) zx.fill(0)
        draw()
        frame = requestAnimationFrame(tick)
        return
      }
      const currentMode = modeRef.current
      const fontSize    = getFontSize(currentMode)
      const lineHeight  = fontSize * 1.7

      let lc: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
      let lineY = 0
      const lines: { text: string; y: number }[] = []
      while (lines.length < 60) {
        const line = layoutNextLine(prepared, lc, cssWidth)
        if (line === null) break
        lines.push({ text: line.text, y: lineY })
        lc     = line.end
        lineY += lineHeight
      }

      const totalChars = lines.reduce((s, l) => s + l.text.length, 0)
      let dxa = dxRef.current
      if (!dxa || dxa.length < totalChars) {
        const nx = new Float32Array(totalChars)
        if (dxa) {
          const copy = Math.min(dxa.length, totalChars)
          nx.set(dxa.subarray(0, copy))
        }
        dxRef.current = nx
        dxa = nx
      }

      const mcv = measureCanvasRef.current
      const mctx = mcv?.getContext('2d')
      if (!mctx) { frame = requestAnimationFrame(tick); return }
      mctx.font = fontStringRef.current

      const mp = mousePosRef.current
      const inHero = mouseInHeroRef.current && mp !== null
      const lerpF = inHero ? LERP_IN : LERP_OUT

      let charIdx = 0
      for (const { text, y } of lines) {
        let charX = 0

        for (const ch of text) {
          const cw  = mctx.measureText(ch).width
          const ccx = charX + cw * 0.5
          const ccy = y + fontSize * 0.5

          let tdx = 0
          if (inHero && mp) {
            const ox = ccx - mp.x
            const oy = ccy - mp.y
            const dist = Math.hypot(ox, oy)
            const push = pushMagnitudeAtDistance(dist)
            if (push > 0 && dist > 1e-4) {
              // Horizontal only: keeps baseline; direction from horizontal offset to cursor
              tdx = (ox / dist) * push
            }
          }

          if (charIdx < dxa.length) {
            dxa[charIdx] += (tdx - dxa[charIdx]) * lerpF
          }
          charX += cw
          charIdx++
        }
      }

      draw()
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [draw])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let debounce: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? container.offsetWidth
      if (!width) return
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        debounce = null
        void doPrepare(modeRef.current)
      }, 120)
    })

    ro.observe(container)
    return () => {
      if (debounce) clearTimeout(debounce)
      ro.disconnect()
    }
  }, [doPrepare])

  useEffect(() => { draw() }, [color, draw])

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
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100%',
        overflow: 'hidden',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', background: 'transparent' }}
      />
    </div>
  )
}
