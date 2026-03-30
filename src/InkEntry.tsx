import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─── constants ───────────────────────────────────────────────────────────────
const DROP_COLOR   = '#00d4ff'
// cPolarAngle=30, cDistance=8 → camera at y≈6.93, z≈4.0
// Top of viewport on y-axis ≈ y=3.86 → start at 4.5 to enter from just off-screen top
const DROP_START_Y = 4.5
const GRAVITY      = 16
const DELAY        = 0.5    // seconds before drop appears
const RING_DUR     = 1.2    // ring expansion duration
const RING2_DELAY  = 0.1    // echo ring starts 100ms after first
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
  const ring1Ref  = useRef<THREE.Mesh>(null!)
  const ring2Ref  = useRef<THREE.Mesh>(null!)
  const splashRef = useRef<THREE.BufferGeometry>(null!)

  // Imperative materials — updated directly in useFrame without React re-renders
  const dropMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: DROP_COLOR, transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [])

  // Two ring materials — different peak opacities, both fade to 0
  const ring1Mat = useMemo(() => new THREE.MeshBasicMaterial({
    color: DROP_COLOR, transparent: true, opacity: 0,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [])

  const ring2Mat = useMemo(() => new THREE.MeshBasicMaterial({
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
        ring1Ref.current.visible = true
        // ring2 becomes visible once its delay elapses (handled in ring phase)

        // Spawn splash: evenly spaced angles + random jitter
        // Higher hSpeed — with overhead camera XZ spread is the dominant visual
        for (let i = 0; i < SPLASH_COUNT; i++) {
          const angle  = (i / SPLASH_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
          const hSpeed = 3.5 + Math.random() * 3.0
          const vSpeed = 2.0 + Math.random() * 3.5
          const i3 = i * 3
          splashVel.current[i3]     = Math.cos(angle) * hSpeed
          splashVel.current[i3 + 1] = vSpeed
          splashVel.current[i3 + 2] = Math.sin(angle) * hSpeed
          // Start just above surface so they're not clipped on frame 1
          splashPos[i3]     = 0
          splashPos[i3 + 1] = 0.05
          splashPos[i3 + 2] = 0
        }
        ;(splashRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true
      }
      return
    }

    // ── Phase: ring ──────────────────────────────────────────────────────────
    if (phase.current === 'ring') {
      ringT.current += dt

      // ── Ring 1 (primary) ─────────────────────────────────────────────────
      const rp1   = Math.min(ringT.current / RING_DUR, 1)
      const r1    = Math.max(0.001, easeOutExpo(rp1) * 3.0)
      ring1Ref.current.scale.set(r1, r1, 1)
      // Starts at 0.6, linearly fades to 0 as ring expands — subtle, not neon
      ring1Mat.opacity = 0.6 * (1 - rp1)

      // ── Ring 2 (echo — 100ms delayed, softer) ────────────────────────────
      const t2  = Math.max(0, ringT.current - RING2_DELAY)
      const rp2 = Math.min(t2 / RING_DUR, 1)
      if (ringT.current >= RING2_DELAY) {
        ring2Ref.current.visible = true
        const r2 = Math.max(0.001, easeOutExpo(rp2) * 3.0)
        ring2Ref.current.scale.set(r2, r2, 1)
        ring2Mat.opacity = 0.28 * (1 - rp2)
      }

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

      // Ring 1 fully expanded — done
      if (rp1 >= 1 && !done.current) {
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

      {/* Ring 1 — primary ripple, thin annulus (0.02 width), flat in XZ plane */}
      <mesh
        ref={ring1Ref}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.001, 0.001, 1]}
        visible={false}
      >
        <ringGeometry args={[0.98, 1.0, 128]} />
        <primitive object={ring1Mat} attach="material" />
      </mesh>

      {/* Ring 2 — echo ripple, 100ms delayed, softer */}
      <mesh
        ref={ring2Ref}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.001, 0.001, 1]}
        visible={false}
      >
        <ringGeometry args={[0.98, 1.0, 128]} />
        <primitive object={ring2Mat} attach="material" />
      </mesh>

      {/* Splash particles */}
      <points>
        <bufferGeometry ref={splashRef} />
        <primitive object={splashMat} attach="material" />
      </points>
    </group>
  )
}

// ─── water caustics shader plane ─────────────────────────────────────────────
// Sits at y=-0.01 (behind rings), outside the shake group, never moves.
// Four directional sine waves create slow interference patterns that read
// as light refracting through dark water.
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
            // Scale UVs so the pattern covers the visible plane naturally
            vec2 uv = (vUv - 0.5) * 10.0;

            // Four directional waves at distinct angles and speeds
            float w = sin( uv.x * 0.80 + uv.y * 0.60 + uTime * 0.25)
                    + sin(-uv.x * 0.50 + uv.y * 1.20 + uTime * 0.18)
                    + sin( uv.x * 1.30 - uv.y * 0.40 + uTime * 0.30)
                    + sin( uv.x * 0.30 - uv.y * 1.10 + uTime * 0.22);

            // Normalize [-4,4] → [0,1] then sharpen into caustic hot-spots
            w = w * 0.125 + 0.5;
            float caustic = pow(w, 5.0);

            // Dark blue (#0a1a2e) on black — peak output is still very dark
            vec3 color = vec3(0.039, 0.102, 0.180) * caustic * 2.2;
            gl_FragColor = vec4(color, 1.0);
          }
        `,
        uniforms: { uTime: { value: 0 } },
      }),
    [],
  )

  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt
  })

  return (
    // 15×15 plane covers all viewport corners at this camera distance
    <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[15, 15]} />
      <primitive object={mat} attach="material" />
    </mesh>
  )
}

// ─── main export ─────────────────────────────────────────────────────────────
interface InkEntryProps {
  onComplete?: () => void
}

export default function InkEntry({ onComplete }: InkEntryProps) {
  return (
    // CSS radial gradient sits behind the transparent R3F canvas
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
        <InkScene onComplete={onComplete ?? (() => {})} />
      </Canvas>
    </div>
  )
}
