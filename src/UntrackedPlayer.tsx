import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type GemTier = 'slate' | 'obsidian' | 'chrome' | 'void'

const GEM_STYLES: Record<
  GemTier,
  { bg: string; label: string; text: string; waveRgb: string }
> = {
  slate: { bg: '#475569', label: 'Slate', text: '#ffffff', waveRgb: '71,85,105' },
  obsidian: { bg: '#18181b', label: 'Obsidian', text: '#ffffff', waveRgb: '24,24,27' },
  chrome: { bg: '#d4d4d8', label: 'Chrome', text: '#000000', waveRgb: '212,212,216' },
  void: { bg: '#6d28d9', label: 'Void', text: '#ffffff', waveRgb: '109,40,217' },
}

export type UntrackedTrack = {
  title: string
  artist: string
  gem: GemTier
  /** When you add files under public/, set e.g. `/audio/track.mp3` */
  audioSrc?: string
}

const DEFAULT_TRACKS: UntrackedTrack[] = [
  {
    title: 'Basement Relay',
    artist: 'Untracked Editorial',
    gem: 'slate',
  },
  {
    title: 'Vector Drift',
    artist: 'Untracked Editorial',
    gem: 'obsidian',
  },
  {
    title: 'Chrome Line',
    artist: 'Untracked Editorial',
    gem: 'chrome',
  },
  {
    title: 'Night Pool',
    artist: 'Untracked Editorial',
    gem: 'void',
  },
]

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h) + 1
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function useIsNarrow(breakpoint = 768) {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  )
  useEffect(() => {
    const u = () => setNarrow(window.innerWidth < breakpoint)
    window.addEventListener('resize', u, { passive: true })
    return () => window.removeEventListener('resize', u)
  }, [breakpoint])
  return narrow
}

