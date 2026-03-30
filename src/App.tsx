import { useState, useEffect } from 'react'
import InkEntry from './InkEntry'
import WaterBackground from './WaterBackground'

// ─── phase machine ────────────────────────────────────────────────────────────
// entry       → ink drop animation plays
// text-reveal → "ANGLEMYER" fades in over the canvas (0.8 s)
// transition  → canvas fades out, water bg + main content fade in (1 s)
// main        → full page, water background persists
type Phase = 'entry' | 'text-reveal' | 'transition' | 'main'
type Mode  = 'pro' | 'creative'

// ─── ANGLEMYER text overlay ───────────────────────────────────────────────────
// Mounts in text-reveal, fades in (easeOutCubic 0.8s).
// When phase becomes 'transition', fades back out (1 s) while main content fades in.
function TextReveal({ phase }: { phase: Phase }) {
  // requestAnimationFrame ensures the starting state (opacity 0, scale 0.95) is
  // committed to the DOM before the transition fires — prevents instant-jump
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const isVisible     = entered && phase === 'text-reveal'
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
          // fade-in: easeOutCubic 0.8 s | fade-out during transition: ease 1 s
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

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // Skip the entry animation for returning visitors
  const [phase, setPhase] = useState<Phase>(() => {
    try {
      return localStorage.getItem('hasSeenAnimation') === 'true' ? 'main' : 'entry'
    } catch {
      return 'entry'
    }
  })
  const [mode, setMode] = useState<Mode>('creative')

  // text-reveal → transition: wait for text to fully appear (0.8 s)
  useEffect(() => {
    if (phase !== 'text-reveal') return
    const t = setTimeout(() => setPhase('transition'), 800)
    return () => clearTimeout(t)
  }, [phase])

  // transition → main: wait for CSS fades to finish (1 s), then persist flag
  useEffect(() => {
    if (phase !== 'transition') return
    const t = setTimeout(() => {
      setPhase('main')
      try { localStorage.setItem('hasSeenAnimation', 'true') } catch { /* SSR */ }
    }, 1000)
    return () => clearTimeout(t)
  }, [phase])

  return (
    <>
      {/* ── Layer 0: Water background (fixed, z-index auto) ─────────────────
          Pre-loads invisibly during text-reveal so it's ready when needed.
          Fades in to opacity:1 during transition alongside the main content. */}
      {phase !== 'entry' && (
        <WaterBackground
          style={{
            opacity:    phase === 'text-reveal' ? 0 : 1,
            transition: 'opacity 1s ease-in-out',
          }}
        />
      )}

      {/* ── Layer 1: Ink entry canvas (z-index 10) ──────────────────────────
          Covers the screen until transition, then fades to opacity 0.
          Unmounts entirely once phase reaches 'main'. */}
      {phase !== 'main' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10,
            opacity:      phase === 'transition' ? 0 : 1,
            transition:   phase === 'transition' ? 'opacity 1s ease-in-out' : undefined,
            pointerEvents: phase === 'transition' ? 'none' : 'auto',
          }}
        >
          <InkEntry onComplete={() => setPhase('text-reveal')} />
        </div>
      )}

      {/* ── Layer 2: ANGLEMYER text overlay (z-index 20) ────────────────────
          Fades IN over ink canvas during text-reveal, then fades OUT during
          transition as main content fades in — smooth crossfade. */}
      {(phase === 'text-reveal' || phase === 'transition') && (
        <TextReveal phase={phase} />
      )}

      {/* ── Layer 3: Main content (z-index 5) ───────────────────────────────
          Invisible until transition phase, then fades in over 1 s.
          WaterBackground acts as the persistent page background beneath it. */}
      <div
        style={{
          position: 'relative', zIndex: 5,
          minHeight: '100vh',
          opacity:      phase === 'main' || phase === 'transition' ? 1 : 0,
          transition:   phase === 'transition' ? 'opacity 1s ease-in-out' : undefined,
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
    </>
  )
}
