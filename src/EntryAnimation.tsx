import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT      = 500
const TUBE_R     = 2.4
const TUBE_LEN   = 22     // short tube — more particles near camera in the brief warp window
const V0         = 80     // initial warp speed (units/s)
const DECAY      = 5.75   // slam: near-zero by ~0.8s (v(0.8) ≈ 0.8 u/s)
const WARP_DUR   = 1.0
const SETTLE_DUR = 0.42   // 420ms splat
const SHAKE_DUR  = 0.18   // ~200ms violent shake
const SHAKE_AMP  = 0.30
const HOLD_DUR   = 0.5

// Overshoot: particles punch 25% past target then snap back
// c1=3.0 → ~25% overshoot at p≈0.5 of settle duration
function easeOutBack(x: number): number {
  const c1 = 3.0
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

// Soft gaussian glow as a canvas texture — AdditiveBlending makes overlaps bloom
function createGlowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width  = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c)
  grad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)')
  grad.addColorStop(0.12, 'rgba(210, 218, 255, 0.85)')
  grad.addColorStop(0.35, 'rgba(160, 170, 255, 0.35)')
  grad.addColorStop(0.65, 'rgba(100, 110, 220, 0.08)')
  grad.addColorStop(1.00, 'rgba(0, 0, 0, 0.0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

function Scene({ onComplete }: { onComplete: () => void }) {
  const geoRef     = useRef<THREE.BufferGeometry>(null!)
  const { camera } = useThree()
  const elapsed    = useRef(0)
  const snapshot   = useRef<Float32Array | null>(null)
  // settled positions computed from snapshot angles so tube "fans out" — not a random jump
  const settled    = useRef<Float32Array | null>(null)
  const done       = useRef(false)

  const glowTexture = useMemo(() => createGlowTexture(), [])

  const init = useMemo(() => {
    const a = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      const th = Math.random() * Math.PI * 2
      const r  = TUBE_R * (0.35 + Math.random() * 0.65)
      a[i * 3]     = Math.cos(th) * r
      a[i * 3 + 1] = Math.sin(th) * r
      a[i * 3 + 2] = -(Math.random() * TUBE_LEN)
    }
    return a
  }, [])

  useEffect(() => {
    const attr = new THREE.BufferAttribute(init, 3)
    attr.setUsage(THREE.DynamicDrawUsage)
    geoRef.current.setAttribute('position', attr)
  }, [init])

  useFrame((_, dt) => {
    const geo = geoRef.current
    if (!geo?.attributes.position) return

    elapsed.current += dt
    const t    = elapsed.current
    const attr = geo.attributes.position as THREE.BufferAttribute
    const pos  = attr.array as Float32Array

    if (t < WARP_DUR) {
      // Exponential speed decay: very fast at t=0, nearly zero by t=WARP_DUR
      const v = V0 * Math.exp(-DECAY * t)

      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3
        pos[i3 + 2] += v * dt
        if (pos[i3 + 2] > 6) {
          const th = Math.random() * Math.PI * 2
          const r  = TUBE_R * (0.35 + Math.random() * 0.65)
          pos[i3]     = Math.cos(th) * r
          pos[i3 + 1] = Math.sin(th) * r
          pos[i3 + 2] = -TUBE_LEN
        }
      }
      attr.needsUpdate = true

    } else if (t < WARP_DUR + SETTLE_DUR) {
      // First frame of settle: snapshot current positions, then compute settled targets
      // Settled positions preserve each particle's current XY angle and spread radially
      // outward — so the tube FANS OUT into a disc rather than randomly rearranging
      if (!snapshot.current) {
        snapshot.current = new Float32Array(pos)
        const sd = new Float32Array(COUNT * 3)
        for (let i = 0; i < COUNT; i++) {
          const i3    = i * 3
          const theta = Math.atan2(pos[i3 + 1], pos[i3])
          // wider scatter radius so overshoot carries particles off-axis visibly
          const r     = 0.8 + Math.random() * 6.5
          sd[i3]      = Math.cos(theta) * r
          sd[i3 + 1]  = Math.sin(theta) * r
          sd[i3 + 2]  = (Math.random() - 0.5) * 0.2
        }
        settled.current = sd
      }

      const p    = (t - WARP_DUR) / SETTLE_DUR
      const pc   = Math.min(p, 1)
      // z: easeOutExpo — snaps to the flat plane hard, no bounce
      const zEase  = pc >= 1 ? 1 : 1 - Math.pow(2, -10 * pc)
      // xy: easeOutBack — 25% overshoot then snap, simulates ricochet off surface
      const xyEase = easeOutBack(pc)
      const snap   = snapshot.current!
      const sd     = settled.current!

      // Snappy camera shake — decays in SHAKE_DUR (200ms), quadratic falloff
      const shakeT = Math.min(p / (SHAKE_DUR / SETTLE_DUR), 1)
      const amp    = SHAKE_AMP * Math.pow(1 - shakeT, 2)
      if (amp > 0.001) {
        camera.position.x = (Math.random() - 0.5) * 2 * amp
        camera.position.y = (Math.random() - 0.5) * 2 * amp
      } else {
        camera.position.x *= 0.75
        camera.position.y *= 0.75
      }

      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3
        pos[i3]     = snap[i3]     + (sd[i3]     - snap[i3])     * xyEase
        pos[i3 + 1] = snap[i3 + 1] + (sd[i3 + 1] - snap[i3 + 1]) * xyEase
        pos[i3 + 2] = snap[i3 + 2] + (sd[i3 + 2] - snap[i3 + 2]) * zEase
      }
      attr.needsUpdate = true

    } else {
      // Damp out any residual camera offset
      camera.position.x *= 0.88
      camera.position.y *= 0.88

      if (!done.current && t > WARP_DUR + SETTLE_DUR + HOLD_DUR) {
        done.current = true
        onComplete()
      }
    }
  })

  return (
    <points>
      <bufferGeometry ref={geoRef} />
      <pointsMaterial
        map={glowTexture}
        color="#ffffff"
        size={0.042}
        sizeAttenuation
        transparent
        opacity={1.0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

interface EntryAnimationProps {
  onComplete: () => void
}

export default function EntryAnimation({ onComplete }: EntryAnimationProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 75 }}
      gl={{ antialias: true }}
      style={{ position: 'fixed', inset: 0, background: '#000' }}
    >
      <Scene onComplete={onComplete} />
    </Canvas>
  )
}