export default function UntrackedPlayer({
  tracks = DEFAULT_TRACKS,
  active = true,
}: {
  tracks?: UntrackedTrack[]
  active?: boolean
}) {
  const isMobile = useIsNarrow()
  const barCount = isMobile ? 60 : 80

  const sectionRef = useRef<HTMLElement>(null)
  const [sectionInView, setSectionInView] = useState(false)
  const [headerVisible, setHeaderVisible] = useState(false)
  const [playerVisible, setPlayerVisible] = useState(false)
  const [brandMicroGlitch, setBrandMicroGlitch] = useState(false)
  const brandGlitchChainRef = useRef(0)

  useEffect(() => {
    if (!active) return
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSectionInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [active])

  useEffect(() => {
    if (!sectionInView) return
    const t1 = window.setTimeout(() => setHeaderVisible(true), 0)
    const t2 = window.setTimeout(() => setPlayerVisible(true), 200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [sectionInView])

  useEffect(() => {
    if (!headerVisible) return
    let cancelled = false
    const chain = () => {
      const gap = 5000 + Math.random() * 3000
      brandGlitchChainRef.current = window.setTimeout(() => {
        if (cancelled) return
        setBrandMicroGlitch(true)
        window.setTimeout(() => {
          if (!cancelled) setBrandMicroGlitch(false)
        }, 200)
        chain()
      }, gap)
    }
    const boot = window.setTimeout(() => {
      if (!cancelled) chain()
    }, 1000)
    return () => {
      cancelled = true
      clearTimeout(boot)
      clearTimeout(brandGlitchChainRef.current)
    }
  }, [headerVisible])

  const [trackIndex, setTrackIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [trackSwap, setTrackSwap] = useState<'idle' | 'out' | 'in'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number>(0)
  const timeRef = useRef(0)

  const track = tracks[trackIndex]!

  const barHeights = useMemo(() => {
    const rnd = mulberry32(hashSeed(track.title))
    return Array.from({ length: barCount }, () => 0.15 + rnd() * 0.85)
  }, [track.title, barCount])

  const [, setWaveTick] = useState(0)
  const gem = GEM_STYLES[track.gem]

  const tickOsc = useCallback(() => {
    timeRef.current += 0.042
    setWaveTick(n => n + 1)
    rafRef.current = requestAnimationFrame(tickOsc)
  }, [])

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      return
    }
    rafRef.current = requestAnimationFrame(tickOsc)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, tickOsc])

  const playPause = useCallback(() => {
    if (!track.audioSrc) {
      setPlaying(p => !p)
      return
    }
    const a = audioRef.current
    if (!a) return
    a.loop = true
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      a.src = track.audioSrc
      a.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false))
    }
  }, [playing, track.audioSrc])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    if (!track.audioSrc) {
      a.pause()
      a.removeAttribute('src')
      return
    }
    a.loop = true
    if (playing) {
      a.src = track.audioSrc
      a.play().catch(() => setPlaying(false))
    } else {
      a.pause()
    }
  }, [trackIndex, track.audioSrc, playing])

  const selectTrack = (i: number) => {
    if (i === trackIndex) return
    setTrackSwap('out')
    window.setTimeout(() => {
      setTrackIndex(i)
      setTrackSwap('in')
      window.setTimeout(() => setTrackSwap('idle'), 40)
    }, 300)
  }

  const titleMotion =
    trackSwap === 'out'
      ? { opacity: 0, transform: 'translateY(-8px)' }
      : trackSwap === 'in'
        ? { opacity: 0, transform: 'translateY(8px)' }
        : { opacity: 1, transform: 'translateY(0)' }

  const titleFontSize = isMobile ? 32 : 48

  return (
    <section
      ref={sectionRef}
      style={{
        width: '100%',
        minHeight: '60vh',
        boxSizing: 'border-box',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: isMobile ? '64px 24px 80px' : '96px 80px',
        marginBottom: isMobile ? '64px' : '96px',
      }}
    >
      <audio ref={audioRef} preload="none" />

      <header
        style={{
          opacity: headerVisible ? 1 : 0,
          transform: headerVisible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
          marginBottom: isMobile ? '48px' : '64px',
          maxWidth: '800px',
        }}
      >
        <p
          style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            margin: '0 0 12px',
          }}
        >
          <span
            className={[
              'untracked-brand-label',
              headerVisible ? 'untracked-brand-label--reveal' : '',
              brandMicroGlitch ? 'untracked-brand-label--micro' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="untracked-brand-label__ghost untracked-brand-label__ghost--c" aria-hidden>
              UNTRACKED
            </span>
            <span className="untracked-brand-label__ghost untracked-brand-label__ghost--m" aria-hidden>
              UNTRACKED
            </span>
            <span className="untracked-brand-label__base">UNTRACKED</span>
          </span>
        </p>
        <p
          style={{
            fontFamily: '"Instrument Serif", Georgia, serif',
            fontSize: 20,
            fontStyle: 'italic',
            lineHeight: 1.35,
            color: '#ffffff',
            opacity: 0.7,
            maxWidth: 400,
            margin: 0,
          }}
        >
          The infrastructure underground music deserves.
        </p>
        <a
          href="https://untrackedmusic.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: 20,
            fontFamily: '"Space Mono", monospace',
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.28)',
            textDecoration: 'none',
            transition: 'color 0.25s ease',
          }}
        >
          untrackedmusic.com →
        </a>
      </header>

      <div
        style={{
          opacity: playerVisible ? 1 : 0,
          transition: 'opacity 0.6s ease',
          maxWidth: 800,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: isMobile ? '40px' : '48px',
            transition: 'opacity 300ms ease, transform 300ms ease',
            ...titleMotion,
          }}
        >
          <h3
            style={{
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontSize: titleFontSize,
              fontWeight: 400,
              color: '#ffffff',
              opacity: 0.92,
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            {track.title}
          </h3>
          <p
            style={{
              fontFamily: '"Space Mono", monospace',
              fontSize: 12,
              color: '#ffffff',
              opacity: 0.38,
              marginTop: 8,
              marginBottom: 16,
            }}
          >
            {track.artist}
          </p>
          <span
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: 100,
              fontFamily: '"Space Mono", monospace',
              fontSize: 9,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              background: gem.bg,
              color: gem.text,
            }}
          >
            {gem.label}
          </span>
        </div>

        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-end',
            height: isMobile ? 72 : 88,
            marginBottom: isMobile ? '28px' : '32px',
            paddingLeft: 8,
            paddingRight: 8,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 'min(100%, 360px)',
              height: 1,
              transform: 'translate(-50%, -50%)',
              background: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 1.5,
              height: '100%',
            }}
          >
            {barHeights.map((h, i) => {
              const t = timeRef.current
              const mult = playing ? 1 + Math.sin(t + i * 0.3) * 0.3 : 1
              const animH = `${Math.round(h * mult * 100)}%`
              return (
                <div
                  key={`${track.title}-${i}`}
                  style={{
                    width: 2,
                    height: sectionInView ? animH : 0,
                    maxHeight: '100%',
                    borderRadius: 1,
                    background: `rgba(${gem.waveRgb}, 0.6)`,
                    transition: playing
                      ? 'none'
                      : `height 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${i * 5}ms, opacity 0.45s ease ${i * 5}ms`,
                    opacity: sectionInView ? 1 : 0,
                    alignSelf: 'flex-end',
                  }}
                />
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: isMobile ? 40 : 48 }}>
          <div
            style={{
              position: 'relative',
              width: 52,
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {playing ? (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background:
                    'conic-gradient(from 0deg, rgba(255,255,255,0.35), transparent 45%, rgba(255,255,255,0.12) 70%, rgba(255,255,255,0.28))',
                  animation: 'untracked-spin 6s linear infinite',
                  pointerEvents: 'none',
                }}
              />
            ) : null}
            <button
              type="button"
              onClick={playPause}
              aria-label={playing ? 'Pause' : 'Play'}
              className="untracked-play-btn"
              style={{
                position: 'relative',
                zIndex: 1,
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.55)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color 0.25s ease',
              }}
            >
              {playing ? (
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span
                    className="untracked-pause-bar"
                    style={{
                      width: 3,
                      height: 12,
                      background: 'rgba(255,255,255,0.6)',
                      borderRadius: 0.5,
                      transition: 'background 0.25s ease',
                    }}
                  />
                  <span
                    className="untracked-pause-bar"
                    style={{
                      width: 3,
                      height: 12,
                      background: 'rgba(255,255,255,0.6)',
                      borderRadius: 0.5,
                      transition: 'background 0.25s ease',
                    }}
                  />
                </span>
              ) : (
                <span
                  style={{
                    width: 0,
                    height: 0,
                    borderStyle: 'solid',
                    borderWidth: '7px 0 7px 12px',
                    borderColor: 'transparent transparent transparent rgba(255,255,255,0.6)',
                    marginLeft: 3,
                    transition: 'border-color 0.25s ease',
                  }}
                  className="untracked-play-triangle"
                />
              )}
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'nowrap',
            justifyContent: isMobile ? 'flex-start' : 'center',
            gap: 16,
            maxWidth: isMobile ? '100%' : 400,
            margin: '0 auto',
            overflowX: isMobile ? 'auto' : 'visible',
            paddingBottom: isMobile ? 4 : 0,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {tracks.map((tr, i) => {
            const g = GEM_STYLES[tr.gem]
            const on = i === trackIndex
            return (
              <button
                key={tr.title}
                type="button"
                onClick={() => selectTrack(i)}
                aria-label={`Play ${tr.title}`}
                aria-current={on ? 'true' : undefined}
                style={{
                  width: on ? 80 : 60,
                  height: 4,
                  padding: 0,
                  border: 'none',
                  borderRadius: 1,
                  background: on ? g.bg : 'rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  transition: 'width 0.3s ease, background 0.3s ease',
                  flexShrink: 0,
                }}
              />
            )
          })}
        </div>
      </div>

      <style>{`
        @keyframes untracked-spin {
          to { transform: rotate(360deg); }
        }
        .untracked-play-btn:hover {
          border-color: rgba(255,255,255,0.4) !important;
        }
        .untracked-play-triangle {
          border-color: transparent transparent transparent rgba(255,255,255,0.6);
        }
        .untracked-play-btn:hover .untracked-play-triangle {
          border-color: transparent transparent transparent rgba(255,255,255,0.9);
        }
        .untracked-play-btn:hover .untracked-pause-bar {
          background: rgba(255,255,255,0.9) !important;
        }
      `}</style>
    </section>
  )
}
