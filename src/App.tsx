import { useState, useEffect, useRef } from 'react'
import InkEntry from './InkEntry'
import WaterBackground from './WaterBackground'
import MainContent from './MainContent'
import WaterDisplacement from './WaterDisplacement'
import CelestialBody from './CelestialBody'
import { fetchVisitors, saveVisitor, type Visitor } from './visitors'

// ─── types ────────────────────────────────────────────────────────────────────
type Phase = 'entry' | 'text-reveal' | 'transition' | 'main'
type Mode  = 'pro' | 'creative'

// ─── accent colors ────────────────────────────────────────────────────────────
const ACCENTS: Record<Mode, string> = {
  pro:      '#38bdf8',  // sky blue
  creative: '#fb923c',  // warm orange
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
// Minimal 6px dot (desktop only); replaces shark fin. z-index above water ripples.
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
// Static feTurbulence SVG tiled as a fixed overlay. Renders once; no repaints.
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
// 200px radial gradient that follows the mouse. Position is updated imperatively
// (no React re-renders on mousemove). Background transitions on mode change.
function CursorGlow({ accent }: { accent: string }) {
  const ref = useRef<HTMLDivElement>(null)

  // Wire up mouse tracking once — no deps, runs forever
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
        // transform intentionally omitted — managed imperatively above
        transition:    'background 0.8s ease',
      }}
    />
  )
}

// ─── ModeToggle ───────────────────────────────────────────────────────────────
// Fixed pill. On desktop: top-right. On mobile: top-center.
// Dot glow matches the current mode accent color.
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

      {/* sliding track */}
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
        {/* dot with accent glow */}
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

