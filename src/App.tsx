import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import InkEntry from './InkEntry'
import MainContent from './MainContent'
import { fetchVisitors, saveVisitor, type Visitor } from './visitors'
import { gradientFragmentShader, gradientVertexShader } from './shaders/gradientBg'
import HeroPlane from './HeroPlane'
import BioParagraphPlane from './BioParagraphPlane'
import ProjectsPlane from './ProjectsPlane'
import SocialLinksPlane from './SocialLinksPlane'
import WebGLInteractionProvider from './WebGLInteractionProvider'

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
        opacity:       0.035,
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
        transition:    'background 0.8s ease',
      }}
    />
  )
}

// ─── ModeToggle ───────────────────────────────────────────────────────────────
function ModeToggle({
  mode,
  accent,
  isMobile,
  onToggle,
}: {
  mode:     Mode
  accent:   string
  isMobile: boolean
  onToggle: () => void
}) {
  const isNight = mode === 'creative'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${isNight ? 'day' : 'night'} mode`}
      style={{
        position:  'fixed',
        top:       '1.5rem',
        zIndex:    50,
        ...(isMobile
          ? { left: '50%', transform: 'translateX(-50%)' }
          : { right: '1.5rem' }),
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '5px 10px',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(0,0,0,0.28)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer',
        fontFamily: '"Space Mono", monospace',
        fontSize: '10px',
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.7)',
        outline: 'none',
        WebkitFontSmoothing: 'antialiased',
        userSelect: 'none',
      }}
    >
      <span style={{ transition: 'opacity 0.35s', opacity: isNight ? 0.35 : 1 }}>
        DAY
      </span>

      <div
        style={{
          position: 'relative',
          width: '22px',
          height: '10px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position:   'absolute',
            top:        '1px',
            left:       isNight ? '11px' : '1px',
            width:      '8px',
            height:     '8px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)',
            boxShadow:  `0 0 6px 2px ${accent}55`,
            transition: `left 0.35s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.7s ease`,
          }}
        />
      </div>

      <span style={{ transition: 'opacity 0.35s', opacity: isNight ? 1 : 0.35 }}>
        NIGHT
      </span>
    </button>
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

// ─── TextReveal ───────────────────────────────────────────────────────────────
function TextReveal({ phase }: { phase: Phase }) {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const isVisible      = entered && phase === 'text-reveal'
  const isTransitioning = phase === 'transition'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <h1
        style={{
          fontFamily: '"Space Mono", monospace',
          color: 'white',
          letterSpacing: '0.2em',
          fontSize: 'clamp(2.5rem, 7vw, 5.5rem)',
          fontWeight: 700,
          margin: 0,
          userSelect: 'none',
          opacity:   isTransitioning ? 0 : isVisible ? 1 : 0,
          transform: isVisible || isTransitioning ? 'scale(1)' : 'scale(0.95)',
          transition: isTransitioning
            ? 'opacity 1s ease-in-out'
            : 'opacity 0.8s cubic-bezier(0.215,0.61,0.355,1), transform 0.8s cubic-bezier(0.215,0.61,0.355,1)',
        }}
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

// ─── R3F: fullscreen orthographic plane + custom gradient shader ─────────────
function GradientBackgroundPlane({ mode }: { mode: Mode }) {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const modeSmoothed = useRef(0)
  const modeRef = useRef(mode)
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

  useFrame((state, dt) => {
    const mat = matRef.current
    if (!mat) return
    mat.uniforms.uTime.value = state.clock.elapsedTime
    const target = modeRef.current === 'creative' ? 1 : 0
    modeSmoothed.current += (target - modeSmoothed.current) * Math.min(1, dt * 5)
    mat.uniforms.uMode.value = modeSmoothed.current
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
  visible,
  heroVisible,
}: {
  mode: Mode
  visible: boolean
  heroVisible: boolean
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
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s ease-in-out',
      }}
    >
      <color attach="background" args={['#060e1e']} />
      <WebGLInteractionProvider visible={heroVisible}>
        <GradientBackgroundPlane mode={mode} />
        <HeroPlane mode={mode} visible={heroVisible} />
        <BioParagraphPlane mode={mode} visible={heroVisible} />
        <ProjectsPlane mode={mode} visible={heroVisible} />
        <SocialLinksPlane visible={heroVisible} />
      </WebGLInteractionProvider>
    </Canvas>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const skipAnimation = (() => {
    try { return localStorage.getItem('hasSeenAnimation') === 'true' } catch { return false }
  })()

  const [phase, setPhase] = useState<Phase>(skipAnimation ? 'main' : 'entry')
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

  const gradientVisible = phase !== 'entry' && phase !== 'text-reveal'

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
        visible={gradientVisible}
        heroVisible={phase === 'main'}
      />

      {phase !== 'main' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10,
            opacity:       phase === 'transition' ? 0 : 1,
            transition:    phase === 'transition' ? 'opacity 1s ease-in-out' : undefined,
            pointerEvents: phase === 'transition' ? 'none' : 'auto',
            background:    visitorsReady ? undefined : '#000',
          }}
        >
          {visitorsReady && (
            <InkEntry
              onComplete={() => setPhase('text-reveal')}
              visitors={visitors}
              heroColor={heroColor}
            />
          )}
        </div>
      )}

      {(phase === 'text-reveal' || phase === 'transition') && (
        <TextReveal phase={phase} />
      )}

      <div
        style={{
          position:      'relative',
          zIndex:        5,
          minHeight:     '100vh',
          opacity:       phase === 'main' || phase === 'transition' ? 1 : 0,
          transition:    phase === 'transition' ? 'opacity 1s ease-in-out' : undefined,
          pointerEvents: phase === 'main' ? 'auto' : 'none',
        }}
      >
        <MainContent mode={mode} active={phase === 'main'} />
      </div>

      {showPicker && <ColorPicker onSelect={handleColorSelect} />}

      {phase === 'main' && (
        <div
          data-webgl-hit-ignore
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'auto' }}>
            <ModeToggle
              mode={mode}
              accent={accent}
              isMobile={isMobile}
              onToggle={() => setMode(m => (m === 'pro' ? 'creative' : 'pro'))}
            />
          </div>
        </div>
      )}

      {phase === 'main' && visitors.length > 0 && (
        <div
          style={{
            position:      'fixed',
            top:           '1.5rem',
            left:          '1.5rem',
            zIndex:        50,
            fontFamily:    '"Space Mono", monospace',
            fontSize:      '10px',
            letterSpacing: '0.15em',
            color:         'rgba(255,255,255,0.2)',
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
