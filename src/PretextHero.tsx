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
const EXCLUSION_RADIUS_PX = 18 // sharp cutoff — only chars within this disk move
const MAX_DISPLACE        = 8  // px — full radial push when inside the disk
const DESKTOP_MIN_W       = 400
const LERP_IN             = 0.4 // toward displaced position while cursor in container
const LERP_OUT            = 0.2 // back to rest when cursor leaves

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
// Tight disk at cursor (18px): full 8px radial push inside, zero outside — no falloff.
export default function PretextHero({ color, accent, mode }: PretextHeroProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const preparedRef   = useRef<PreparedTextWithSegments | null>(null)
  const fontStringRef = useRef('')

  const mouseInHeroRef = useRef(false)
  const mousePosRef    = useRef<{ x: number; y: number } | null>(null)

  const dxRef = useRef<Float32Array | null>(null)
  const dyRef = useRef<Float32Array | null>(null)
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
      const cssWidth = container.offsetWidth
      if (cssWidth <= 0) return

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
          let dy = 0
          const dxa = dxRef.current
          const dya = dyRef.current
          if (dxa && dya && charIdx < dxa.length) {
            dx = dxa[charIdx]
            dy = dya[charIdx]
          }

          ctx.fillText(ch, charX + dx, y + dy)
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
        dyRef.current = new Float32Array(n)
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

      const cssWidth = cont.offsetWidth
      if (cssWidth < DESKTOP_MIN_W) {
        const zx = dxRef.current
        const zy = dyRef.current
        if (zx && zy) {
          zx.fill(0)
          zy.fill(0)
        }
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
      let dya = dyRef.current
      if (!dxa || !dya || dxa.length < totalChars) {
        const nx = new Float32Array(totalChars)
        const ny = new Float32Array(totalChars)
        if (dxa && dya) {
          const copy = Math.min(dxa.length, totalChars)
          nx.set(dxa.subarray(0, copy))
          ny.set(dya.subarray(0, copy))
        }
        dxRef.current = nx
        dyRef.current = ny
        dxa = nx
        dya = ny
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
          let tdy = 0
          if (inHero && mp) {
            const ox = ccx - mp.x
            const oy = ccy - mp.y
            const dist = Math.hypot(ox, oy)
            if (dist <= EXCLUSION_RADIUS_PX && dist > 1e-4) {
              const inv = 1 / dist
              tdx = ox * inv * MAX_DISPLACE
              tdy = oy * inv * MAX_DISPLACE
            }
          }

          if (charIdx < dxa.length) {
            dxa[charIdx] += (tdx - dxa[charIdx]) * lerpF
            dya[charIdx] += (tdy - dya[charIdx]) * lerpF
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
