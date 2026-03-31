import { useEffect, useRef } from 'react'

const RES = 4
const REST = 0.5
const WAVE_COEFF = 0.24
const WAVE_DAMP = 0.965
const BUMP_RADIUS_BUF = 6
const BUMP_INTENSITY = 2.5

/**
 * CPU wave sim + fullscreen caustic overlay (Laplacian white lines). No SVG / WebGL.
 */
export default function WaterRipples() {
  const visibleRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!visibleRef.current?.getContext('2d')) return

    let bufW = 0
    let bufH = 0
    let curr = new Float32Array(0)
    let prev = new Float32Array(0)
    let next = new Float32Array(0)

    const causticScratch = document.createElement('canvas')
    const cctx = causticScratch.getContext('2d')

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

      causticScratch.width = w
      causticScratch.height = h
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

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
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
  )
}
