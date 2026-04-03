import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { RootState } from '@react-three/fiber'
import * as THREE from 'three'
import { OBJLoader } from './loaders/OBJLoader'

/** ANGLEMYER — object names from pilowlava3d.obj */
const LETTER_OBJECT_NAMES = [
  'pilowlava_a1_for_sds',
  'pilowlava_n1_for_sds',
  'pilowlava_g1_for_sds',
  'pilowlava_l_for_sds',
  'pilowlava_e1_for_sds',
  'pilowlava_m1_for_sds',
  'pilowlava_y_for_sds',
  'pilowlava_e2_for_sds',
  'pilowlava_r_for_sds',
] as const

function extractGeometry(root: THREE.Group, name: string): THREE.BufferGeometry | null {
  const o = root.getObjectByName(name)
  if (!o) return null
  if (o instanceof THREE.Mesh && o.geometry) {
    return o.geometry.clone()
  }
  let found: THREE.BufferGeometry | null = null
  o.traverse(child => {
    if (found) return
    if (child instanceof THREE.Mesh && child.geometry) {
      found = child.geometry.clone()
    }
  })
  return found
}

function centerGeometryAndGetWidth(g: THREE.BufferGeometry): number {
  g.computeBoundingBox()
  const box = g.boundingBox
  if (!box) return 1
  const cx = (box.min.x + box.max.x) / 2
  const cy = (box.min.y + box.max.y) / 2
  const cz = (box.min.z + box.max.z) / 2
  g.translate(-cx, -cy, -cz)
  g.computeBoundingBox()
  const b = g.boundingBox
  if (!b) return 1
  return b.max.x - b.min.x
}

const OBJ_URL = '/fonts/pilowlava3d.obj'

export default function PilowlavaHero3D() {
  const { camera, gl, viewport } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const meshRefs = useRef<(THREE.Mesh | null)[]>([])
  const [ready, setReady] = useState(false)

  const homesRef = useRef<THREE.Vector3[]>([])
  const pushRef = useRef<THREE.Vector3[]>([])
  const geometriesRef = useRef<THREE.BufferGeometry[]>([])
  const totalWidthRef = useRef(1)

  const mouseWorldRef = useRef(new THREE.Vector3(0, 0, 0))
  const ndcRef = useRef(new THREE.Vector2())
  const planeRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))
  const raycasterRef = useRef(new THREE.Raycaster())
  const tmpWorld = useRef(new THREE.Vector3())
  const tmpDir = useRef(new THREE.Vector3())

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        metalness: 0.6,
        roughness: 0.1,
        emissive: '#38bdf8',
        emissiveIntensity: 0.4,
        opacity: 1,
        transparent: false,
        depthWrite: true,
        depthTest: true,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      material.dispose()
    }
  }, [material])

  useEffect(() => {
    let cancelled = false
    const loader = new OBJLoader()
    loader.load(
      OBJ_URL,
      obj => {
        if (cancelled) return
        const geoms: THREE.BufferGeometry[] = []
        const widths: number[] = []

        for (const name of LETTER_OBJECT_NAMES) {
          const g = extractGeometry(obj, name)
          if (!g) {
            console.warn('[PilowlavaHero3D] missing object:', name)
            continue
          }
          const w = centerGeometryAndGetWidth(g)
          geoms.push(g)
          widths.push(w)
        }

        if (geoms.length === 0) {
          setReady(false)
          return
        }

        const avgW = widths.reduce((a, b) => a + b, 0) / widths.length
        const gap = avgW * 0.05
        let totalW = 0
        for (let i = 0; i < widths.length; i++) {
          totalW += widths[i]!
          if (i < widths.length - 1) totalW += gap
        }
        totalWidthRef.current = Math.max(totalW, 1e-6)

        const homes: THREE.Vector3[] = []
        const pushes: THREE.Vector3[] = []
        let x = -totalW / 2
        for (let i = 0; i < geoms.length; i++) {
          const w = widths[i]!
          const cx = x + w / 2
          homes.push(new THREE.Vector3(cx, 0, 0))
          pushes.push(new THREE.Vector3(0, 0, 0))
          x += w + gap
        }

        homesRef.current = homes
        pushRef.current = pushes
        geometriesRef.current = geoms
        meshRefs.current = new Array(geoms.length).fill(null)
        if (!cancelled) setReady(true)
      },
      undefined,
      err => console.error('[PilowlavaHero3D] OBJ load failed', err),
    )
    return () => {
      cancelled = true
      geometriesRef.current.forEach(g => g.dispose())
      geometriesRef.current = []
    }
  }, [])

  useEffect(() => {
    const plane = planeRef.current
    const raycaster = raycasterRef.current
    const onMove = (e: MouseEvent) => {
      const rect = gl.domElement.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1
      ndcRef.current.set(nx, ny)
      raycaster.setFromCamera(ndcRef.current, camera)
      const hit = new THREE.Vector3()
      if (raycaster.ray.intersectPlane(plane, hit)) {
        mouseWorldRef.current.copy(hit)
      }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [camera, gl])

  useFrame((state: RootState, delta: number) => {
    const group = groupRef.current
    if (!group || !ready) return

    const totalW = totalWidthRef.current
    const targetWorldWidth = viewport.width * 0.8
    const s = targetWorldWidth / totalW
    group.scale.setScalar(s)

    const t = state.clock.elapsedTime
    const mouse = mouseWorldRef.current
    const dt = Math.min(delta, 0.05)

    const homes = homesRef.current
    const pushes = pushRef.current

    for (let i = 0; i < homes.length; i++) {
      const mesh = meshRefs.current[i]
      if (!mesh) continue
      const home = homes[i]!
      let push = pushes[i]!

      const floatY = Math.sin(t * 0.5 + i * 0.7) * 0.15
      const floatRotZ = Math.sin(t * 0.3 + i * 0.5) * 0.03

      mesh.getWorldPosition(tmpWorld.current)
      const wx = tmpWorld.current.x
      const wy = tmpWorld.current.y
      const dist = Math.hypot(wx - mouse.x, wy - mouse.y)

      if (dist < 2 && dist > 0.02) {
        tmpDir.current.set(wx - mouse.x, wy - mouse.y, 0).normalize()
        const force = (1 / Math.max(dist, 0.15)) * 0.02 * (dt * 60)
        push.add(tmpDir.current.multiplyScalar(force))
      } else {
        push.lerp(new THREE.Vector3(0, 0, 0), 0.03)
      }

      mesh.position.x = home.x + push.x
      mesh.position.y = home.y + floatY + push.y
      mesh.position.z = home.z + push.z
      mesh.rotation.x = 0
      mesh.rotation.y = 0
      mesh.rotation.z = floatRotZ
    }
  })

  if (!ready || geometriesRef.current.length === 0) return null

  const geoms = geometriesRef.current

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={3} />
      <directionalLight position={[-3, -2, 4]} intensity={1.5} />
      <group ref={groupRef} position={[0, 0, 1]} renderOrder={1}>
        {geoms.map((geom, i) => (
          <mesh
            key={LETTER_OBJECT_NAMES[i]}
            ref={el => {
              meshRefs.current[i] = el
            }}
            geometry={geom}
            material={material}
          />
        ))}
      </group>
    </>
  )
}
