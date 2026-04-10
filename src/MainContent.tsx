import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type RefObject,
} from 'react'
import PretextHero from './PretextHero'
import UntrackedPlayer from './UntrackedPlayer'
import { waterSim } from './WaterSimSingleton'

export type Mode = 'pro' | 'creative'

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

type SurfaceZone = 'left' | 'right' | 'bottom' | 'center'

function computeSurfaceZone(clientX: number, clientY: number, w: number, h: number): SurfaceZone {
  if (clientY > h * 0.8) return 'bottom'
  if (clientX < w * 0.33) return 'left'
  if (clientX > w * 0.67) return 'right'
  return 'center'
}

function useDebouncedSurfaceZone(active: boolean) {
  const posRef = useRef({ x: 0, y: 0 })
  const [activeZone, setActiveZone] = useState<null | 'left' | 'right' | 'bottom'>(null)
  const activeZoneRef = useRef<null | 'left' | 'right' | 'bottom'>(null)
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRawZoneRef = useRef<SurfaceZone | null>(null)

  useEffect(() => {
    activeZoneRef.current = activeZone
  }, [activeZone])

  useEffect(() => {
    if (!active) {
      setActiveZone(null)
      activeZoneRef.current = null
      lastRawZoneRef.current = null
      if (enterTimerRef.current) {
        clearTimeout(enterTimerRef.current)
        enterTimerRef.current = null
      }
      return
    }

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY }
      const w = window.innerWidth
      const h = window.innerHeight
      const z = computeSurfaceZone(e.clientX, e.clientY, w, h)

      const prev = lastRawZoneRef.current
      lastRawZoneRef.current = z
      if (z === prev) return

      if (enterTimerRef.current) {
        clearTimeout(enterTimerRef.current)
        enterTimerRef.current = null
      }

      if (z === 'center') {
        if (activeZoneRef.current !== null) {
          activeZoneRef.current = null
          setActiveZone(null)
        }
        return
      }

      if (activeZoneRef.current === z) return

      if (activeZoneRef.current !== null) {
        activeZoneRef.current = null
        setActiveZone(null)
      }

      enterTimerRef.current = setTimeout(() => {
        setActiveZone(z)
        activeZoneRef.current = z
        waterSim.addRipple(posRef.current.x, posRef.current.y, 3.0)
        enterTimerRef.current = null
      }, 400)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    }
  }, [active])

  return activeZone
}

