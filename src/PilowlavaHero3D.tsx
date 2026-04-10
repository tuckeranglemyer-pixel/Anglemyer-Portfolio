import { Suspense, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Text3D, Center, Environment } from '@react-three/drei'
import * as THREE from 'three'

const FONT_URL = '/fonts/pilowlava.json'

function ChromeAnglemyerText() {
  const { viewport } = useThree()
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null)

  useEffect(() => {
    const applyOpacity = () => {
      const m = matRef.current
      if (!m) return
      const y = window.scrollY
      const h = window.innerHeight
      let o = 1
      if (y > h * 0.7) o = 0
      else if (y > h * 0.5) o = 1 - (y - h * 0.5) / (h * 0.2)
      m.transparent = o < 1
      m.opacity = o
    }
    applyOpacity()
    window.addEventListener('scroll', applyOpacity, { passive: true })
    return () => window.removeEventListener('scroll', applyOpacity)
  }, [])

  return (
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
          ref={matRef}
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
  )
}

export default function PilowlavaHero3D() {
  const { viewport } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const mainLightRef = useRef<THREE.DirectionalLight>(null)
  const rimLightRef = useRef<THREE.DirectionalLight>(null)
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
    const baseY = viewport.height * 0.15

    group.position.set(0, baseY + Math.sin(t * 0.5) * 0.1, 1)
    group.scale.setScalar(1 + Math.sin(t * 0.6) * 0.01)

    const mx = mouseRef.current.x
    const my = mouseRef.current.y
    group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, (mx - 0.5) * 0.3, 0.05)
    group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, (my - 0.5) * -0.15, 0.05)

    const mainL = mainLightRef.current
    const rimL = rimLightRef.current
    if (mainL) {
      mainL.position.set(5 * Math.cos(t * 0.2), 5, 5 * Math.sin(t * 0.2))
    }
    if (rimL) {
      rimL.position.set(3 * Math.sin(t * 0.15), 5, -5 * Math.cos(t * 0.15))
    }
  })

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight ref={mainLightRef} position={[5, 5, 5]} intensity={3} />
      <directionalLight position={[-5, -2, 3]} intensity={1} />
      <directionalLight ref={rimLightRef} position={[0, 5, -5]} intensity={2} />
      <group ref={groupRef} position={[0, viewport.height * 0.15, 1]} renderOrder={1}>
        <Suspense fallback={null}>
          <ChromeAnglemyerText />
          <Environment preset="city" />
        </Suspense>
      </group>
    </>
  )
}
