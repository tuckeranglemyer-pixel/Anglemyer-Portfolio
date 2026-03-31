import { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

type Mode = 'pro' | 'creative'

// ─── mobile hook ──────────────────────────────────────────────────────────────
function useIsMobile(bp = 768) {
  const [is, setIs] = useState(() => typeof window !== 'undefined' && window.innerWidth < bp)
  useEffect(() => {
    const fn = () => setIs(window.innerWidth < bp)
    window.addEventListener('resize', fn, { passive: true })
    return () => window.removeEventListener('resize', fn)
  }, [bp])
  return is
}

// ─── GLSL: Stefan Gustavson 3-D simplex noise ─────────────────────────────────
// Overloaded mod289 / permute / taylorInvSqrt (GLSL allows overloading).
const NOISE_GLSL = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+10.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx,x2=x0-i2+C.yyy,x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.,i1.z,i2.z,1.))+
    i.y+vec4(0.,i1.y,i2.y,1.))+
    i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z),y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy,y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy),b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.,s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x),p1=vec3(a0.zw,h.y),
       p2=vec3(a1.xy,h.z),p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`

// ─── GLSL: 5-octave fractal Brownian motion ───────────────────────────────────
const FBM_GLSL = /* glsl */`
float fbm(vec3 p){
  float v=0.,a=.5;
  vec3 s=vec3(1.7,9.2,8.3);
  for(int i=0;i<5;i++){v+=a*snoise(p);p=p*2.+s;a*=.5;}
  return v;
}`

// ─── Shared vertex shader ─────────────────────────────────────────────────────
// Passes world-space position + normal so fragment shaders can compute view
// direction and Fresnel without depending on view-space transforms.
const VERT = /* glsl */`
varying vec3 vWp;
varying vec3 vWn;
void main(){
  vec4 wp=modelMatrix*vec4(position,1.);
  vWp=wp.xyz;
  // mat3(modelMatrix) is the rotation-scale part; normalise fixes non-unit scale
  vWn=normalize(mat3(modelMatrix)*normal);
  gl_Position=projectionMatrix*viewMatrix*wp;
}`

// ─── Sun: core sphere fragment (r = 1) ────────────────────────────────────────
// Domain-warped fBM creates convection granules. Low-frequency noise punches
// dark sunspot umbrae. Fresnel adds the corona rim on the sphere itself.
const SUN_FRAG = /* glsl */`
uniform float uTime;
varying vec3 vWp;
varying vec3 vWn;
${NOISE_GLSL}
${FBM_GLSL}
void main(){
  vec3 p=normalize(vWp);

  // Domain warp: distort the sample point with slow-moving noise
  vec3 q=vec3(
    fbm(p*2.5+vec3(0.,0.,uTime*.04)),
    fbm(p*2.5+vec3(5.2,1.3,0.)+uTime*.04),
    fbm(p*2.5+vec3(2.4,8.6,0.)+uTime*.04));

  // Heat: domain-warped fBM at convection scale (slow churn)
  float heat=fbm(p*2.5+.9*q+uTime*.022);
  heat=clamp(heat*.5+.5,0.,1.);

  // Sunspots: low-frequency, slow drift
  float spot=fbm(p*.85+vec3(uTime*.011));
  spot=spot*.5+.5;
  // Spots form in cooler regions at low-spot-noise threshold
  float spotMask=(1.-smoothstep(.36,.44,spot))*(1.-smoothstep(.46,.54,heat));

  // Color ramp: cool #cc3300 → mid #ff6600 → hot #ffee88
  vec3 cool=vec3(.80,.20,.00);
  vec3 mid =vec3(1.00,.40,.00);
  vec3 hot =vec3(1.00,.93,.53);
  vec3 col =heat<.5 ? mix(cool,mid,heat*2.) : mix(mid,hot,(heat-.5)*2.);

  // Sunspot darkening (deep umbra, dark brownish-red)
  col=mix(col,vec3(.35,.04,.00),spotMask*.80);

  // Fresnel corona glow at sphere rim
  vec3 vd=normalize(cameraPosition-vWp);
  float fr=pow(max(0.,1.-dot(vd,normalize(vWn))),2.0);
  col+=vec3(1.,.50,.07)*fr*1.6;

  gl_FragColor=vec4(col,1.);
}`

// ─── Sun: corona atmosphere (r = 1.3, additive) ───────────────────────────────
// Fresnel ≈ 0 at the center (transparent, shows sun through) and ≈ 1 at the
// rim, where additive blending adds the orange-yellow halo.
const CORONA_FRAG = /* glsl */`
varying vec3 vWp;
varying vec3 vWn;
void main(){
  vec3 vd=normalize(cameraPosition-vWp);
  float fr=pow(max(0.,1.-dot(vd,normalize(vWn))),1.5);
  vec3 col=mix(vec3(1.,.38,.04),vec3(1.,.82,.24),fr);
  gl_FragColor=vec4(col,fr*.60);
}`

// ─── Moon: surface sphere (r = 1) ────────────────────────────────────────────
// Three-layer noise: large maria, medium craters, fine regolith.
// Lambertian shading from a fixed world-space light; the mesh rotates slowly
// so the terminator moves across the surface over time.
const MOON_FRAG = /* glsl */`
varying vec3 vWp;
varying vec3 vWn;
${NOISE_GLSL}
${FBM_GLSL}
void main(){
  vec3 p=normalize(vWp);

  // Large-scale maria / highland regions
  float n1=fbm(p*2.2)*.5+.5;
  // Medium crater rims and basins
  float n2=fbm(p*7.5)*.5+.5;
  // Fine regolith texture
  float n3=snoise(p*22.)*.5+.5;

  float terrain=clamp(n1*.55+n2*.30+n3*.15,0.,1.);

  // #555555 (mare) to #888888 (highland)
  vec3 mare=vec3(.333,.333,.333);
  vec3 high=vec3(.533,.533,.533);
  vec3 col=mix(mare,high,smoothstep(.35,.65,terrain));
  col*=.88+n3*.12;   // micro-roughness brightness variation

  // Lambertian shading (light from upper-right-front in world space)
  vec3 L=normalize(vec3(.6,.45,1.));
  float NdL=max(0.,dot(normalize(vWn),L));
  col*=.18+.82*NdL;  // ambient + diffuse

  // Thin blue-white Fresnel limb glow (much subtler than sun)
  vec3 vd=normalize(cameraPosition-vWp);
  float fr=pow(max(0.,1.-dot(vd,normalize(vWn))),4.5);
  col+=vec3(.65,.72,1.)*fr*.18;

  gl_FragColor=vec4(col,1.);
}`

// ─── R3F meshes ───────────────────────────────────────────────────────────────

function SunMesh() {
  const sunRef    = useRef<THREE.ShaderMaterial>(null)
  const coronaRef = useRef<THREE.ShaderMaterial>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (sunRef.current)    sunRef.current.uniforms.uTime.value    = t
    // Corona has no uTime; no update needed
    void coronaRef  // kept for future use
  })

  return (
    <group>
      {/* Core sun sphere */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          ref={sunRef}
          vertexShader={VERT}
          fragmentShader={SUN_FRAG}
          uniforms={{ uTime: { value: 0 } }}
        />
      </mesh>

      {/* Corona atmosphere — larger sphere, additive, no depth writes */}
      <mesh>
        <sphereGeometry args={[1.3, 32, 32]} />
        <shaderMaterial
          ref={coronaRef}
          vertexShader={VERT}
          fragmentShader={CORONA_FRAG}
          uniforms={{}}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function MoonMesh() {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (meshRef.current) {
      // 0.02 rad/s rotation on Y axis
      meshRef.current.rotation.y += 0.02 * delta
    }
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={MOON_FRAG}
        uniforms={{}}
      />
    </mesh>
  )
}

// ─── CelestialBody ────────────────────────────────────────────────────────────
// Positioned at top:-size/2, left:-size/2 so only the bottom-right quarter
// of the sphere peeks into the viewport from the top-left corner.
// Two separate R3F canvases (one per mode) crossfade via CSS opacity.
// Their WebGL contexts are completely independent of @shadergradient/react.
export default function CelestialBody({ mode }: { mode: Mode }) {
  const isMobile = useIsMobile()
  const size     = isMobile ? 120 : 200
  const offset   = -(size / 2)

  // Keep both canvases mounted during the 0.5s crossfade, then unmount the
  // inactive one so it stops consuming GPU time.
  const [sunMounted,  setSunMounted]  = useState(mode === 'pro')
  const [moonMounted, setMoonMounted] = useState(mode === 'creative')

  useEffect(() => {
    if (mode === 'pro') {
      setSunMounted(true)
      const t = setTimeout(() => setMoonMounted(false), 600)
      return () => clearTimeout(t)
    } else {
      setMoonMounted(true)
      const t = setTimeout(() => setSunMounted(false), 600)
      return () => clearTimeout(t)
    }
  }, [mode])

  const canvasProps = {
    camera: { position: [0, 0, 2.5] as [number, number, number], fov: 55 },
    gl:    { alpha: true, antialias: true, powerPreference: 'low-power' as const },
    // pointer-events: none on both the wrapper div AND the canvas element so
    // R3F's own event delegation never intercepts the shark fin's document
    // listener, and getBoundingClientRect calls from other components are unaffected.
    style: {
      background:    'transparent',
      display:       'block',
      width:         '100%',
      height:        '100%',
      pointerEvents: 'none' as const,
    },
  }

  return (
    <div
      style={{
        position:      'fixed',
        top:           `${offset}px`,
        left:          `${offset}px`,
        width:         `${size}px`,
        height:        `${size}px`,
        pointerEvents: 'none',
        zIndex:        3,
      }}
    >
      {/* ── Sun canvas (DAY / pro) ────────────────────────────────────────── */}
      {sunMounted && (
        <div
          style={{
            position:   'absolute',
            inset:      0,
            opacity:    mode === 'pro' ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        >
          <Canvas {...canvasProps}>
            <SunMesh />
          </Canvas>
        </div>
      )}

      {/* ── Moon canvas (NIGHT / creative) ───────────────────────────────── */}
      {moonMounted && (
        <div
          style={{
            position:   'absolute',
            inset:      0,
            opacity:    mode === 'creative' ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        >
          <Canvas {...canvasProps}>
            <MoonMesh />
          </Canvas>
        </div>
      )}
    </div>
  )
}
