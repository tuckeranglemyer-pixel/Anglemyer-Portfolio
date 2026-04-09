import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

type GemTier = 'slate' | 'obsidian' | 'chrome' | 'void'

const GEM_STYLES: Record<
  GemTier,
  { label: string; text: string; waveRgb: string }
> = {
  slate: { label: 'Slate', text: '#ffffff', waveRgb: '71,85,105' },
  obsidian: { label: 'Obsidian', text: '#ffffff', waveRgb: '24,24,27' },
  chrome: { label: 'Chrome', text: '#e4e4e7', waveRgb: '212,212,216' },
  void: { label: 'Void', text: '#ffffff', waveRgb: '109,40,217' },
}

export type UntrackedTrack = {
  title: string
  artist: string
  gem: GemTier
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
  revealSequence,
}: {
  tracks?: UntrackedTrack[]
  active?: boolean
  /** When parent section enters view — drives waveform bar rise (with stagger). Omit to show bars immediately. */
  revealSequence?: boolean
}) {
  const isMobile = useIsNarrow()
  const waveWrapRef = useRef<HTMLDivElement>(null)
  const [barCount, setBarCount] = useState(80)
  const [barsArmed, setBarsArmed] = useState(() => revealSequence === undefined)

  useLayoutEffect(() => {
    const el = waveWrapRef.current
    if (!el) return
    const measure = () => {
      const w = el.offsetWidth
      const n = Math.max(32, Math.min(160, Math.floor(w / 4)))
      setBarCount(n)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (revealSequence === undefined || !revealSequence) return
    const t = window.setTimeout(() => setBarsArmed(true), 500)
    return () => clearTimeout(t)
  }, [revealSequence])

  const [playerVisible, setPlayerVisible] = useState(false)

  useEffect(() => {
    if (!active) return
    const t = window.setTimeout(() => setPlayerVisible(true), 0)
    return () => clearTimeout(t)
  }, [active])

  const [trackIndex, setTrackIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [trackSwap, setTrackSwap] = useState<'idle' | 'out' | 'in'>('idle')
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number>(0)

  const track = tracks[trackIndex]!

  const barHeights = useMemo(() => {
    const rnd = mulberry32(hashSeed(track.title))
    return Array.from({ length: barCount }, () => 0.15 + rnd() * 0.85)
  }, [track.title, barCount])

  const [waveTick, setWaveTick] = useState(0)
  const gem = GEM_STYLES[track.gem]

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
      return
    }
    let id: number
    const tick = () => {
      setWaveTick(n => n + 1)
      id = requestAnimationFrame(tick)
      rafRef.current = id
    }
    id = requestAnimationFrame(tick)
    rafRef.current = id
    return () => {
      cancelAnimationFrame(id)
    }
  }, [playing])

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
    <div style={{ width: '100%' }}>
      <audio ref={audioRef} preload="none" />

      <div
        style={{
          opacity: playerVisible ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            marginBottom: isMobile ? '32px' : '40px',
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
              textShadow: '0 1px 12px rgba(0,0,0,0.35)',
            }}
          >
            {track.title}
          </h3>
          <p
            style={{
              fontFamily: '"Space Mono", monospace',
              fontSize: 12,
              color: 'rgba(255,255,255,0.45)',
              marginTop: 8,
              marginBottom: 12,
            }}
          >
            {track.artist}
          </p>
          <span
            style={{
              display: 'inline-block',
              fontFamily: '"Space Mono", monospace',
              fontSize: 9,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: gem.text,
              border: '1px solid rgba(255,255,255,0.12)',
              padding: '6px 12px',
            }}
          >
            {gem.label}
          </span>
        </div>

        <div
          ref={waveWrapRef}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'stretch',
            width: '100%',
            height: 50,
            marginBottom: isMobile ? '24px' : '28px',
            gap: 2,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              height: 1,
              transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.06)',
              pointerEvents: 'none',
            }}
          />
          {barHeights.map((h, i) => {
            const t = waveTick * 0.042
            const mult = playing ? 1 + Math.sin(t + i * 0.3) * 0.3 : 1
            const pct = Math.round(h * mult * 100)
            const barH = barsArmed ? `${pct}%` : '0%'
            return (
              <div
                key={`${track.title}-${i}`}
                style={{
                  flex: '1 1 0',
                  minWidth: 0,
                  height: barH,
                  minHeight: barsArmed ? 6 : 0,
                  maxHeight: 50,
                  borderRadius: 0,
                  background: `rgba(${gem.waveRgb}, 0.65)`,
                  transition: playing
                    ? 'none'
                    : `height 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${i * 4}ms, min-height 0.45s ease ${i * 4}ms`,
                  alignSelf: 'flex-end',
                }}
              />
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: isMobile ? 32 : 40 }}>
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
                    'conic-gradient(from 0deg, rgba(255,255,255,0.22), transparent 45%, rgba(255,255,255,0.08) 70%, rgba(255,255,255,0.18))',
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
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
                boxShadow: '0 0 20px rgba(255,255,255,0.12), 0 0 2px rgba(255,255,255,0.4)',
              }}
            >
              {playing ? (
                <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span
                    className="untracked-pause-bar"
                    style={{
                      width: 3,
                      height: 12,
                      background: 'rgba(255,255,255,0.85)',
                      borderRadius: 0.5,
                      filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.5))',
                      transition: 'background 0.25s ease',
                    }}
                  />
                  <span
                    className="untracked-pause-bar"
                    style={{
                      width: 3,
                      height: 12,
                      background: 'rgba(255,255,255,0.85)',
                      borderRadius: 0.5,
                      filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.5))',
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
                    borderColor: 'transparent transparent transparent rgba(255,255,255,0.88)',
                    marginLeft: 3,
                    filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.45))',
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
            width: '100%',
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
                  borderRadius: 0,
                  background: on ? `rgba(${g.waveRgb}, 0.9)` : 'rgba(255,255,255,0.12)',
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
          border-color: rgba(255,255,255,0.55) !important;
          box-shadow: 0 0 28px rgba(255,255,255,0.2), 0 0 4px rgba(255,255,255,0.6) !important;
        }
        .untracked-play-triangle {
          border-color: transparent transparent transparent rgba(255,255,255,0.88);
        }
        .untracked-play-btn:hover .untracked-play-triangle {
          border-color: transparent transparent transparent rgba(255,255,255,1);
        }
        .untracked-play-btn:hover .untracked-pause-bar {
          background: rgba(255,255,255,1) !important;
        }
      `}</style>
    </div>
  )
}
