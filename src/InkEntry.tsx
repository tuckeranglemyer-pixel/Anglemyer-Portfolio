import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Visitor } from './visitors'

// ─── constants ───────────────────────────────────────────────────────────────
const DEFAULT_HERO_COLOR = '#00d4ff'
// cPolarAngle=30, cDistance=8 → camera at y≈6.93, z≈4.0
// Top of viewport on y-axis ≈ y=3.86 → start at 4.5 to enter from just off-screen top
const DROP_START_Y  = 4.5
const GRAVITY       = 16
const DEFAULT_DELAY = 0.5   // hero delay when no visitor drops precede it
const VISITOR_DELAY = 1.6   // hero delay when visitor drops play first
const RING_DUR      = 1.2   // hero ring expansion duration
const RING2_DELAY   = 0.1   // echo ring starts 100ms after first
const SPLASH_COUNT  = 10
const SPLASH_LIFE   = 0.5   // seconds for splash particles to die

// Visitor drop constants
const VISITOR_RING_DUR = 0.7  // shorter, softer expansion
const VISITOR_STAGGER  = 1.3  // total window to stagger all visitor drops (s)

function easeOutExpo(x: number): number {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)
}

// ─── visitor drops ───────────────────────────────────────────────────────────
// Renders each past visitor's colored drop falling before the hero drop.
// Drops are staggered over VISITOR_STAGGER seconds, scattered in XZ.
interface VisitorDropData {
  startDelay: number
  x: number
  z: number
  phase: 'waiting' | 'falling' | 'ring' | 'done'
  dropY: number
  dropVY: number
  ringT: number
}

