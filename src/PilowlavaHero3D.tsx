import { Suspense, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text3D, Center, Environment } from '@react-three/drei'
import * as THREE from 'three'

const FONT_URL = '/fonts/pilowlava.json'

/**
 * Night-mode hero: single Text3D mesh (drei) + city env for reflections.
 * No OBJ, no per-letter meshes, no scroll/zone-driven visibility.
 */
export default function PilowlavaHero3D() {
  const { viewport } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const ambientRef = useRef<THREE.AmbientLight>(null)
  const mainLightRef = useRef<THREE.DirectionalLight>(null)
  const rimLightRef = useRef<THREE.DirectionalLight>(null)
  const sweepLightRef = useRef<THREE.DirectionalLight>(null)
  const mouseRef = useRef({ x: 0.5, y: 0.5 })

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth
      mouseRef.current.y = e.clientY / window.innerHeight
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return

    const t = state.clock.elapsedTime
    const baseY = viewport.height * 0.1

    group.position.set(0, baseY + Math.sin(t * 0.55) * 0.08, 1)
    group.scale.setScalar(1 + Math.sin(t * 0.6) * 0.012)

    const mx = mouseRef.current.x
    const my = mouseRef.current.y
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, (mx - 0.5) * 0.28, 0.06)
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, (my - 0.5) * -0.14, 0.06)

    const ambient = ambientRef.current
    if (ambient) {
      ambient.intensity = 0.3 + Math.sin(t * 0.4) * 0.025
    }

    const mainL = mainLightRef.current
    const rimL = rimLightRef.current
    const sweepL = sweepLightRef.current
    if (mainL) {
      mainL.position.set(5 * Math.cos(t * 0.22), 5, 5 * Math.sin(t * 0.22))
    }
    if (rimL) {
      rimL.position.set(3 * Math.sin(t * 0.17), 5, -5 * Math.cos(t * 0.17))
    }
    if (sweepL) {
      const r = 7
      sweepL.position.set(r * Math.cos(t * 0.31), 3.5 + Math.sin(t * 0.4) * 1.2, r * Math.sin(t * 0.31))
    }
  })

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.3} />
      <directionalLight ref={mainLightRef} position={[5, 5, 5]} intensity={3} />
      <directionalLight ref={rimLightRef} position={[0, 5, -5]} intensity={2} />
      <directionalLight ref={sweepLightRef} position={[-6, 4, 6]} intensity={1.4} />
      <group ref={groupRef} position={[0, viewport.height * 0.1, 1]} renderOrder={1}>
        <Suspense fallback={null}>
          <Center>
            <Text3D
              font={FONT_URL}
              size={viewport.width * 0.07}
              height={viewport.width * 0.012}
              bevelEnabled
              bevelThickness={viewport.width * 0.002}
              bevelSize={viewport.width * 0.0015}
              bevelSegments={5}
              curveSegments={32}
            >
              ANGLEMYER
              <meshPhysicalMaterial
                color="#c0c0c0"
                metalness={1.0}
                roughness={0.05}
                reflectivity={1.0}
                clearcoat={1.0}
                clearcoatRoughness={0.05}
                envMapIntensity={2.0}
                iridescence={1.0}
                iridescenceIOR={1.5}
                iridescenceThicknessRange={[100, 400]}
                side={THREE.DoubleSide}
                transparent
                opacity={1}
              />
            </Text3D>
          </Center>
          <Environment preset="city" />
        </Suspense>
      </group>
    </>
  )
}
