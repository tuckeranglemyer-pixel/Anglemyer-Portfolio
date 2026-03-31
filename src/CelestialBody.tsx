import { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

type Mode = 'pro' | 'creative'

// Canvas is 160×160 px; positioned at -85,-85 so only the bottom-right arc
// is visible — just a subtle curved edge peeking from the viewport corner.
const SIZE   = 160
const OFFSET = -85

// ─── GLSL: Stefan Gustavson 3-D simplex noise ─────────────────────────────────
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

// ─── GLSL: 5-octave fBM ───────────────────────────────────────────────────────
const FBM_GLSL = /* glsl */`
float fbm(vec3 p){
  float v=0.,a=.5;
  vec3 s=vec3(1.7,9.2,8.3);
  for(int i=0;i<5;i++){v+=a*snoise(p);p=p*2.+s;a*=.5;}
  return v;
}`

// ─── Shared vertex shader ─────────────────────────────────────────────────────
const VERT = /* glsl */`
varying vec3 vWp;
varying vec3 vWn;
void main(){
  vec4 wp=modelMatrix*vec4(position,1.);
  vWp=wp.xyz;
  vWn=normalize(mat3(modelMatrix)*normal);
  gl_Position=projectionMatrix*viewMatrix*wp;
}`

// ─── Sun: core sphere — visible amber churn (uTime drives noise domain) ─────
const SUN_FRAG = /* glsl */`
uniform float uTime;
varying vec3 vWp;
varying vec3 vWn;
${NOISE_GLSL}
${FBM_GLSL}
void main(){
  vec3 p=normalize(vWp);
  float t=uTime;

  // Domain warp — noise coords drift with time so convection visibly churns
  vec3 scroll=vec3(t*0.05,t*0.035,t*0.02);
  vec3 q=vec3(
    fbm(p*2.5+vec3(0.,0.,0.)+scroll),
    fbm(p*2.5+vec3(5.2,1.3,0.)+scroll*1.1),
    fbm(p*2.5+vec3(2.4,8.6,0.)+scroll*0.9));
  float heat=fbm(p*2.5+.9*q+scroll*0.5+t*0.03);
  heat=clamp(heat*.5+.5,0.,1.);

  float spot=fbm(p*.85+vec3(t*.018,t*.012,t*.015));
  spot=spot*.5+.5;
  float spotMask=(1.-smoothstep(.36,.44,spot))*(1.-smoothstep(.46,.54,heat));

  // Orange / amber surface (readable at 0.6 canvas opacity)
  vec3 cool=vec3(.62,.28,.06);
  vec3 mid =vec3(.92,.48,.12);
  vec3 hot =vec3(1.0,.82,.38);
  vec3 col=heat<.5 ? mix(cool,mid,heat*2.) : mix(mid,hot,(heat-.5)*2.);

  col=mix(col,vec3(.22,.08,.02),spotMask*.45);

  vec3 vd=normalize(cameraPosition-vWp);
  float NdotV=max(0.,dot(normalize(vWn),vd));
  float fr=pow(1.-NdotV,2.2);
  col+=vec3(1.,.55,.12)*fr*1.1;

  gl_FragColor=vec4(col,1.);
}`

// ─── Sun: corona (r = 1.3) — brightest at limb via Fresnel (1 − N·V) ───────────
const CORONA_FRAG = /* glsl */`
varying vec3 vWp;
varying vec3 vWn;
void main(){
  vec3 vd=normalize(cameraPosition-vWp);
  vec3 n=normalize(vWn);
  float NdotV=max(0.,dot(n,vd));
  float rim=pow(1.-NdotV,2.8);
  vec3 col=mix(vec3(1.,.48,.12),vec3(1.,.82,.45),rim);
  gl_FragColor=vec4(col,rim*0.62);
}`

// ─── Moon: surface sphere ─────────────────────────────────────────────────────
// Colors shifted toward the night-mode navy palette:
//   mare: #3d4a57  highland: #6b7b8d (both blue-tinted, much less grey)
const MOON_FRAG = /* glsl */`
varying vec3 vWp;
varying vec3 vWn;
${NOISE_GLSL}
${FBM_GLSL}
void main(){
  vec3 p=normalize(vWp);

  float n1=fbm(p*2.2)*.5+.5;
  float n2=fbm(p*7.5)*.5+.5;
  float n3=snoise(p*22.)*.5+.5;
  float terrain=clamp(n1*.55+n2*.30+n3*.15,0.,1.);

  // Navy-blue tinted greys (matches night-mode background palette)
  vec3 mare=vec3(.239,.290,.341);   // #3d4a57
  vec3 high=vec3(.420,.482,.553);   // #6b7b8d
  vec3 col=mix(mare,high,smoothstep(.35,.65,terrain));
  col*=.88+n3*.12;

  // Lambertian shading — slight ambient boost for a less stark look
  vec3 L=normalize(vec3(.6,.45,1.));
  float NdL=max(0.,dot(normalize(vWn),L));
  col*=.18+.80*NdL;

  // Blue-white Fresnel limb glow — a bit stronger to match cool palette
  vec3 vd=normalize(cameraPosition-vWp);
  float fr=pow(max(0.,1.-dot(vd,normalize(vWn))),4.5);
  col+=vec3(.55,.68,1.)*fr*.20;

  gl_FragColor=vec4(col,1.);
}`

// ─── R3F meshes ───────────────────────────────────────────────────────────────

/** Set true for one session to confirm uTime advances in the console */
const DEBUG_LOG_SUN_UTIME = false

function SunMesh() {
  const sunRef = useRef<THREE.ShaderMaterial>(null)
  const lastLogRef = useRef(0)

  useFrame(({ clock }) => {
    const mat = sunRef.current
    if (!mat) return
    const t = clock.getElapsedTime()
    mat.uniforms.uTime.value = t
    if (DEBUG_LOG_SUN_UTIME && t - lastLogRef.current >= 0.5) {
      lastLogRef.current = t
      console.log('[CelestialBody] Sun uTime =', t.toFixed(3))
    }
  })

  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          ref={sunRef}
          vertexShader={VERT}
          fragmentShader={SUN_FRAG}
          uniforms={{ uTime: { value: 0 } }}
        />
      </mesh>

      {/* Corona — larger sphere, additive blending, halved opacity */}
      <mesh>
        <sphereGeometry args={[1.3, 32, 32]} />
        <shaderMaterial
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
    if (meshRef.current) meshRef.current.rotation.y += 0.02 * delta
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
// Crossfade: opacity 0.6 → 0 over 0.4s → swap Canvas (key) → 0 → 0.6 over 0.4s
export default function CelestialBody({ mode }: { mode: Mode }) {
  // The mode currently RENDERED — lags behind the prop during the dip
  const [renderedMode, setRenderedMode] = useState<Mode>(mode)
  // When true, canvas + bloom use full opacity; false = fading out for swap
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (mode === renderedMode) {
      // Modes match — ensure widget is visible (handles rapid-switch edge cases)
      setVisible(true)
      return
    }
    // Start fade-out
    setVisible(false)
    // Switch the rendered canvas after the CSS transition completes
    const t = setTimeout(() => setRenderedMode(mode), 400)
    return () => clearTimeout(t)
  }, [mode, renderedMode])
  // When renderedMode changes, the effect re-runs → mode === renderedMode → setVisible(true)

  const canvasStyle = {
    background:    'transparent',
    display:       'block',
    width:         '100%',
    height:        '100%',
    pointerEvents: 'none' as const,
  }

  const ambientGlowBg =
    renderedMode === 'pro'
      ? 'radial-gradient(circle, rgba(255,180,60,0.08) 0%, transparent 70%)'
      : 'radial-gradient(circle, rgba(150,180,220,0.04) 0%, transparent 70%)'

  return (
    <>
      {/* Large atmospheric glow behind the sphere (not the WebGL canvas) */}
      <div
        aria-hidden
        style={{
          position:       'fixed',
          top:            '-60px',
          left:           '-60px',
          width:          '300px',
          height:         '300px',
          background:     ambientGlowBg,
          pointerEvents:  'none',
          zIndex:         3,
          opacity:        visible ? 1 : 0,
          transition:     'opacity 0.4s ease',
        }}
      />

      {/* ── Celestial canvas (SunMesh / MoonMesh via key=renderedMode) ───────────
          Opacity 0.6 when visible. z-index 4 above water (2). */}
      <div
        style={{
          position:      'fixed',
          top:           `${OFFSET}px`,
          left:          `${OFFSET}px`,
          width:         `${SIZE}px`,
          height:        `${SIZE}px`,
          pointerEvents: 'none',
          zIndex:        4,
          opacity:       visible ? 0.6 : 0,
          transition:    'opacity 0.4s ease',
        }}
      >
        {/* key={renderedMode} forces a fresh Canvas (and WebGL context) on switch */}
        <Canvas
          key={renderedMode}
          camera={{ position: [0, 0, 2.5] as [number, number, number], fov: 55 }}
          gl={{ alpha: true, antialias: true, powerPreference: 'low-power' as const }}
          style={canvasStyle}
        >
          {renderedMode === 'pro' ? <SunMesh /> : <MoonMesh />}
        </Canvas>
      </div>
    </>
  )
}