function VisitorDrops({ visitors }: { visitors: Visitor[] }) {
  const count = visitors.length
  if (count === 0) return null

  // Per-visitor materials (different colors)
  const mats = useMemo(
    () =>
      visitors.map(v => ({
        drop: new THREE.MeshBasicMaterial({
          color: v.color,
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
        ring: new THREE.MeshBasicMaterial({
          color: v.color,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      })),
    // visitors is stable (fetched once); safe to depend on it
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count],
  )

  useEffect(() => {
    return () => mats.forEach(m => { m.drop.dispose(); m.ring.dispose() })
  }, [mats])

  // Animation state — mutable objects, only useFrame touches them
  const data = useMemo<VisitorDropData[]>(
    () =>
      visitors.map((_, i) => ({
        startDelay: count > 1 ? (i / (count - 1)) * VISITOR_STAGGER : 0,
        x: (Math.random() - 0.5) * 2.0,
        z: (Math.random() - 0.5) * 2.0,
        phase: 'waiting',
        dropY: DROP_START_Y,
        dropVY: 0,
        ringT: 0,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count],
  )

  const dropMeshes = useRef<{ [k: number]: THREE.Mesh | null }>({})
  const ringMeshes = useRef<{ [k: number]: THREE.Mesh | null }>({})
  const elapsed    = useRef(0)

  useFrame((_, dt) => {
    elapsed.current += dt

    for (let i = 0; i < count; i++) {
      const d  = data[i]
      const dm = dropMeshes.current[i]
      const rm = ringMeshes.current[i]
      if (!dm || !rm || d.phase === 'done') continue

      const t = elapsed.current - d.startDelay
      if (t < 0) continue

      if (d.phase === 'waiting') {
        d.phase  = 'falling'
        d.dropY  = DROP_START_Y
        d.dropVY = 0
        dm.visible = true
        dm.position.set(d.x, d.dropY, d.z)
      }

      if (d.phase === 'falling') {
        d.dropVY -= GRAVITY * dt
        d.dropY  += d.dropVY * dt
        dm.position.y = d.dropY

        if (d.dropY <= 0) {
          d.phase = 'ring'
          dm.visible = false
          rm.visible = true
          rm.position.set(d.x, 0.005, d.z)
          d.ringT = 0
        }
      }

      if (d.phase === 'ring') {
        d.ringT += dt
        const rp = Math.min(d.ringT / VISITOR_RING_DUR, 1)
        const r  = Math.max(0.001, easeOutExpo(rp) * 1.2)
        rm.scale.set(r, r, 1)
        mats[i].ring.opacity = 0.35 * (1 - rp)

        if (rp >= 1) {
          d.phase    = 'done'
          rm.visible = false
        }
      }
    }
  })

  return (
    <>
      {visitors.map((v, i) => (
        <group key={v.id}>
          <mesh
            ref={(el: THREE.Mesh | null) => { dropMeshes.current[i] = el }}
            visible={false}
          >
            <sphereGeometry args={[0.02, 16, 16]} />
            <primitive object={mats[i].drop} attach="material" />
          </mesh>
          <mesh
            ref={(el: THREE.Mesh | null) => { ringMeshes.current[i] = el }}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[0.001, 0.001, 1]}
            visible={false}
          >
            <ringGeometry args={[0.98, 1.0, 64]} />
            <primitive object={mats[i].ring} attach="material" />
          </mesh>
        </group>
      ))}
    </>
  )
}

// ─── hero ink drop scene ──────────────────────────────────────────────────────
function InkScene({
  onComplete,
  heroColor = DEFAULT_HERO_COLOR,
  heroDelay = DEFAULT_DELAY,
}: {
  onComplete: () => void
  heroColor?: string
  heroDelay?: number
}) {
  const shakeRef  = useRef<THREE.Group>(null!)
  const dropRef   = useRef<THREE.Mesh>(null!)
  const ring1Ref  = useRef<THREE.Mesh>(null!)
  const ring2Ref  = useRef<THREE.Mesh>(null!)
  const splashRef = useRef<THREE.BufferGeometry>(null!)

  const dropMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: heroColor, transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [heroColor])

  const ring1Mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: heroColor, transparent: true, opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [heroColor])

  const ring2Mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: heroColor, transparent: true, opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [heroColor])

  const splashMat = useMemo(() => new THREE.PointsMaterial({
    color: heroColor, size: 0.045, sizeAttenuation: true,
    transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [heroColor])

  const phase   = useRef<'delay' | 'falling' | 'ring'>('delay')
  const elapsed = useRef(0)
  const dropY   = useRef(DROP_START_Y)
  const dropVY  = useRef(0)
  const ringT   = useRef(0)
  const done    = useRef(false)

  const splashPos = useMemo(() => new Float32Array(SPLASH_COUNT * 3), [])
  const splashVel = useRef(new Float32Array(SPLASH_COUNT * 3))

  useEffect(() => {
    const attr = new THREE.BufferAttribute(splashPos, 3)
    attr.setUsage(THREE.DynamicDrawUsage)
    splashRef.current.setAttribute('position', attr)
  }, [splashPos])

  useFrame((_, dt) => {
    elapsed.current += dt

    // ── delay ────────────────────────────────────────────────────────────────
    if (phase.current === 'delay') {
      if (elapsed.current >= heroDelay) {
        phase.current  = 'falling'
        dropRef.current.visible = true
        dropY.current  = DROP_START_Y
        dropVY.current = 0
      }
      return
    }

    // ── falling ──────────────────────────────────────────────────────────────
    if (phase.current === 'falling') {
      dropVY.current        -= GRAVITY * dt
      dropY.current         += dropVY.current * dt
      dropRef.current.position.y = dropY.current

      if (dropY.current <= 0) {
        dropRef.current.visible = false
        phase.current = 'ring'
        ringT.current = 0
        ring1Ref.current.visible = true

        for (let i = 0; i < SPLASH_COUNT; i++) {
          const angle  = (i / SPLASH_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
          const hSpeed = 3.5 + Math.random() * 3.0
          const vSpeed = 2.0 + Math.random() * 3.5
          const i3 = i * 3
          splashVel.current[i3]     = Math.cos(angle) * hSpeed
          splashVel.current[i3 + 1] = vSpeed
          splashVel.current[i3 + 2] = Math.sin(angle) * hSpeed
          splashPos[i3]     = 0
          splashPos[i3 + 1] = 0.05
          splashPos[i3 + 2] = 0
        }
        ;(splashRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true
      }
      return
    }

    // ── ring ─────────────────────────────────────────────────────────────────
    if (phase.current === 'ring') {
      ringT.current += dt

      const rp1 = Math.min(ringT.current / RING_DUR, 1)
      const r1  = Math.max(0.001, easeOutExpo(rp1) * 3.0)
      ring1Ref.current.scale.set(r1, r1, 1)
      ring1Mat.opacity = 0.6 * (1 - rp1)

      const t2  = Math.max(0, ringT.current - RING2_DELAY)
      const rp2 = Math.min(t2 / RING_DUR, 1)
      if (ringT.current >= RING2_DELAY) {
        ring2Ref.current.visible = true
        const r2 = Math.max(0.001, easeOutExpo(rp2) * 3.0)
        ring2Ref.current.scale.set(r2, r2, 1)
        ring2Mat.opacity = 0.28 * (1 - rp2)
      }

      // Scene shake (orthographic ink scene; shake the objects instead)
      const shakeDecay = Math.max(0, 1 - ringT.current / 0.2)
      const amp = 0.15 * shakeDecay * shakeDecay
      if (amp > 0.001) {
        shakeRef.current.position.x = (Math.random() - 0.5) * 2 * amp
        shakeRef.current.position.z = (Math.random() - 0.5) * 2 * amp
      } else {
        shakeRef.current.position.x *= 0.75
        shakeRef.current.position.z *= 0.75
      }

      // Splash particles
      if (splashRef.current.attributes.position) {
        const attr     = splashRef.current.attributes.position as THREE.BufferAttribute
        const lifeFrac = Math.max(0, 1 - ringT.current / SPLASH_LIFE)
        splashMat.opacity = lifeFrac * 0.9

        if (lifeFrac > 0) {
          for (let i = 0; i < SPLASH_COUNT; i++) {
            const i3 = i * 3
            splashVel.current[i3 + 1] -= GRAVITY * dt
            splashPos[i3]     += splashVel.current[i3]     * dt
            splashPos[i3 + 1] += splashVel.current[i3 + 1] * dt
            splashPos[i3 + 2] += splashVel.current[i3 + 2] * dt
            if (splashPos[i3 + 1] < 0) {
              splashPos[i3 + 1] = 0
              splashVel.current[i3 + 1] *= -0.2
            }
          }
          attr.needsUpdate = true
        }
      }

      if (rp1 >= 1 && !done.current) {
        done.current = true
        shakeRef.current.position.set(0, 0, 0)
        onComplete()
      }
    }
  })

  return (
    <group ref={shakeRef}>
      <mesh ref={dropRef} position={[0, DROP_START_Y, 0]} visible={false}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <primitive object={dropMat} attach="material" />
      </mesh>

      <mesh
        ref={ring1Ref}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.001, 0.001, 1]}
        visible={false}
      >
        <ringGeometry args={[0.98, 1.0, 128]} />
        <primitive object={ring1Mat} attach="material" />
      </mesh>

      <mesh
        ref={ring2Ref}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.001, 0.001, 1]}
        visible={false}
      >
        <ringGeometry args={[0.98, 1.0, 128]} />
        <primitive object={ring2Mat} attach="material" />
      </mesh>

      <points>
        <bufferGeometry ref={splashRef} />
        <primitive object={splashMat} attach="material" />
      </points>
    </group>
  )
}

// ─── water caustics shader plane ──────────────────────────────────────────────
function WaterCaustics() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;

          void main() {
            vec2 uv = (vUv - 0.5) * 10.0;
            float w = sin( uv.x * 0.80 + uv.y * 0.60 + uTime * 0.25)
                    + sin(-uv.x * 0.50 + uv.y * 1.20 + uTime * 0.18)
                    + sin( uv.x * 1.30 - uv.y * 0.40 + uTime * 0.30)
                    + sin( uv.x * 0.30 - uv.y * 1.10 + uTime * 0.22);
            w = w * 0.125 + 0.5;
            float caustic = pow(w, 5.0);
            vec3 color = vec3(0.039, 0.102, 0.180) * caustic * 2.2;
            gl_FragColor = vec4(color, 1.0);
          }
        `,
        uniforms: { uTime: { value: 0 } },
      }),
    [],
  )

  useFrame((_, dt) => { mat.uniforms.uTime.value += dt })

  return (
    <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[15, 15]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

// ─── main export ──────────────────────────────────────────────────────────────
interface InkEntryProps {
  onComplete?: () => void
  visitors?: Visitor[]
  heroColor?: string
}

export default function InkEntry({
  onComplete,
  visitors = [],
  heroColor = DEFAULT_HERO_COLOR,
}: InkEntryProps) {
  const heroDelay = visitors.length > 0 ? VISITOR_DELAY : DEFAULT_DELAY

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'radial-gradient(ellipse at center, #0d1f3c 0%, #000000 70%)',
      }}
    >
      <Canvas
        camera={{ position: [0, 6.93, 4.0], fov: 45 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
        gl={{ alpha: true, antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <WaterCaustics />
        <VisitorDrops visitors={visitors} />
        <InkScene
          onComplete={onComplete ?? (() => {})}
          heroColor={heroColor}
          heroDelay={heroDelay}
        />
      </Canvas>
    </div>
  )
}
