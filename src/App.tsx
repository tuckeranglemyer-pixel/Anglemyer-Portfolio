import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import MainContent from './MainContent'
import { fetchVisitors, type Visitor } from './visitors'
import { gradientFragmentShader, gradientVertexShader } from './shaders/gradientBg'
import WebGLInteractionProvider from './WebGLInteractionProvider'
import { waterSim } from './WaterSimSingleton'
import {
	WaterDisplacementEffect,
	DEFAULT_WATER_DISPLACEMENT_SCALE,
} from './WaterDisplacementEffect'
import InkDropOverlay from './InkDropOverlay'
import CustomCursor from './CustomCursor'
import AmbientPad from './AmbientPad'
import IdentityCycle from './IdentityCycle'
import PilowlavaHero3D from './PilowlavaHero3D'

// ─── types ────────────────────────────────────────────────────────────────────
type Phase = 'entry' | 'main'
type Mode  = 'pro' | 'creative'

// ─── accent colors ────────────────────────────────────────────────────────────
const ACCENTS: Record<Mode, string> = {
  pro:      '#38bdf8',
  creative: '#fb923c',
}

// ─── useIsMobile ──────────────────────────────────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [is, setIs] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  )
  useEffect(() => {
    const update = () => setIs(window.innerWidth < breakpoint)
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [breakpoint])
  return is
}

// ─── GrainOverlay ─────────────────────────────────────────────────────────────
function GrainOverlay() {
  return (
    <div
      aria-hidden="true"
      style={{
        position:      'fixed',
        inset:         0,
        zIndex:        90,
        pointerEvents: 'none',
        opacity:       0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23g)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
        backgroundSize:   '200px 200px',
      }}
    />
  )
}