// ─── color palette ───────────────────────────────────────────────────────────
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
// Mounts in text-reveal, fades in (easeOutCubic 0.8s).
// When phase becomes 'transition', fades back out (1 s) while main content fades in.
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
// One-time prompt that fades in after the animation completes.
// Eight curated swatches. On selection, saves to Firestore + localStorage.
function ColorPicker({ onSelect }: { onSelect: (color: string) => void }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 400)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
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

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── initialise from localStorage ──────────────────────────────────────────
  const skipAnimation = (() => {
    try { return localStorage.getItem('hasSeenAnimation') === 'true' } catch { return false }
  })()

  const [phase, setPhase] = useState<Phase>(skipAnimation ? 'main' : 'entry')
  const [mode,  setMode]  = useState<Mode>('pro')
  const accent   = ACCENTS[mode]
  const isMobile = useIsMobile()

  // ── remove loading screen on first hydration ────────────────────────────
  useEffect(() => {
    // Cancel the 200ms timer so the loader doesn't flash in
    if (typeof window !== 'undefined' && (window as Window & { _loaderTimer?: ReturnType<typeof setTimeout> })._loaderTimer) {
      clearTimeout((window as Window & { _loaderTimer?: ReturnType<typeof setTimeout> })._loaderTimer)
    }
    const el = document.getElementById('loading')
    if (!el) return
    el.classList.remove('visible')
    el.style.opacity = '0'
    const t = setTimeout(() => el.remove(), 300)
    return () => clearTimeout(t)
  }, []) // runs once after first render

  // Visitor data from Firestore
  const [visitors,      setVisitors]      = useState<Visitor[]>([])
  const [visitorsReady, setVisitorsReady] = useState(skipAnimation) // skip wait if returning

  // Hero drop color (from localStorage if returning visitor, else default)
  const [heroColor] = useState<string>(() => {
    try { return localStorage.getItem('visitorColor') || DEFAULT_HERO_COLOR } catch { return DEFAULT_HERO_COLOR }
  })

  // Whether this visitor has already chosen a color
  const [hasChosen] = useState<boolean>(() => {
    try { return !!localStorage.getItem('visitorDocId') } catch { return false }
  })

  const [showPicker, setShowPicker] = useState(false)

  // ── fetch visitors on mount (only for animation path) ─────────────────────
  useEffect(() => {
    if (visitorsReady) return // returning visitors skip the wait

    let cancelled = false

    // Give Firestore up to 2.5 s; if it doesn't respond, start without data
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

  // ── show color picker after animation reaches 'main' ──────────────────────
  useEffect(() => {
    if (phase === 'main' && !hasChosen) setShowPicker(true)
  }, [phase, hasChosen])

  // ── phase timers ──────────────────────────────────────────────────────────
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

  // ── color selection ───────────────────────────────────────────────────────
  const handleColorSelect = async (color: string) => {
    setShowPicker(false)
    try {
      const docId = await saveVisitor(color)
      try {
        localStorage.setItem('visitorDocId', docId)
        localStorage.setItem('visitorColor', color)
      } catch { /* storage blocked */ }
    } catch {
      // Firebase unavailable — persist locally so picker doesn't re-appear
      try {
        localStorage.setItem('visitorDocId', 'local_' + Date.now())
        localStorage.setItem('visitorColor', color)
      } catch { /* storage blocked */ }
    }
  }

  return (
    <>
      {/* ── Layer 0: Water background (fixed, behind everything) ──────────────
          Pre-loads invisibly during text-reveal so it's ready for the crossfade.
          Fades in during transition alongside the main content. */}
      {phase !== 'entry' && (
        <WaterBackground
          mode={mode}
          style={{
            opacity:    phase === 'text-reveal' ? 0 : 1,
            transition: 'opacity 1s ease-in-out',
          }}
        />
      )}

      {/* ── Layer 1: Ink entry canvas (z-index 10) ────────────────────────────
          Loading state shows a plain black screen while visitors are fetched.
          Once ready, InkEntry mounts and the animation begins.
          Fades to opacity 0 then unmounts during / after transition. */}
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

      {/* ── Layer 2: ANGLEMYER text overlay (z-index 20) ──────────────────────
          Fades IN over ink canvas during text-reveal, then OUT during transition. */}
      {(phase === 'text-reveal' || phase === 'transition') && (
        <TextReveal phase={phase} />
      )}

      {/* ── Layer 3: Main content (z-index 5) ─────────────────────────────────
          Invisible until transition, then fades in over 1 s. */}
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
        <MainContent mode={mode} accent={accent} active={phase === 'main'} />
      </div>

      {/* ── Layer 4: Color picker (z-index 40) ────────────────────────────────
          One-time prompt for new visitors to leave their color mark. */}
      {showPicker && <ColorPicker onSelect={handleColorSelect} />}

      {/* ── Layer 5: Mode toggle pill (z-index 50) ────────────────────────────
          Desktop: top-right. Mobile: top-center. */}
      {phase === 'main' && (
        <ModeToggle
          mode={mode}
          accent={accent}
          isMobile={isMobile}
          onToggle={() => setMode(m => (m === 'pro' ? 'creative' : 'pro'))}
        />
      )}

      {/* ── Layer 6: Visitor count (z-index 50, top-left) ─────────────────────
          Shows after animation; only rendered when there are prior visitors. */}
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

      {/* ── Layer 6b: Celestial body (z-index 2, top-left corner peek) ─────────
          Sun (pro) or Moon (creative). Only the bottom-right quarter is visible
          due to the negative top/left offset. Crossfades on mode switch.
          Hidden on mobile — no WebGL canvas, no cursor, clean content only. */}
      {phase === 'main' && !isMobile && <CelestialBody mode={mode} />}

      {/* ── Layer 7: Cursor glow (z-index 2, pointer-events none) ─────────────
          Imperative position updates; only background transitions via React.
          Hidden on touch devices (they have no cursor). */}
      {phase === 'main' && !isMobile && <CursorGlow accent={accent} />}

      {/* ── Layer 7b: WebGL water ripple (z-index 2, main only; above bg, below content) ── */}
      {phase === 'main' && <WaterDisplacement />}

      {/* ── Layer 8: Grain overlay (z-index 100, always present) ─────────────
          Static feTurbulence texture. Pointer-events none, opacity 0.035. */}
      <GrainOverlay />

      {/* ── Layer 9: Minimal cursor dot (z-index 9999, desktop only) ───────── */}
      <CursorDot />
    </>
  )
}
