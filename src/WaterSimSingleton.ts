import * as THREE from 'three'

const DAMP = 0.9
const C = 0.24
const RIPPLE_SIGMA = 10
const RIPPLE_INTENSITY = 150
const RIPPLE_RADIUS = 40

let rippleSystemLogged = false
function logRippleSystemOnce() {
  if (rippleSystemLogged) return
  rippleSystemLogged = true
  console.log(
    '[RippleSystem] found ripple input:',
    'addRipple(screenX, screenY, strengthScale?) adds Gaussian height to the wave grid (curr buffer);',
    'update() advances the 2D wave equation, maps gradients to RGBA DataTexture (R/G ≈ displacement);',
    'mousemove drives periodic addRipple via distance threshold in update();',
    'WaterDisplacementEffect samples displacementMap and offsets fullscreen UVs.',
  )
}
const GRAD_SCALE = 200
const MID = 128

function gridDimensions() {
  const w = Math.ceil(window.innerWidth / 4)
  const h = Math.ceil(window.innerHeight / 4)
  return { w, h, len: w * h }
}

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

/**
 * Standalone wave simulation (Codrops-style): not a React hook, survives all React lifecycles.
 */
export class WaterSim {
  private dim: { w: number; h: number; len: number }
  private prev: Float32Array
  private curr: Float32Array
  private next: Float32Array
  private pixelData: Uint8Array
  private texture: THREE.DataTexture
  private mouse = { x: 0, y: 0 }
  private lastBump = { x: Number.NaN, y: Number.NaN }

  private readonly boundResize: () => void
  private readonly boundMouseMove: (e: MouseEvent) => void

  constructor() {
    this.dim = gridDimensions()
    this.prev = new Float32Array(this.dim.len)
    this.curr = new Float32Array(this.dim.len)
    this.next = new Float32Array(this.dim.len)
    this.texture = createDataTexture(this.dim.w, this.dim.h)
    this.pixelData = this.texture.image.data as Uint8Array

    this.boundResize = () => this.rebuildBuffers()
    window.addEventListener('resize', this.boundResize, { passive: true })

    this.boundMouseMove = (e: MouseEvent) => {
      this.mouse = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', this.boundMouseMove, { passive: true })
  }

  private rebuildBuffers() {
    const d = gridDimensions()
    this.dim = d
    this.prev = new Float32Array(d.len)
    this.curr = new Float32Array(d.len)
    this.next = new Float32Array(d.len)
    this.texture.dispose()
    this.texture = createDataTexture(d.w, d.h)
    this.pixelData = this.texture.image.data as Uint8Array
  }

  addRipple(screenX: number, screenY: number, strengthScale = 1) {
    logRippleSystemOnce()
    const { w, h } = this.dim
    const curr = this.curr
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
          strengthScale *
          RIPPLE_INTENSITY *
          Math.exp(-d2 / (2 * RIPPLE_SIGMA * RIPPLE_SIGMA))
        const idx = ny * w + nx
        curr[idx] += bump
      }
    }
  }

  update() {
    const { w, h, len } = this.dim
    const prev = this.prev
    const curr = this.curr
    const next = this.next

    const mx = this.mouse.x
    const my = this.mouse.y
    const lx = this.lastBump.x
    const ly = this.lastBump.y

    if (Number.isFinite(lx) && Number.isFinite(ly)) {
      if (Math.hypot(mx - lx, my - ly) > 2) {
        this.addRipple(mx, my, 0.08)
        this.lastBump = { x: mx, y: my }
      }
    } else {
      this.lastBump = { x: mx, y: my }
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

    this.prev = curr
    this.curr = next
    this.next = prev

    const currAfter = this.curr
    const pixels = this.pixelData
    const tex = this.texture

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
  }

  getTexture(): THREE.DataTexture {
    return this.texture
  }
}

/** Single process-wide instance; created at import time, independent of React. */
export const waterSim = new WaterSim()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(window as any).__addRipple = waterSim.addRipple.bind(waterSim)