function ZoneRevealLayer({
  revealed,
  delayMs,
  children,
}: {
  revealed: boolean
  delayMs: number
  children: React.ReactNode
}) {
  const wasRevealed = useRef(false)
  useEffect(() => {
    if (revealed) wasRevealed.current = true
  }, [revealed])

  const hiddenY = wasRevealed.current && !revealed ? 30 : 60

  return (
    <div
      style={{
        opacity: revealed ? 1 : 0,
        transform: revealed ? 'translateY(0)' : `translateY(${hiddenY}px)`,
        transition: revealed
          ? `opacity 500ms cubic-bezier(0.33, 1, 0.68, 1) ${delayMs}ms, transform 500ms cubic-bezier(0.33, 1, 0.68, 1) ${delayMs}ms`
          : 'opacity 400ms ease-in, transform 400ms ease-in',
        pointerEvents: revealed ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  )
}

const SUBTITLE =
  'Providence College · Accounting & Finance · Incoming PwC · Founder, Untracked'

const UNTRACKED_SITE = 'https://untrackedmusic.com'

const SOCIAL = [
  { label: 'GitHub', href: 'https://github.com/tuckeranglemyer-pixel' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tucker-anglemyer-42a13a32b' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@untrackedmusic' },
] as const

const WAR_BADGES = ['CrewAI', 'ChromaDB', 'DGX Spark'] as const

const edgeLabel: CSSProperties = {
  position: 'fixed',
  zIndex: 8,
  fontFamily: '"Space Mono", monospace',
  fontSize: '9px',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.92)',
  opacity: 0.1,
  pointerEvents: 'none',
  userSelect: 'none',
}

const linkMuted: CSSProperties = {
  fontFamily: '"Space Mono", monospace',
  fontSize: '12px',
  color: 'rgba(255,255,255,0.35)',
  textDecoration: 'none',
  transition: 'opacity 0.2s ease',
}

export type ContentPhase = 'entry' | 'main'

interface MainContentProps {
  phase: ContentPhase
  mode: Mode
  active?: boolean
  accent: string
  onToggleMode: () => void
  identityCycleHidesContent?: boolean
  heroContainerRef?: RefObject<HTMLDivElement | null>
  hideHeroDuringIdentityCycle?: boolean
}

export default function MainContent({
  phase,
  mode,
  active = false,
  accent,
  onToggleMode,
  identityCycleHidesContent = false,
  heroContainerRef,
  hideHeroDuringIdentityCycle = false,
}: MainContentProps) {
  const isMobile = useIsMobile()
  const chromeVisible = phase === 'main'

  const mainOpacity =
    !chromeVisible ? 0 : identityCycleHidesContent ? 0 : 1
  const mainPointer =
    chromeVisible && !identityCycleHidesContent ? 'auto' : 'none'

  const surfaceActive = !!(active && chromeVisible && !identityCycleHidesContent)
  const activeZone = useDebouncedSurfaceZone(surfaceActive)

  const leftOn = activeZone === 'left'
  const rightOn = activeZone === 'right'
  const bottomOn = activeZone === 'bottom'

  const accentVar: CSSProperties & { '--accent-color': string } = {
    '--accent-color': accent,
  }

  return (
    <div
      style={{
        opacity: mainOpacity,
        pointerEvents: mainPointer,
        transition: 'opacity 0.9s ease',
      }}
    >
      <div
        style={{
          opacity: chromeVisible ? 1 : 0,
          pointerEvents: chromeVisible ? 'auto' : 'none',
          transition: 'opacity 0s',
        }}
      >
        <ModeToggle mode={mode} accent={accent} onToggle={onToggleMode} isMobile={isMobile} />
      </div>

      {/* Fixed full-viewport surface — no scroll */}
      <div
        style={{
          ...accentVar,
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          boxSizing: 'border-box',
          zIndex: 5,
          pointerEvents: mainPointer,
        }}
      >
        {/* Zone edge breadcrumbs */}
        <span
          aria-hidden
          style={{
            ...edgeLabel,
            left: 14,
            top: '50%',
            transform: 'translateY(-50%) rotate(-90deg)',
            transformOrigin: 'center center',
          }}
        >
          UNTRACKED
        </span>
        <span
          aria-hidden
          style={{
            ...edgeLabel,
            right: 14,
            top: '50%',
            transform: 'translateY(-50%) rotate(90deg)',
            transformOrigin: 'center center',
          }}
        >
          WAR ROOM
        </span>
        <span
          aria-hidden
          style={{
            ...edgeLabel,
            left: '50%',
            bottom: 14,
            transform: 'translateX(-50%)',
            letterSpacing: '0.25em',
          }}
        >
          CONTACT
        </span>

        {/* TOP CENTER — DAY: Instrument Serif hero + subtitle; NIGHT: subtitle only (3D name in canvas) */}
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            top: 0,
            paddingTop: mode === 'creative' ? 'clamp(120px, 20vh, 220px)' : 'max(88px, 10vh)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 6,
          }}
        >
          {mode === 'pro' && (
            <div
              style={{
                width: 'min(92vw, 900px)',
                pointerEvents: 'auto',
              }}
            >
              <div style={{ width: '100%', marginBottom: 8 }}>
                <PretextHero
                  mode={mode}
                  active={!!active && chromeVisible}
                  isMobile={isMobile}
                  heroLayout="main"
                  heroMeasureRef={heroContainerRef}
                  hiddenDuringIdentityCycle={hideHeroDuringIdentityCycle}
                  hideFlatCreativeHero={false}
                />
              </div>
            </div>
          )}

          <p
            className="main-subtitle"
            style={{
              margin: mode === 'pro' ? '8px 0 0' : '0',
              maxWidth: 'min(92vw, 560px)',
              padding: '0 16px',
              fontFamily: '"Space Mono", monospace',
              fontSize: '11px',
              lineHeight: 1.5,
              letterSpacing: '0.04em',
              opacity: 0.35,
              color: 'rgba(255,255,255,0.9)',
            }}
          >
            {SUBTITLE}
          </p>
        </div>

        {/* LEFT ZONE 0–33% */}
        <div
          role="region"
          aria-label="Untracked"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '33%',
            height: '100%',
            zIndex: 7,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px 20px',
            boxSizing: 'border-box',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ width: '100%', maxWidth: 360 }}>
            <ZoneRevealLayer revealed={leftOn} delayMs={0}>
              <div
                aria-hidden
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: 'clamp(3rem, 8vw, 6rem)',
                  letterSpacing: '-0.02em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.92)',
                  lineHeight: 0.9,
                  textAlign: 'center',
                  marginBottom: 16,
                }}
              >
                UNTRACKED
              </div>
            </ZoneRevealLayer>
            <ZoneRevealLayer revealed={leftOn} delayMs={150}>
              <p
                style={{
                  fontFamily: '"Instrument Serif", Georgia, serif',
                  fontSize: '16px',
                  lineHeight: 1.5,
                  margin: '0 0 20px',
                  opacity: 0.85,
                  color: 'rgba(255,255,255,0.92)',
                  textAlign: 'center',
                }}
              >
                The infrastructure underground music deserves.
              </p>
            </ZoneRevealLayer>
            <ZoneRevealLayer revealed={leftOn} delayMs={300}>
              <div style={{ width: '100%', marginBottom: 16 }}>
                <UntrackedPlayer
                  active={active && chromeVisible}
                  revealSequence={leftOn}
                />
              </div>
            </ZoneRevealLayer>
            <ZoneRevealLayer revealed={leftOn} delayMs={450}>
              <a
                href={UNTRACKED_SITE}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontFamily: '"Space Mono", monospace',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.35)',
                  textDecoration: 'none',
                }}
              >
                untrackedmusic.com →
              </a>
            </ZoneRevealLayer>
          </div>
        </div>

        {/* RIGHT ZONE 67–100% */}
        <div
          role="region"
          aria-label="War Room"
          style={{
            position: 'fixed',
            right: 0,
            top: 0,
            width: '33%',
            height: '100%',
            zIndex: 7,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px 20px',
            boxSizing: 'border-box',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ width: '100%', maxWidth: 380 }}>
            <ZoneRevealLayer revealed={rightOn} delayMs={0}>
              <div
                aria-hidden
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: 'clamp(3rem, 8vw, 6rem)',
                  letterSpacing: '-0.02em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.92)',
                  lineHeight: 0.9,
                  textAlign: 'center',
                  marginBottom: 16,
                }}
              >
                WAR ROOM
              </div>
            </ZoneRevealLayer>
            <ZoneRevealLayer revealed={rightOn} delayMs={150}>
              <p
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  margin: '0 0 12px',
                  opacity: 0.65,
                  color: 'rgba(255,255,255,0.9)',
                  textAlign: 'center',
                }}
              >
                2 people · 24 hours · 1st place
              </p>
            </ZoneRevealLayer>
            <ZoneRevealLayer revealed={rightOn} delayMs={300}>
              <p
                style={{
                  fontFamily: '"Instrument Serif", Georgia, serif',
                  fontSize: '16px',
                  lineHeight: 1.55,
                  margin: '0 0 20px',
                  opacity: 0.85,
                  color: 'rgba(255,255,255,0.92)',
                  textAlign: 'center',
                }}
              >
                Three LLMs arguing about your product until they find the truth.
              </p>
            </ZoneRevealLayer>
            <ZoneRevealLayer revealed={rightOn} delayMs={450}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  justifyContent: 'center',
                }}
              >
                {WAR_BADGES.map((name) => (
                  <span
                    key={name}
                    style={{
                      fontFamily: '"Space Mono", monospace',
                      fontSize: '9px',
                      color: 'rgba(255,255,255,0.55)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '4px',
                      padding: '4px 12px',
                    }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </ZoneRevealLayer>
          </div>
        </div>

        {/* BOTTOM ZONE — bottom 20% */}
        <div
          role="contentinfo"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            height: '20%',
            minHeight: 120,
            zIndex: 7,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 16px',
            boxSizing: 'border-box',
            pointerEvents: 'auto',
          }}
        >
          <ZoneRevealLayer revealed={bottomOn} delayMs={0}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem 0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              {SOCIAL.map((s, i) => (
                <span key={s.href} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
                  {i > 0 ? (
                    <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '12px', userSelect: 'none' }}>
                      ·
                    </span>
                  ) : null}
                  <a href={s.href} target="_blank" rel="noopener noreferrer" style={linkMuted}>
                    {s.label}
                  </a>
                </span>
              ))}
            </div>
          </ZoneRevealLayer>
          <ZoneRevealLayer revealed={bottomOn} delayMs={150}>
            <a href="mailto:tucker@untrackedmusic.com" style={{ ...linkMuted, display: 'inline-block' }}>
              tucker@untrackedmusic.com
            </a>
          </ZoneRevealLayer>
        </div>
      </div>
    </div>
  )
}

