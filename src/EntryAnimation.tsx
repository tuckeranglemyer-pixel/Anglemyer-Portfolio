import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const COUNT = 200
const TUBE_R = 2.5
const TUBE_LEN = 90
const WARP_SPEED = 42
const WARP_DUR = 2.5
const SETTLE_DUR = 0.85
const HOLD_DUR = 0.5

function Scene({ onComplete }: { onComplete: () => void }) {
  const pointsRef = useRef<THREE.Points>(null!)
  const geoRef = useRef<THREE.BufferGeometry>(null!)
  const elapsed = useRef(0)
  const snapshot = useRef<Float32Array | null>(null)
  const done = useRef(false)

  const settled = useMemo(() => {
    const a = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      a[i * 3] = (Math.random() - 0.5) * 10
      a[i * 3 + 1] = (Math.random() - 0.5) * 6
      a[i * 3 + 2] = 0
    }
    return a
  }, [])

  const init = useMemo(() => {
    const a = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i++) {
      const th = Math.random() * Math.PI * 2
      const r = TUBE_R + (Math.random() - 0.5) * 1.5
      a[i * 3] = Math.cos(th) * r
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
    if (!geo || !geo.attributes.position) return

    elapsed.current += dt
    const t = elapsed.current
    const attr = geo.attributes.position as THREE.BufferAttribute
    const pos = attr.array as Float32Array

    if (t < WARP_DUR) {
      // Phase 1 — particles stream toward camera through the tube
      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3
        pos[i3 + 2] += WARP_SPEED * dt
        // recycle past the camera
        if (pos[i3 + 2] > 6) {
          const th = Math.random() * Math.PI * 2
          const r = TUBE_R + (Math.random() - 0.5) * 1.5
          pos[i3] = Math.cos(th) * r
          pos[i3 + 1] = Math.sin(th) * r
          pos[i3 + 2] = -TUBE_LEN
        }
      }
      attr.needsUpdate = true
    } else if (t < WARP_DUR + SETTLE_DUR) {
      // Phase 2 — snapshot on first frame, then lerp to flat plane
      if (!snapshot.current) {
        snapshot.current = new Float32Array(pos)
      }
      const p = (t - WARP_DUR) / SETTLE_DUR
      const e = 1 - Math.pow(1 - p, 4) // ease-out quartic
      const snap = snapshot.current

      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3
        pos[i3] = snap[i3] + (settled[i3] - snap[i3]) * e
        pos[i3 + 1] = snap[i3 + 1] + (settled[i3 + 1] - snap[i3 + 1]) * e
        pos[i3 + 2] = snap[i3 + 2] + (settled[i3 + 2] - snap[i3 + 2]) * e
      }
      attr.needsUpdate = true
    } else if (!done.current && t > WARP_DUR + SETTLE_DUR + HOLD_DUR) {
      done.current = true
      onComplete()
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geoRef} />
      <pointsMaterial
        color="#ffffff"
        size={0.08}
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
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
      style={{ position: 'fixed', inset: 0, background: '#000' }}
    >
      <Scene onComplete={onComplete} />
    </Canvas>
  )
}
