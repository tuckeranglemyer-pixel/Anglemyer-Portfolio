import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { world, PIERCE_T, type Terra } from './world'

// World scale: 30.6 km -> 100 units. Vertical exaggeration 1.6x.
const W = 100
const EXAG = 1.6

// Composed camera poses, one per band. Between bands the camera eases;
// within a band it holds (breathes only). One real camera event: the pierce.
const POSES: { p: [number, number, number]; l: [number, number, number] }[] = [
  { p: [-3.6, 14.5, 9], l: [-3.65, 6.8, -8.5] }, // 00 summit — ridge in the bottom third, sky for the name
  { p: [8.5, 8.5, 11], l: [-2.0, 6.2, -4.0] }, // 01 the work — down the shoulder
  { p: [6.0, 6.2, 18], l: [-4.0, 4.0, -2.0] }, // 02 the code — valley floor
  { p: [0.0, -5.2, 5], l: [0.0, 4.5, -3.0] }, // 03 pierce — below, looking up
  { p: [0.0, -6.5, 9], l: [0.0, 3.0, -7.0] }, // 04 bunker
  { p: [0.0, -7.6, 13], l: [0.0, 1.6, -13.0] }, // 05 end of line
]

const CONTOUR_VERT = /* glsl */ `
  attribute float aElev;
  varying float vElev;
  varying float vDist;
  varying vec2 vXZ;
  void main() {
    vElev = aElev;
    vXZ = vec2(position.x, position.z);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const CONTOUR_FRAG = /* glsl */ `
  precision highp float;
  varying float vElev;
  varying float vDist;
  varying vec2 vXZ;
  uniform vec3 uBeacon; // x, z, intensity

  float cline(float e, float interval, float w) {
    float g = e / interval;
    float d = abs(fract(g - 0.5) - 0.5) / fwidth(g);
    return 1.0 - smoothstep(0.0, w, d);
  }

  void main() {
    vec3 bg = vec3(0.043, 0.051, 0.067);
    vec3 bone = vec3(0.925, 0.913, 0.882);
    vec3 viol = vec3(0.655, 0.580, 0.910);

    // steep faces compress contours into shimmer — thin them by slope density
    float dens = fwidth(vElev) / 40.0;
    float calm = 1.0 - smoothstep(0.35, 0.95, dens);
    float minor = cline(vElev, 40.0, 1.1) * 0.13 * calm;
    float major = cline(vElev, 160.0, 1.3) * 0.62 * mix(0.35, 1.0, calm);

    // Lake Minnewanka reads as flat dark water: no lines below the shore
    float lake = 1.0 - smoothstep(1477.0, 1482.0, vElev);
    float line = max(minor, major) * (1.0 - lake);

    float hgt = smoothstep(1300.0, 3100.0, vElev);
    vec3 base = bg * (1.02 + hgt * 0.85);
    base = mix(base, bg * 0.72, lake);

    vec3 col = base + bone * line * 0.85;

    // violet beacon (work-ledger hover)
    float bd = distance(vXZ, uBeacon.xy);
    col += viol * uBeacon.z * exp(-bd * 0.5) * 0.8;

    // depth fog into the ground color
    col = mix(col, bg, smoothstep(26.0, 92.0, vDist));
    gl_FragColor = vec4(col, 1.0);
  }
`

const WIRE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uBass;
  varying float vDist;
  void main() {
    vec3 p = position;
    // the ceiling rides the kick
    p.y += (sin(p.x * 0.7 + uTime * 2.2) + sin(p.z * 0.9 + uTime * 1.7)) * uBass * 0.9;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const WIRE_FRAG = /* glsl */ `
  precision highp float;
  uniform float uBass;
  varying float vDist;
  void main() {
    vec3 bone = vec3(0.925, 0.913, 0.882);
    vec3 viol = vec3(0.655, 0.580, 0.910);
    vec3 col = mix(bone * 0.42, viol, clamp(uBass * 1.5, 0.0, 1.0));
    float a = (1.0 - smoothstep(14.0, 60.0, vDist)) * 0.55;
    gl_FragColor = vec4(col, a);
  }
`

function Mountain({ terra }: { terra: Terra }) {
  const wireMesh = useRef<THREE.Mesh>(null)
  const camPos = useRef(new THREE.Vector3(...POSES[0].p))
  const camLook = useRef(new THREE.Vector3(...POSES[0].l))

  const geometry = useMemo(() => {
    const n = terra.size // 256
    const geo = new THREE.PlaneGeometry(W, W, n - 1, n - 1)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const elev = new Float32Array(n * n)
    const relief = terra.maxElev - terra.minElev
    const hScale = ((relief / 30600) * W * EXAG) / relief // units per metre
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const v = iy * n + ix
        const m = terra.data[v]
        pos.setZ(v, (m - terra.minElev) * hScale)
        elev[v] = m
      }
    }
    geo.setAttribute('aElev', new THREE.BufferAttribute(elev, 1))
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [terra])

  const contour = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CONTOUR_VERT,
        fragmentShader: CONTOUR_FRAG,
        uniforms: { uBeacon: { value: new THREE.Vector3(0, 0, 0) } },
        side: THREE.FrontSide,
      }),
    [],
  )
  const wire = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: WIRE_VERT,
        fragmentShader: WIRE_FRAG,
        uniforms: { uTime: { value: 0 }, uBass: { value: 0 } },
        wireframe: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )

  useFrame(({ camera, clock }) => {
    const t = Math.max(0, Math.min(POSES.length - 1, world.t))
    const i = Math.min(POSES.length - 2, Math.floor(t))
    const f = t - i
    // hold within a band, ease between bands
    const e = f * f * (3 - 2 * f)
    const a = POSES[i]
    const b = POSES[i + 1]
    const time = clock.elapsedTime

    camPos.current.set(
      a.p[0] + (b.p[0] - a.p[0]) * e,
      a.p[1] + (b.p[1] - a.p[1]) * e,
      a.p[2] + (b.p[2] - a.p[2]) * e,
    )
    camLook.current.set(
      a.l[0] + (b.l[0] - a.l[0]) * e,
      a.l[1] + (b.l[1] - a.l[1]) * e,
      a.l[2] + (b.l[2] - a.l[2]) * e,
    )
    // barely-there breathing so stills stay alive
    camPos.current.x += Math.sin(time * 0.22) * 0.12
    camPos.current.y += Math.sin(time * 0.17) * 0.08

    camera.position.copy(camPos.current)
    camera.lookAt(camLook.current)

    ;(contour.uniforms.uBeacon.value as THREE.Vector3).set(
      world.beacon.x,
      world.beacon.z,
      world.beacon.i,
    )
    wire.uniforms.uTime.value = time
    wire.uniforms.uBass.value = world.bass
    if (wireMesh.current) wireMesh.current.visible = world.t > PIERCE_T - 0.35
  })

  return (
    <group>
      <mesh geometry={geometry} material={contour} />
      <mesh ref={wireMesh} geometry={geometry} material={wire} visible={false} />
    </group>
  )
}

export default function TerrainScene({ terra }: { terra: Terra }) {
  return (
    <Canvas
      className="terrain-canvas"
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: 50, near: 0.1, far: 300, position: POSES[0].p }}
    >
      <color attach="background" args={['#0b0d11']} />
      <Mountain terra={terra} />
    </Canvas>
  )
}
