import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
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
import { useWaterSim } from './useWaterSim'
import {
	WaterDisplacementEffect,
	DEFAULT_WATER_DISPLACEMENT_SCALE,
} from './WaterDisplacementEffect'
import InkEntryScene from './InkEntryScene'

// ─── types ────────────────────────────────────────────────────────────────────
type Phase = 'entry' | 'text-reveal' | 'transition' | 'main'
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

// ─── CursorDot ────────────────────────────────────────────────────────────────
function CursorDot() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches
    if (isTouch) return
    const el = ref.current
    if (!el) return
    const move = (e: MouseEvent) => {
      el.style.transform = `translate(${e.clientX - 3}px, ${e.clientY - 3}px)`
    }
    window.addEventListener('mousemove', move, { passive: true })
    return () => window.removeEventListener('mousemove', move)
  }, [])
  const isTouch =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: none) and (pointer: coarse)').matches
  if (isTouch) return null
  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.5)',
        pointerEvents: 'none',
        zIndex: 9999,
        transform: 'translate(-100px, -100px)',
        willChange: 'transform',
      }}
    />
  )
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

const DEFAULT_HERO_COLOR = '#00d4ff'

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

// ─── ANGLEMYER title overlay (text-reveal → transition) ───────────────────────
function TextRevealOverlay({ phase }: { phase: Phase }) {
  if (phase !== 'text-reveal' && phase !== 'transition') return null

  return (
    <div className="anglemyer-title-overlay">
      <h1
        className={
          phase === 'transition' ? 'anglemyer-title--fade-out' : 'anglemyer-title--fade-in'
        }
      >
        ANGLEMYER
      </h1>
    </div>
  )
}

// ─── ColorPicker ─────────────────────────────────────────────────────────────
function ColorPicker({ onSelect }: { onSelect: (color: string) => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      data-webgl-hit-ignore
      style={{
        position: 'fixed',
        bottom: '2.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        textAlign: 'center',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.6s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <p
        style={{
          fontFamily: '"Space Mono", monospace',
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.2em',
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          margin: '0 0 1rem',
        }}
      >
        leave your mark
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
        {PALETTE.map(({ hex, name }) => (
          <button
            key={hex}
            title={name}
            onClick={() => onSelect(hex)}
            style={{
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '50%',
              background: hex,
              border: '2px solid rgba(255,255,255,0.15)',
              cursor: 'pointer',
              padding: 0,
              transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.transform    = 'scale(1.3)'
              el.style.borderColor  = 'rgba(255,255,255,0.7)'
              el.style.boxShadow    = `0 0 10px 2px ${hex}66`
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.transform    = 'scale(1)'
              el.style.borderColor  = 'rgba(255,255,255,0.15)'
              el.style.boxShadow    = 'none'
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Water displacement post-FX (desktop only; see waterPostEnabled) ─────────
function WaterSimPostFx({ enabled }: { enabled: boolean }) {
	const { displacementMap, update } = useWaterSim()
	const effect = useMemo(
		() =>
			new WaterDisplacementEffect({
				displacementMap,
				scale: DEFAULT_WATER_DISPLACEMENT_SCALE,
			}),
		[displacementMap],
	)

	useEffect(() => {
		return () => {
			effect.dispose()
		}
	}, [effect])

	useFrame(() => {
		if (enabled) update()
	})

	if (!enabled) return null
	return (
		<EffectComposer>
			<primitive object={effect} dispose={null} />
		</EffectComposer>
	)
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
  inkEntry,
  planesVisible,
  planeOpacity,
  webGLTextVisible,
}: {
  mode: Mode
  heroVisible: boolean
  waterPostEnabled: boolean
  inkEntry:
    | {
        visitors: Visitor[]
        heroColor: string
        onComplete: () => void
      }
    | null
  planesVisible: boolean
  planeOpacity: number
  webGLTextVisible: boolean
}) {
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
        {inkEntry && (
          <InkEntryScene
            active
            visitors={inkEntry.visitors}
            heroColor={inkEntry.heroColor}
            onComplete={inkEntry.onComplete}
          />
        )}
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

  const [transitionPlaneOpacity, setTransitionPlaneOpacity] = useState(0)
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

  const [heroColor] = useState<string>(() => {
    try { return localStorage.getItem('visitorColor') || DEFAULT_HERO_COLOR } catch { return DEFAULT_HERO_COLOR }
  })

  const [hasChosen] = useState<boolean>(() => {
    try { return !!localStorage.getItem('visitorDocId') } catch { return false }
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

  useEffect(() => {
    if (phase !== 'text-reveal') return
    const t = setTimeout(() => setPhase('transition'), 800)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'transition') return
    const t = setTimeout(() => {
      setPhase('main')
      try { localStorage.setItem('hasSeenAnimation', 'true') } catch { /* SSR */ }
    }, 1000)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'transition') return
    let cancelled = false
    let rafId = 0
    const start = performance.now()
    const tick = () => {
      if (cancelled) return
      const t = Math.min(1, (performance.now() - start) / 1000)
      setTransitionPlaneOpacity(t)
      if (t < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [phase])

  const planeOpacity =
    phase === 'main' ? 1 : phase === 'transition' ? transitionPlaneOpacity : 0

  const planesVisible = phase === 'transition' || phase === 'main'
  const webGLTextVisible = phase !== 'main'
  const waterPostEnabled =
    !isMobile && (phase === 'transition' || phase === 'main')

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
        inkEntry={
          phase === 'entry' && visitorsReady
            ? {
                visitors,
                heroColor,
                onComplete: () => setPhase('text-reveal'),
              }
            : null
        }
      />

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

      <TextRevealOverlay phase={phase} />

      <div
        style={{
          position:      'relative',
          zIndex:        5,
          minHeight:     '100vh',
          opacity:       phase === 'main' ? 1 : 0,
          pointerEvents: phase === 'main' ? 'auto' : 'none',
        }}
      >
        <MainContent
          mode={mode}
          active={phase === 'main'}
          accent={accent}
          onToggleMode={() => setMode(m => (m === 'pro' ? 'creative' : 'pro'))}
        />
      </div>

      {showPicker && <ColorPicker onSelect={handleColorSelect} />}

      {phase === 'main' && visitorsReady && (
        <div
          style={{
            position:      'fixed',
            top:           '1.5rem',
            left:          '1.5rem',
            zIndex:        50,
            fontFamily:    '"Space Mono", monospace',
            fontSize:      '10px',
            opacity:       0.2,
            color:         'rgba(255,255,255,1)',
            pointerEvents: 'none',
            userSelect:    'none',
          }}
        >
          {visitors.length} visitors
        </div>
      )}

      {phase === 'main' && !isMobile && <CursorGlow accent={accent} />}

      <GrainOverlay />

      <CursorDot />
    </>
  )
}
