import { useEffect, useLayoutEffect, useRef } from 'react'

const RES = 4
const REST = 0.5
const WAVE_COEFF = 0.24
const WAVE_DAMP = 0.965
const BUMP_RADIUS_BUF = 6
const BUMP_INTENSITY = 2.5
const GRAD_ENCODE = 520
const MAIN_TARGET_ID = 'main-water-target'

function setNeutralFeImageHref() {
  const fe = document.getElementById('water-fe-map')
  if (!fe) return
  const c = document.createElement('canvas')
  c.width = c.height = 1
  const ctx = c.getContext('2d')
  if (!ctx) return
  const d = ctx.createImageData(1, 1)
  d.data[0] = d.data[1] = d.data[2] = 128
  d.data[3] = 255
  ctx.putImageData(d, 0, 0)
  fe.setAttribute('href', c.toDataURL('image/png'))
}

export default function WaterRipples() {
  const visibleRef = useRef<HTMLCanvasElement>(null)

  useLayoutEffect(() => {
    setNeutralFeImageHref()
  }, [])

  useEffect(() => {
    if (!visibleRef.current?.getContext('2d')) return

    let bufW = 0
    let bufH = 0
    let curr = new Float32Array(0)
    let prev = new Float32Array(0)
    let next = new Float32Array(0)

    const causticScratch = document.createElement('canvas')
    const cctx = causticScratch.getContext('2d')
    const dispCanvas = document.createElement('canvas')
    const dctx = dispCanvas.getContext('2d')
    let dispImageData: ImageData | null = null

    let mouseBufX = -1000
    let mouseBufY = -1000
    let prevBlobUrl: string | null = null
    let mapGen = 0

    function allocBuffers() {
      const w = Math.max(2, Math.floor(window.innerWidth / RES))
      const h = Math.max(2, Math.floor(window.innerHeight / RES))
      if (w === bufW && h === bufH) return
      bufW = w
      bufH = h
      const n = w * h
      curr = new Float32Array(n)
      prev = new Float32Array(n)
      next = new Float32Array(n)
      curr.fill(REST)
      prev.fill(REST)
      next.fill(REST)

      causticScratch.width = w
      causticScratch.height = h
      dispCanvas.width = w
      dispCanvas.height = h
      dispImageData = dctx ? dctx.createImageData(w, h) : null
    }

    function addGaussianBump(
      buf: Float32Array,
      w: number,
      h: number,
      cx: number,
      cy: number,
      radiusPx: number,
      intensity: number,
    ) {
      const sigma = radiusPx / 2.5
      const r2 = radiusPx * radiusPx
      const x0 = Math.max(0, Math.ceil(cx - radiusPx - 1))
      const x1 = Math.min(w - 1, Math.floor(cx + radiusPx + 1))
      const y0 = Math.max(0, Math.ceil(cy - radiusPx - 1))
      const y1 = Math.min(h - 1, Math.floor(cy + radiusPx + 1))
      for (let y = y0; y <= y1; y++) {
        const dy = y - cy
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx
          const d2 = dx * dx + dy * dy
          if (d2 > r2) continue
          const g = Math.exp(-d2 / (2 * sigma * sigma))
          buf[y * w + x] += intensity * g
        }
      }
    }

    function fillDisplacementImageData(heights: Float32Array, w: number, h: number, out: ImageData) {
      const d = out.data
      let p = 0
      for (let gy = 0; gy < h; gy++) {
        for (let gx = 0; gx < w; gx++) {
          const hL = heights[gy * w + Math.max(0, gx - 1)]
          const hR = heights[gy * w + Math.min(w - 1, gx + 1)]
          const hU = heights[Math.max(0, gy - 1) * w + gx]
          const hD = heights[Math.min(h - 1, gy + 1) * w + gx]
          const dx = (hR - hL) * 0.5
          const dy = (hU - hD) * 0.5
          const encX = Math.max(-127, Math.min(127, Math.round(dx * GRAD_ENCODE)))
          const encY = Math.max(-127, Math.min(127, Math.round(-dy * GRAD_ENCODE)))
          d[p++] = 128 + encX
          d[p++] = 128 + encY
          d[p++] = 128
          d[p++] = 255
        }
      }
    }

    allocBuffers()

    const onMove = (e: MouseEvent) => {
      mouseBufX = e.clientX / RES
      mouseBufY = e.clientY / RES
    }
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      const t = e.touches[0]
      mouseBufX = t.clientX / RES
      mouseBufY = t.clientY / RES
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('touchstart', onTouch, { passive: true })

    const resize = () => {
      allocBuffers()
      const el = visibleRef.current
      if (el) {
        el.width = window.innerWidth
        el.height = window.innerHeight
      }
    }
    window.addEventListener('resize', resize, { passive: true })
    resize()

    let raf = 0
    function tick() {
      const vis = visibleRef.current
      const ctx2d = vis?.getContext('2d')
      if (!vis || !ctx2d) {
        raf = requestAnimationFrame(tick)
        return
      }
      const w = bufW
      const h = bufH
      const size = w * h

      for (let y = 1; y < h - 1; y++) {
        const row = y * w
        for (let x = 1; x < w - 1; x++) {
          const i = row + x
          const c = curr[i]
          const lap = curr[i - 1] + curr[i + 1] + curr[i - w] + curr[i + w] - 4 * c
          next[i] = (2 * c - prev[i] + WAVE_COEFF * lap) * WAVE_DAMP
        }
      }

      for (let x = 0; x < w; x++) {
        next[x] = REST
        next[(h - 1) * w + x] = REST
      }
      for (let y = 0; y < h; y++) {
        const row = y * w
        next[row] = REST
        next[row + w - 1] = REST
      }

      if (mouseBufX > -500 && mouseBufY > -500) {
        addGaussianBump(next, w, h, mouseBufX, mouseBufY, BUMP_RADIUS_BUF, BUMP_INTENSITY)
      }

      for (let i = 0; i < size; i++) {
        const v = next[i]
        if (v < 0) next[i] = 0
        else if (v > 3) next[i] = 3
      }

      const tmp = prev
      prev = curr
      curr = next
      next = tmp

      // ── Part 2: caustic lines (quarter-res → fullscreen, smoothed) ──
      if (cctx && causticScratch.width === w && causticScratch.height === h) {
        const cimg = cctx.createImageData(w, h)
        cimg.data.fill(0)
        const cd = cimg.data
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = y * w + x
            const hc = curr[i]
            const hL = curr[i - 1]
            const hR = curr[i + 1]
            const hT = curr[i - w]
            const hB = curr[i + w]
            const lap = Math.abs(4 * hc - hL - hR - hT - hB)
            const a = Math.min(255, lap * 600)
            const p = (y * w + x) * 4
            cd[p] = 255
            cd[p + 1] = 255
            cd[p + 2] = 255
            cd[p + 3] = a
          }
        }
        cctx.putImageData(cimg, 0, 0)
        ctx2d.clearRect(0, 0, vis.width, vis.height)
        ctx2d.imageSmoothingEnabled = true
        ctx2d.drawImage(causticScratch, 0, 0, w, h, 0, 0, vis.width, vis.height)
      }

      // ── Part 3: displacement map blob + filter nudge ──
      if (dctx && dispImageData && dispImageData.width === w && dispImageData.height === h) {
        fillDisplacementImageData(curr, w, h, dispImageData)
        dctx.putImageData(dispImageData, 0, 0)
        const myGen = ++mapGen
        dispCanvas.toBlob(blob => {
          if (!blob || myGen !== mapGen) return
          const fe = document.getElementById('water-fe-map')
          const mainEl = document.getElementById(MAIN_TARGET_ID)
          if (!fe || !mainEl) return
          const old = prevBlobUrl
          prevBlobUrl = URL.createObjectURL(blob)
          fe.setAttribute('href', prevBlobUrl)
          if (old) URL.revokeObjectURL(old)
          mainEl.style.filter = 'none'
          requestAnimationFrame(() => {
            if (myGen === mapGen) mainEl.style.filter = 'url(#water-distort)'
          })
        }, 'image/png')
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('resize', resize)
      if (prevBlobUrl) URL.revokeObjectURL(prevBlobUrl)
      const mainEl = document.getElementById(MAIN_TARGET_ID)
      if (mainEl) mainEl.style.filter = 'none'
      setNeutralFeImageHref()
    }
  }, [])

  return (
    <>
      <svg
        aria-hidden
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      >
        <defs>
          <filter
            id="water-distort"
            filterUnits="objectBoundingBox"
            x="0"
            y="0"
            width="1"
            height="1"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              id="water-fe-map"
              result="map"
              x="0"
              y="0"
              width="1"
              height="1"
              preserveAspectRatio="none"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={12}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
      <canvas
        ref={visibleRef}
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          background: 'transparent',
        }}
      />
    </>
  )
}
