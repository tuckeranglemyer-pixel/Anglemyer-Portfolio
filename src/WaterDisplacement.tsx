import { useEffect, useRef } from 'react'

const REST = 0.5
/** Quarter-resolution sim buffer: window.innerWidth/4 × window.innerHeight/4 */
const RES = 4
/** Gaussian bump in buffer pixels (~32px screen); intensity added each frame near cursor */
const BUMP_RADIUS_BUF = 8
const BUMP_INTENSITY = 3.0

/** Maps height gradient to 8-bit deviation from 128 (pairs with feDisplacementMap scale). */
const GRAD_ENCODE = 520

const WATER_DEBUG_REDDEN = false

function setNeutralFeImage() {
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

function sampleH(h: Float32Array, bufW: number, bufH: number, x: number, y: number): number {
  const xi = Math.max(0, Math.min(bufW - 1, x | 0))
  const yi = Math.max(0, Math.min(bufH - 1, y | 0))
  return h[yi * bufW + xi]
}

/** Encode heightmap gradients into R/G for feDisplacementMap (128 = no displacement). */
function fillGradientImageData(
  heights: Float32Array,
  bufW: number,
  bufH: number,
  gradW: number,
  gradH: number,
  out: ImageData,
) {
  const d = out.data
  let p = 0
  for (let gy = 0; gy < gradH; gy++) {
    for (let gx = 0; gx < gradW; gx++) {
      const u = (gx + 0.5) / gradW
      const v = (gy + 0.5) / gradH
      const glX = u * bufW - 0.5
      const glY = (1.0 - v) * bufH - 0.5

      const hL = sampleH(heights, bufW, bufH, glX - 1, glY)
      const hR = sampleH(heights, bufW, bufH, glX + 1, glY)
      const hD = sampleH(heights, bufW, bufH, glX, glY - 1)
      const hU = sampleH(heights, bufW, bufH, glX, glY + 1)
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

function addGaussianBump(
  buf: Float32Array,
  bufW: number,
  bufH: number,
  cx: number,
  cy: number,
  radiusPx: number,
  intensity: number,
) {
  const sigma = radiusPx / 2.5
  const r2 = radiusPx * radiusPx
  const x0 = Math.max(0, Math.ceil(cx - radiusPx - 1))
  const x1 = Math.min(bufW - 1, Math.floor(cx + radiusPx + 1))
  const y0 = Math.max(0, Math.ceil(cy - radiusPx - 1))
  const y1 = Math.min(bufH - 1, Math.floor(cy + radiusPx + 1))
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const d2 = dx * dx + dy * dy
      if (d2 > r2) continue
      const g = Math.exp(-d2 / (2 * sigma * sigma))
      buf[y * bufW + x] += intensity * g
    }
  }
}

export default function WaterDisplacement() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return

    const surface = canvasRef.current
    if (!surface) return

    if (!surface.getContext('2d')) return

    let bufW = 0
    let bufH = 0
    let curr = new Float32Array(0)
    let prev = new Float32Array(0)
    let next = new Float32Array(0)

    const gradCanvas = document.createElement('canvas')
    const gctx = gradCanvas.getContext('2d')
    let imageData: ImageData | null = null

    let mouseBufX = -1000
    let mouseBufY = -1000

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

    const onResize = () => {
      allocBuffers()
    }
    window.addEventListener('resize', onResize, { passive: true })

    let raf = 0
    function tick() {
      const w = bufW
      const h = bufH
      const size = w * h

      for (let y = 1; y < h - 1; y++) {
        const row = y * w
        for (let x = 1; x < w - 1; x++) {
          const i = row + x
          const c = curr[i]
          const lap = curr[i - 1] + curr[i + 1] + curr[i - w] + curr[i + w] - 4 * c
          next[i] = (2 * c - prev[i] + 0.25 * lap) * 0.97
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
        else if (v > 2) next[i] = 2
      }

      const tmp = prev
      prev = curr
      curr = next
      next = tmp

      const gradW = w
      const gradH = h

      if (gctx && gradW > 0 && gradH > 0) {
        if (gradCanvas.width !== gradW || gradCanvas.height !== gradH) {
          gradCanvas.width = gradW
          gradCanvas.height = gradH
          imageData = gctx.createImageData(gradW, gradH)
        }
        if (imageData) {
          fillGradientImageData(curr, w, h, gradW, gradH, imageData)
          gctx.putImageData(imageData, 0, 0)
          const url = gradCanvas.toDataURL('image/png')
          const fe = document.getElementById('water-fe-map')
          if (fe) fe.setAttribute('href', url)
        }
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('resize', onResize)
      setNeutralFeImage()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      width={1}
      height={1}
      style={{
        display: 'none',
        position: 'fixed',
        left: 0,
        top: 0,
        pointerEvents: 'none',
        ...(WATER_DEBUG_REDDEN ? { display: 'block', width: 40, height: 40, opacity: 0.5, zIndex: 9998, background: 'red' } : {}),
      }}
    />
  )
}