function ModeToggle({
  mode,
  accent,
  onToggle,
  isMobile,
}: {
  mode: Mode
  accent: string
  onToggle: () => void
  isMobile: boolean
}) {
  const isNight = mode === 'creative'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${isNight ? 'day' : 'night'} mode`}
      style={{
        position: 'fixed',
        top: '1.5rem',
        zIndex: 120,
        ...(isMobile
          ? { left: '50%', right: 'auto', transform: 'translateX(-50%)' }
          : { right: '1.5rem', left: 'auto', transform: 'none' }),
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '8px 16px',
        borderRadius: '999px',
        border: '1px solid rgba(255,255,255,0.22)',
        background: 'rgba(0,0,0,0.28)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        cursor: 'pointer',
        fontFamily: '"Space Mono", monospace',
        fontSize: '11px',
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)',
        outline: 'none',
        WebkitFontSmoothing: 'antialiased',
        userSelect: 'none',
        pointerEvents: 'auto',
        transition: 'border-color 0.6s ease, background 0.6s ease',
      }}
    >
      <span style={{ transition: 'opacity 0.6s ease', opacity: isNight ? 0.35 : 1 }}>
        DAY
      </span>

      <div
        style={{
          position: 'relative',
          width: '22px',
          height: '10px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.22)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '1px',
            left: isNight ? '11px' : '1px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.92)',
            boxShadow: `0 0 6px 2px ${accent}55`,
            transition: 'left 0.6s ease, box-shadow 0.6s ease',
          }}
        />
      </div>

      <span style={{ transition: 'opacity 0.6s ease', opacity: isNight ? 1 : 0.35 }}>
        NIGHT
      </span>
    </button>
  )
}
