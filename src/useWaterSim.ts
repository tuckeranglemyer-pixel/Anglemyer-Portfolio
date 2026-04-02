import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const DAMP = 0.965
const C = 0.24
const RIPPLE_SIGMA = 2.5
const RIPPLE_INTENSITY = 5
const RIPPLE_RADIUS = 6
const GRAD_SCALE = 200
const MID = 128

function gridDimensions() {
  const w = Math.ceil(window.innerWidth / 4)
  const h = Math.ceil(window.innerHeight / 4)
  return { w, h, len: w * h }
}

/**
 * Map CSS screen pixels to sim grid indices.
 * X: left → right matches texture u = 0 → 1.
 * Y: WebGL / DataTexture row 0 is at texture v = 0 (bottom of screen); screen Y grows
 * downward, so we invert: top of screen → gy = h - 1, bottom → gy = 0.
 */
function screenToGrid(screenX: number, screenY: number, w: number, h: number) {
  const W = window.innerWidth
  const H = window.innerHeight
  const gx = Math.min(w - 1, Math.max(0, Math.floor((screenX / W) * w)))
  const gy = Math.min(h - 1, Math.max(0, Math.floor((1 - screenY / H) * h)))
  return { gx, gy }
}

function createDataTexture(w: number, h: number): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4)
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType)
  tex.flipY = false
  tex.needsUpdate = true
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  return tex
}

export function useWaterSim(): {
  displacementMap: THREE.DataTexture
  addRipple: (screenX: number, screenY: number) => void
  update: () => void
} {
  const dimRef = useRef(gridDimensions())
  const prevRef = useRef<Float32Array>(new Float32Array(dimRef.current.len))
  const currRef = useRef<Float32Array>(new Float32Array(dimRef.current.len))
  const nextRef = useRef<Float32Array>(new Float32Array(dimRef.current.len))

  const pixelDataRef = useRef<Uint8Array | null>(null)
  const textureRef = useRef<THREE.DataTexture | null>(null)

  const [displacementMap, setDisplacementMap] = useState<THREE.DataTexture>(() => {
    const { w, h } = gridDimensions()
    const tex = createDataTexture(w, h)
    pixelDataRef.current = tex.image.data as Uint8Array
    textureRef.current = tex
    return tex
  })

  const mouseRef = useRef({ x: 0, y: 0 })
  const lastBumpRef = useRef({ x: Number.NaN, y: Number.NaN })

  const rebuildBuffers = useCallback(() => {
    const d = gridDimensions()
    dimRef.current = d
    prevRef.current = new Float32Array(d.len)
    currRef.current = new Float32Array(d.len)
    nextRef.current = new Float32Array(d.len)

    setDisplacementMap(prev => {
      prev.dispose()
      const tex = createDataTexture(d.w, d.h)
      pixelDataRef.current = tex.image.data as Uint8Array
      textureRef.current = tex
      return tex
    })
  }, [])

  useEffect(() => {
    const onResize = () => {
      rebuildBuffers()
    }
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [rebuildBuffers])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  const addRipple = useCallback((screenX: number, screenY: number) => {
    const { w, h } = dimRef.current
    const curr = currRef.current
    const { gx, gy } = screenToGrid(screenX, screenY, w, h)
    const r2Max = RIPPLE_RADIUS * RIPPLE_RADIUS

    for (let dy = -RIPPLE_RADIUS; dy <= RIPPLE_RADIUS; dy++) {
      for (let dx = -RIPPLE_RADIUS; dx <= RIPPLE_RADIUS; dx++) {
        const d2 = dx * dx + dy * dy
        if (d2 > r2Max) continue
        const nx = gx + dx
        const ny = gy + dy
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
        const bump =
          RIPPLE_INTENSITY * Math.exp(-d2 / (2 * RIPPLE_SIGMA * RIPPLE_SIGMA))
        const idx = ny * w + nx
        curr[idx] += bump
      }
    }
  }, [])

  const update = useCallback(() => {
    const { w, h, len } = dimRef.current
    const prev = prevRef.current
    const curr = currRef.current
    const next = nextRef.current

    const mx = mouseRef.current.x
    const my = mouseRef.current.y
    const lx = lastBumpRef.current.x
    const ly = lastBumpRef.current.y

    if (Number.isFinite(lx) && Number.isFinite(ly)) {
      if (Math.hypot(mx - lx, my - ly) > 2) {
        addRipple(mx, my)
        lastBumpRef.current = { x: mx, y: my }
      }
    } else {
      lastBumpRef.current = { x: mx, y: my }
    }

    for (let i = 0; i < len; i++) {
      const x = i % w
      const y = (i / w) | 0
      const left = x > 0 ? curr[i - 1] : 0
      const right = x < w - 1 ? curr[i + 1] : 0
      const up = y > 0 ? curr[i - w] : 0
      const down = y < h - 1 ? curr[i + w] : 0
      next[i] =
        2 * curr[i] -
        prev[i] +
        C * (left + right + up + down - 4 * curr[i])
      next[i] *= DAMP
    }

    const p = prevRef.current
    const c = currRef.current
    const n = nextRef.current
    prevRef.current = c
    currRef.current = n
    nextRef.current = p

    const currAfter = currRef.current
    const pixels = pixelDataRef.current
    const tex = textureRef.current

    if (!pixels || !tex) return

    for (let i = 0; i < len; i++) {
      const x = i % w
      const y = (i / w) | 0
      const left = x > 0 ? currAfter[i - 1] : currAfter[i]
      const right = x < w - 1 ? currAfter[i + 1] : currAfter[i]
      const up = y > 0 ? currAfter[i - w] : currAfter[i]
      const down = y < h - 1 ? currAfter[i + w] : currAfter[i]
      const dX = (right - left) * 0.5
      const dY = (down - up) * 0.5
      const r = Math.max(0, Math.min(255, Math.round(dX * GRAD_SCALE + MID)))
      const g = Math.max(0, Math.min(255, Math.round(dY * GRAD_SCALE + MID)))
      const o = i * 4
      pixels[o] = r
      pixels[o + 1] = g
      pixels[o + 2] = MID
      pixels[o + 3] = 255
    }

    tex.needsUpdate = true
  }, [addRipple])

  return {
    displacementMap,
    addRipple,
    update,
  }
}
