import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import MainContent from './MainContent'
import { fetchVisitors, saveVisitor, type Visitor } from './visitors'
import { gradientFragmentShader, gradientVertexShader } from './shaders/gradientBg'
import HeroPlane from './HeroPlane'
import BioParagraphPlane from './BioParagraphPlane'
import ProjectsPlane from './ProjectsPlane'
import SocialLinksPlane from './SocialLinksPlane'
import WebGLInteractionProvider from './WebGLInteractionProvider'
import { waterSim } from './WaterSimSingleton'
import {
	WaterDisplacementEffect,
	DEFAULT_WATER_DISPLACEMENT_SCALE,
} from './WaterDisplacementEffect'
import InkDropOverlay from './InkDropOverlay'
import CustomCursor from './CustomCursor'
import AmbientPad from './AmbientPad'

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
        zIndex:        100,
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

const PALETTE: { hex: string; name: string }[] = [
  { hex: '#00d4ff', name: 'cyan'    },
  { hex: '#ff3aff', name: 'magenta' },
  { hex: '#ffb300', name: 'amber'   },
  { hex: '#00c875', name: 'emerald' },
  { hex: '#8b5cf6', name: 'violet'  },
  { hex: '#ff6b6b', name: 'coral'   },
  { hex: '#f0f0f0', name: 'white'   },
  { hex: '#ffd700', name: 'gold'    },
]

// ─── ColorPicker (after main phase; above grain overlay z-index) ──────────────
function ColorPicker({
  onSelect,
  isMobile,
}: {
  onSelect: (color: string) => void
  isMobile: boolean
}) {
  const [entered, setEntered] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 800)
    return () => clearTimeout(t)
  }, [])

  const visible = entered && !exiting

  const pick = (hex: string) => {
    if (exiting) return
    setExiting(true)
    window.setTimeout(() => onSelect(hex), 500)
  }

  return (
    <div
      data-webgl-hit-ignore
      style={{
        position: 'fixed',
        bottom: isMobile ? '1.25rem' : '2.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 110,
        textAlign: 'center',
        maxWidth: 'min(100vw - 2rem, 520px)',
        padding: '0 16px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s ease',
        pointerEvents: entered && !exiting ? 'auto' : 'none',
      }}
    >
      <p
        style={{
          fontFamily: '"Space Mono", monospace',
          color: 'rgba(255,255,255,0.22)',
          letterSpacing: '0.2em',
          fontSize: '11px',
          textTransform: 'uppercase',
          margin: '0 0 24px',
        }}
      >
        leave your mark
      </p>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'nowrap',
          gap: isMobile ? '0.5rem' : '0.75rem',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {PALETTE.map(({ hex, name }) => (
          <button
            key={hex}
            type="button"
            title={name}
            onClick={() => pick(hex)}
            style={{
              width: isMobile ? '1.5rem' : '1.75rem',
              height: isMobile ? '1.5rem' : '1.75rem',
              borderRadius: '50%',
              background: hex,
              border: '2px solid rgba(255,255,255,0.22)',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
              transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.transform = 'scale(1.3)'
              el.style.borderColor = 'rgba(255,255,255,0.55)'
              el.style.boxShadow = `0 0 10px 2px ${hex}66`
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.transform = 'scale(1)'
              el.style.borderColor = 'rgba(255,255,255,0.22)'
              el.style.boxShadow = 'none'
            }}
          />
        ))}
      </div>
    </div>
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
  planesVisible,
  planeOpacity,
  webGLTextVisible,
}: {
  mode: Mode
  heroVisible: boolean
  waterPostEnabled: boolean
  planesVisible: boolean
  planeOpacity: number
  webGLTextVisible: boolean
}) {
  const renderCountRef = useRef(0)
  renderCountRef.current += 1
  console.log('[FullscreenGradientCanvas] render #', renderCountRef.current)

  useEffect(() => {
    console.log('[Canvas] mounted')
    return () => {
      console.log('[Canvas] unmounted')
    }
  }, [])

  const showTextPlanes = planesVisible && webGLTextVisible
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
        <HeroPlane
          mode={mode}
          visible={showTextPlanes}
          materialOpacity={planeOpacity}
        />
        <BioParagraphPlane
          mode={mode}
          visible={showTextPlanes}
          materialOpacity={planeOpacity}
        />
        <ProjectsPlane
          mode={mode}
          visible={showTextPlanes}
          materialOpacity={planeOpacity}
        />
        <SocialLinksPlane visible={showTextPlanes} materialOpacity={planeOpacity} />
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

  const [hasChosen] = useState<boolean>(() => {
    try {
      return !!(
        localStorage.getItem('visitorDocId') || localStorage.getItem('visitorColor')
      )
    } catch {
      return false
    }
  })

  const [pickerDismissed, setPickerDismissed] = useState(false)
  const showPicker = phase === 'main' && !hasChosen && !pickerDismissed

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

  const planeOpacity = phase === 'main' ? 1 : 0

  const planesVisible = phase === 'main'
  const webGLTextVisible = false
  const waterPostEnabled = true

  const handleInkDropImpact = useCallback(() => {}, [])

  const handleInkDropComplete = useCallback(() => {
    setPhase('main')
    try { localStorage.setItem('hasSeenAnimation', 'true') } catch {}
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    setTimeout(() => waterSim.addRipple(cx, cy, 100.0), 0)
    setTimeout(() => waterSim.addRipple(cx, cy, 60.0), 250)
    setTimeout(() => waterSim.addRipple(cx, cy, 30.0), 500)
  }, [])

  const handleColorSelect = async (color: string) => {
    setPickerDismissed(true)
    try {
      const docId = await saveVisitor(color)
      try {
        localStorage.setItem('visitorDocId', docId)
        localStorage.setItem('visitorColor', color)
      } catch { /* storage blocked */ }
    } catch {
      try {
        localStorage.setItem('visitorDocId', 'local_' + Date.now())
        localStorage.setItem('visitorColor', color)
      } catch { /* storage blocked */ }
    }
  }

  return (
    <>
      <FullscreenGradientCanvas
        mode={mode}
        heroVisible={phase === 'main'}
        waterPostEnabled={waterPostEnabled}
        planesVisible={planesVisible}
        planeOpacity={planeOpacity}
        webGLTextVisible={webGLTextVisible}
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
          minHeight:     '100vh',
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
        />
      </div>

      {showPicker && <ColorPicker onSelect={handleColorSelect} isMobile={isMobile} />}

      {phase === 'main' && visitorsReady && (
        <div
          style={{
            position:      'fixed',
            top:           '1.5rem',
            left:          '1.5rem',
            zIndex:        105,
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