// ─── CursorGlow ───────────────────────────────────────────────────────────────
function CursorGlow({ accent }: { accent: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return
      ref.current.style.transform = `translate(${e.clientX - 100}px, ${e.clientY - 100}px)`
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  return (
    <div
      ref={ref}
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        width:         '200px',
        height:        '200px',
        borderRadius:  '50%',
        background:    `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
        opacity:       0.05,
        pointerEvents: 'none',
        zIndex:        2,
        willChange:    'transform',
        transition:    'background 0.6s ease',
      }}
    />
  )
}

// ─── Water displacement post-FX (singleton sim; update gated by enabled) ─────────
function WaterSimPostFx({ enabled }: { enabled: boolean }) {
	// One Effect instance; `waterSim` may replace its DataTexture on resize — sync uniform in useFrame.
	const effect = useMemo(
		() =>
			new WaterDisplacementEffect({
				displacementMap: waterSim.getTexture(),
				scale: DEFAULT_WATER_DISPLACEMENT_SCALE,
			}),
		// eslint-disable-next-line react-hooks/exhaustive-deps -- intentional single instance; map synced in useFrame
		[],
	)

	useEffect(() => {
		return () => {
			effect.dispose()
		}
	}, [effect])

	const composerChild = useMemo(
		() => <primitive object={effect} dispose={null} />,
		[effect],
	)

	useFrame(() => {
		const tex = waterSim.getTexture()
		if (effect.displacementMap !== tex) {
			effect.displacementMap = tex
		}
		if (enabled) waterSim.update()
	})

	return <EffectComposer>{composerChild}</EffectComposer>
}

// ─── R3F: fullscreen orthographic plane + custom gradient shader ─────────────
function GradientBackgroundPlane({ mode }: { mode: Mode }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const modeRef = useRef(mode)
  const prevModeRef = useRef(mode)
  const transitionStartRef = useRef<number | null>(null)
  const modeFromRef = useRef(0)
  const uModeSmoothed = useRef(0)

  useLayoutEffect(() => {
    modeRef.current = mode
  }, [mode])
  const { viewport } = useThree()

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMode: { value: 0 },
    }),
    [],
  )

  useFrame((state) => {
    const mat = matRef.current
    if (!mat) return
    mat.uniforms.uTime.value = state.clock.elapsedTime

    if (prevModeRef.current !== modeRef.current) {
      transitionStartRef.current = state.clock.elapsedTime
      modeFromRef.current = uModeSmoothed.current
      prevModeRef.current = modeRef.current
    }

    const target = modeRef.current === 'creative' ? 1 : 0

    if (transitionStartRef.current !== null) {
      const t = Math.min(1, (state.clock.elapsedTime - transitionStartRef.current) / 0.6)
      const eased = t * t * (3 - 2 * t)
      uModeSmoothed.current = THREE.MathUtils.lerp(modeFromRef.current, target, eased)
      mat.uniforms.uMode.value = uModeSmoothed.current
      if (t >= 1) transitionStartRef.current = null
    } else {
      uModeSmoothed.current = target
      mat.uniforms.uMode.value = uModeSmoothed.current
    }
  })

  return (
    <mesh scale={[viewport.width, viewport.height, 1]} renderOrder={-1}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={gradientVertexShader}
        fragmentShader={gradientFragmentShader}
        depthWrite={false}
      />
    </mesh>
  )
}

function FullscreenGradientCanvas({
  mode,
  heroVisible,
  waterPostEnabled,
}: {
  mode: Mode
  heroVisible: boolean
  waterPostEnabled: boolean
}) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 1], zoom: 1, near: 0.1, far: 10 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 1,
      }}
    >
      <color attach="background" args={['#060e1e']} />
      <WebGLInteractionProvider visible={heroVisible}>
        <GradientBackgroundPlane mode={mode} />
        {mode === 'creative' && heroVisible && <PilowlavaHero3D />}
      </WebGLInteractionProvider>
      <WaterSimPostFx enabled={waterPostEnabled} />
    </Canvas>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const skipAnimation = (() => {
    try { return localStorage.getItem('hasSeenAnimation') === 'true' } catch { return false }
  })()

  const [phase, setPhase] = useState<Phase>(() => (skipAnimation ? 'main' : 'entry'))

  const [mode,  setMode]  = useState<Mode>('pro')
  const accent   = ACCENTS[mode]
  const isMobile = useIsMobile()

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as Window & { _loaderTimer?: ReturnType<typeof setTimeout> })._loaderTimer) {
      clearTimeout((window as Window & { _loaderTimer?: ReturnType<typeof setTimeout> })._loaderTimer)
    }
    const el = document.getElementById('loading')
    if (!el) return
    el.classList.remove('visible')
    el.style.opacity = '0'
    const t = setTimeout(() => el.remove(), 300)
    return () => clearTimeout(t)
  }, [])

  const [visitors,      setVisitors]      = useState<Visitor[]>([])
  const [visitorsReady, setVisitorsReady] = useState(skipAnimation)

  const [identityCycleOpen, setIdentityCycleOpen] = useState(false)
  const heroContainerRef = useRef<HTMLDivElement | null>(null)

  const handleIdentityCycleComplete = useCallback(() => {
    setIdentityCycleOpen(false)
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    waterSim.addRipple(cx, cy, 150.0)
    setTimeout(() => waterSim.addRipple(cx, cy, 80.0), 300)
    setTimeout(() => waterSim.addRipple(cx, cy, 40.0), 600)
    try { sessionStorage.setItem('hasSeenCycle', 'true') } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      if (sessionStorage.getItem('hasSeenCycle') === 'true') return
    } catch {
      return
    }
    if (phase !== 'main') return
    setIdentityCycleOpen(true)
  }, [phase])

  useEffect(() => {
    if (visitorsReady) return

    let cancelled = false

    const timeout = setTimeout(() => {
      if (!cancelled) setVisitorsReady(true)
    }, 2500)

    fetchVisitors()
      .then(data => {
        if (!cancelled) {
          setVisitors(data)
          clearTimeout(timeout)
          setVisitorsReady(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearTimeout(timeout)
          setVisitorsReady(true)
        }
      })

    return () => { cancelled = true; clearTimeout(timeout) }
  }, [visitorsReady])

  const waterPostEnabled = true

  const handleInkDropImpact = useCallback(() => {
    waterSim.addRipple(window.innerWidth / 2, window.innerHeight / 2, 200.0)
    setTimeout(() => waterSim.addRipple(window.innerWidth / 2, window.innerHeight / 2, 120.0), 250)
  }, [])

  const handleInkDropComplete = useCallback(() => {
    setPhase('main')
    try { localStorage.setItem('hasSeenAnimation', 'true') } catch {}
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    setTimeout(() => waterSim.addRipple(cx, cy, 150.0), 0)
    setTimeout(() => waterSim.addRipple(cx, cy, 80.0), 250)
    setTimeout(() => waterSim.addRipple(cx, cy, 40.0), 500)
  }, [])

  return (
    <>
      <FullscreenGradientCanvas
        mode={mode}
        heroVisible={phase === 'main'}
        waterPostEnabled={waterPostEnabled}
      />

      {phase === 'entry' && visitorsReady && (
        <InkDropOverlay onImpact={handleInkDropImpact} onComplete={handleInkDropComplete} />
      )}

      {phase === 'entry' && !visitorsReady && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10,
            background: '#000',
            pointerEvents: 'none',
          }}
        />
      )}

      <div
        style={{
          position:      'relative',
          zIndex:        5,
          width:         '100%',
          height:        '100vh',
          maxHeight:       '100vh',
          overflow:      'hidden',
          opacity:       phase === 'main' ? 1 : 0,
          pointerEvents: phase === 'main' ? 'auto' : 'none',
          transition:    'opacity 0.9s ease',
        }}
      >
        <MainContent
          phase={phase}
          mode={mode}
          active={phase === 'main'}
          accent={accent}
          onToggleMode={() => setMode(m => (m === 'pro' ? 'creative' : 'pro'))}
          identityCycleHidesContent={identityCycleOpen}
          heroContainerRef={heroContainerRef}
          hideHeroDuringIdentityCycle={identityCycleOpen}
        />
      </div>

      {identityCycleOpen && (
        <IdentityCycle active onComplete={handleIdentityCycleComplete} />
      )}

      {phase === 'main' && visitorsReady && (
        <div
          style={{
            position:      'fixed',
            top:           '1.5rem',
            left:          '1.5rem',
            zIndex:        50,
            fontFamily:    '"Space Mono", monospace',
            fontSize:      '11px',
            opacity:       1,
            color:         'rgba(255,255,255,0.22)',
            pointerEvents: 'none',
            userSelect:    'none',
          }}
        >
          {visitors.length} visitors
        </div>
      )}

      {phase === 'main' && !isMobile && <CursorGlow accent={accent} />}

      <GrainOverlay />

      <CustomCursor accent={accent} />

      {phase === 'main' && <AmbientPad />}
    </>
  )
}
