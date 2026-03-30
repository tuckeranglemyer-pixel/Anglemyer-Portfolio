import { useState, useEffect } from 'react'
import InkEntry from './InkEntry'
import WaterBackground from './WaterBackground'
import { fetchVisitors, saveVisitor, type Visitor } from './visitors'

// ─── types ────────────────────────────────────────────────────────────────────
// entry       → ink drop animation plays (with visitor drops first)
// text-reveal → "ANGLEMYER" fades in over the canvas (0.8 s)
// transition  → canvas fades out, water bg + main content fade in (1 s)
// main        → full page, water background persists
type Phase = 'entry' | 'text-reveal' | 'transition' | 'main'
type Mode  = 'pro' | 'creative'

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
  const [mode,  setMode]  = useState<Mode>('creative')

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
          position: 'relative', zIndex: 5,
          minHeight: '100vh',
          opacity:       phase === 'main' || phase === 'transition' ? 1 : 0,
          transition:    phase === 'transition' ? 'opacity 1s ease-in-out' : undefined,
          pointerEvents: phase === 'main' ? 'auto' : 'none',
        }}
      >
        <div className="w-full min-h-screen flex items-center justify-center relative">
          <h1
            style={{
              fontFamily: mode === 'pro'
                ? '"Instrument Serif", serif'
                : '"Space Mono", monospace',
            }}
            className={`text-white select-none transition-all duration-500 ${
              mode === 'pro'
                ? 'text-5xl font-normal tracking-normal'
                : 'text-6xl font-bold tracking-widest uppercase'
            }`}
          >
            {mode === 'pro' ? 'Tucker Anglemyer' : 'ANGLEMYER'}
          </h1>

          <button
            onClick={() => setMode(m => (m === 'pro' ? 'creative' : 'pro'))}
            className="absolute bottom-8 right-8 text-white/40 hover:text-white/90 transition-colors duration-300 text-xs tracking-widest uppercase border border-white/20 hover:border-white/60 px-4 py-2 cursor-pointer"
            style={{ fontFamily: '"Space Mono", monospace' }}
          >
            {mode === 'pro' ? 'creative' : 'pro'}
          </button>
        </div>
      </div>

      {/* ── Layer 4: Color picker (z-index 40) ────────────────────────────────
          One-time prompt for new visitors to leave their color mark. */}
      {showPicker && <ColorPicker onSelect={handleColorSelect} />}
    </>
  )
}
