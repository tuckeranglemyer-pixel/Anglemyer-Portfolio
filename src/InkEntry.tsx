import { useRef, useMemo, useEffect } from 'react'
import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── constants ───────────────────────────────────────────────────────────────
const DROP_COLOR   = '#00f0ff'
const DROP_START_Y = 3.0    // above camera (camera y ≈ 1.3 at cPolarAngle=75)
const GRAVITY      = 14
const DELAY        = 0.5    // seconds before drop appears
const RING_DUR     = 1.2    // ring expansion duration
const SPLASH_COUNT = 10
const SPLASH_LIFE  = 0.5    // seconds for splash particles to die

function easeOutExpo(x: number): number {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)
}

// ─── inner scene (must be inside ShaderGradientCanvas to access R3F context) ─
function InkScene({ onComplete }: { onComplete: () => void }) {
  // scene shake group — ShaderGradient owns the camera, so we shake our objects
  const shakeRef  = useRef<THREE.Group>(null!)
  const dropRef   = useRef<THREE.Mesh>(null!)
  const ringRef   = useRef<THREE.Mesh>(null!)
  const splashRef = useRef<THREE.BufferGeometry>(null!)

  // Imperative materials — updated directly in useFrame without React re-renders
  const dropMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: DROP_COLOR, transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [])

  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: DROP_COLOR, transparent: true, opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [])

  const splashMat = useMemo(() => new THREE.PointsMaterial({
    color: DROP_COLOR, size: 0.045, sizeAttenuation: true,
    transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [])

  // ─── animation state ────────────────────────────────────────────────────────
  const phase   = useRef<'delay' | 'falling' | 'ring'>('delay')
  const elapsed = useRef(0)
  const dropY   = useRef(DROP_START_Y)
  const dropVY  = useRef(0)
  const ringT   = useRef(0)
  const done    = useRef(false)

  // Splash particle buffers (mutated in-place each frame)
  const splashPos = useMemo(() => new Float32Array(SPLASH_COUNT * 3), [])
  const splashVel = useRef(new Float32Array(SPLASH_COUNT * 3))

  useEffect(() => {
    const attr = new THREE.BufferAttribute(splashPos, 3)
    attr.setUsage(THREE.DynamicDrawUsage)
    splashRef.current.setAttribute('position', attr)
  }, [splashPos])

  // ─── animation loop ──────────────────────────────────────────────────────────
  useFrame((_, dt) => {
    elapsed.current += dt

    // ── Phase: delay ────────────────────────────────────────────────────────
    if (phase.current === 'delay') {
      if (elapsed.current >= DELAY) {
        phase.current = 'falling'
        dropRef.current.visible = true
        dropY.current  = DROP_START_Y
        dropVY.current = 0
      }
      return
    }

    // ── Phase: falling ───────────────────────────────────────────────────────
    if (phase.current === 'falling') {
      dropVY.current    -= GRAVITY * dt
      dropY.current     += dropVY.current * dt
      dropRef.current.position.y = dropY.current

      if (dropY.current <= 0) {
        // ── IMPACT ──────────────────────────────────────────────────────────
        dropRef.current.visible = false
        phase.current = 'ring'
        ringT.current = 0
        ringRef.current.visible = true

        // Spawn splash: evenly spaced angles + random jitter
        for (let i = 0; i < SPLASH_COUNT; i++) {
          const angle  = (i / SPLASH_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
          const hSpeed = 2.0 + Math.random() * 2.5
          const vSpeed = 2.0 + Math.random() * 3.5
          const i3 = i * 3
          splashVel.current[i3]     = Math.cos(angle) * hSpeed
          splashVel.current[i3 + 1] = vSpeed
          splashVel.current[i3 + 2] = Math.sin(angle) * hSpeed
          splashPos[i3] = splashPos[i3 + 1] = splashPos[i3 + 2] = 0
        }
        ;(splashRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true
      }
      return
    }

    // ── Phase: ring ──────────────────────────────────────────────────────────
    if (phase.current === 'ring') {
      ringT.current += dt
      const rp    = Math.min(ringT.current / RING_DUR, 1)
      const eased = easeOutExpo(rp)

      // Ring expands in XZ plane — mesh is rotated -90° X, so local XY → world XZ
      // scale.x = world X, scale.y = world Z, scale.z = world Y (no thickness)
      const r = Math.max(0.001, eased * 3.0)
      ringRef.current.scale.set(r, r, 1)
      // Opacity: sin curve — fades in then gracefully out by rp=1
      ringMat.opacity = Math.sin(rp * Math.PI) * 0.85

      // Scene shake instead of camera shake (ShaderGradient owns camera)
      const shakeDecay = Math.max(0, 1 - ringT.current / 0.2)
      const amp = 0.15 * shakeDecay * shakeDecay
      if (amp > 0.001) {
        shakeRef.current.position.x = (Math.random() - 0.5) * 2 * amp
        shakeRef.current.position.z = (Math.random() - 0.5) * 2 * amp
      } else {
        shakeRef.current.position.x *= 0.75
        shakeRef.current.position.z *= 0.75
      }

      // Splash particles: gravity + fade out over SPLASH_LIFE
      if (splashRef.current.attributes.position) {
        const attr = splashRef.current.attributes.position as THREE.BufferAttribute
        const lifeFrac = Math.max(0, 1 - ringT.current / SPLASH_LIFE)
        splashMat.opacity = lifeFrac * 0.9

        if (lifeFrac > 0) {
          for (let i = 0; i < SPLASH_COUNT; i++) {
            const i3 = i * 3
            splashVel.current[i3 + 1] -= GRAVITY * dt
            splashPos[i3]     += splashVel.current[i3]     * dt
            splashPos[i3 + 1] += splashVel.current[i3 + 1] * dt
            splashPos[i3 + 2] += splashVel.current[i3 + 2] * dt
            // Bounce off surface
            if (splashPos[i3 + 1] < 0) {
              splashPos[i3 + 1] = 0
              splashVel.current[i3 + 1] *= -0.2
            }
          }
          attr.needsUpdate = true
        }
      }

      // Ring fully expanded — done
      if (rp >= 1 && !done.current) {
        done.current = true
        shakeRef.current.position.set(0, 0, 0)
        onComplete()
      }
    }
  })

  return (
    <group ref={shakeRef}>
      {/* Falling ink drop */}
      <mesh ref={dropRef} position={[0, DROP_START_Y, 0]} visible={false}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <primitive object={dropMat} attach="material" />
      </mesh>

      {/* Impact ring — rotated flat in XZ (water) plane, starts at scale≈0 */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.001, 0.001, 1]}
        visible={false}
      >
        <ringGeometry args={[0.88, 1.0, 64]} />
        <primitive object={ringMat} attach="material" />
      </mesh>

      {/* Splash particles */}
      <points>
        <bufferGeometry ref={splashRef} />
        <primitive object={splashMat} attach="material" />
      </points>
    </group>
  )
}

// ─── main export ─────────────────────────────────────────────────────────────
interface InkEntryProps {
  onComplete?: () => void
}

export default function InkEntry({ onComplete }: InkEntryProps) {
  return (
    <ShaderGradientCanvas
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%' }}
      pointerEvents="none"
    >
      <ShaderGradient
        type="waterPlane"
        animate="on"
        color1="#0a1628"
        color2="#0d1f3c"
        color3="#060e1e"
        uSpeed={0.08}
        uStrength={2.5}
        uFrequency={3}
        cPolarAngle={75}
        cDistance={5}
        lightType="3d"
        envPreset="city"
        brightness={1.0}
        grain="off"
      />
      <InkScene onComplete={onComplete ?? (() => {})} />
    </ShaderGradientCanvas>
  )
}
