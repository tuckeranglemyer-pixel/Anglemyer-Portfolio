import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react'
import PretextHero from './PretextHero'
import UntrackedPlayer from './UntrackedPlayer'

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

function ScrollReveal({
  children,
  delay = 0,
  active = true,
}: {
  children: ReactNode
  delay?: number
  active?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true)
          io.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [active])

  return (
    <div
      ref={ref}
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 600ms ease-out ${delay}ms, transform 600ms ease-out ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

function useSectionReveal(active: boolean) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [active])

  return { ref, inView }
}

function RevealLine({
  show,
  delayMs,
  children,
}: {
  show: boolean
  delayMs: number
  children: ReactNode
}) {
  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 600ms ease-out ${delayMs}ms, transform 600ms ease-out ${delayMs}ms`,
      }}
    >
      {children}
    </div>
  )
}

const fullBleedWrap: CSSProperties = {
  width: '100vw',
  position: 'relative',
  left: '50%',
  transform: 'translateX(-50%)',
  boxSizing: 'border-box',
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

const watermarkScene: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 0,
  width: '100%',
  padding: '0 12px',
  boxSizing: 'border-box',
  textAlign: 'center',
  fontFamily: '"Space Mono", monospace',
  fontSize: 'clamp(5rem, 15vw, 12rem)',
  letterSpacing: '-0.02em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.08)',
  lineHeight: 0.9,
  pointerEvents: 'none',
}

const watermarkFooter: CSSProperties = {
  position: 'relative',
  width: '100%',
  padding: '0 12px',
  boxSizing: 'border-box',
  textAlign: 'center',
  fontFamily: '"Space Mono", monospace',
  fontSize: 'clamp(5rem, 15vw, 12rem)',
  letterSpacing: '-0.02em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.06)',
  lineHeight: 0.9,
  pointerEvents: 'none',
  marginBottom: 'clamp(24px, 4vw, 40px)',
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

  const hPad = isMobile ? '16px' : '48px'
  const vPad = isMobile ? '24px' : '80px'

  const accentVar: CSSProperties & { '--accent-color': string } = {
    '--accent-color': accent,
  }

  const mainOpacity =
    !chromeVisible ? 0 : identityCycleHidesContent ? 0 : 1
  const mainPointer =
    chromeVisible && !identityCycleHidesContent ? 'auto' : 'none'

  const {
    ref: untrackedSectionRef,
    inView: untrackedVisible,
  } = useSectionReveal(!!active)
  const {
    ref: warRoomSectionRef,
    inView: warRoomVisible,
  } = useSectionReveal(!!active)
  const {
    ref: footerSectionRef,
    inView: footerVisible,
  } = useSectionReveal(!!active)

  const linkMuted: CSSProperties = {
    fontFamily: '"Space Mono", monospace',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.35)',
    textDecoration: 'none',
    transition: 'opacity 0.2s ease',
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

      <div
        style={{
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          paddingTop: vPad,
          paddingBottom: isMobile ? '140px' : '96px',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ ...accentVar }}>
          <ScrollReveal active={active}>
            <div
              className="pretext-hero-strip"
              style={{
                paddingLeft: hPad,
                position: 'relative',
              }}
            >
              <PretextHero
                mode={mode}
                active={active}
                isMobile={isMobile}
                heroLayout="main"
                heroMeasureRef={heroContainerRef}
                hiddenDuringIdentityCycle={hideHeroDuringIdentityCycle}
                hideFlatCreativeHero={mode === 'creative'}
              />
            </div>
          </ScrollReveal>

          <div
            style={{
              maxWidth: '600px',
              width: '100%',
              marginLeft: hPad,
              marginRight: 'auto',
              paddingLeft: 0,
              paddingRight: hPad,
              boxSizing: 'border-box',
            }}
          >
            <ScrollReveal active={active}>
              <header style={{ marginBottom: 'clamp(40px, 8vw, 64px)' }}>
                <p
                  className="main-subtitle"
                  style={{
                    marginTop: 0,
                    fontFamily: '"Space Mono", monospace',
                    fontSize: '24px',
                    lineHeight: 1.5,
                    letterSpacing: '0.04em',
                    opacity: 0.3,
                    color: 'rgba(255,255,255,0.55)',
                    maxWidth: '520px',
                    transition: 'opacity 0.6s ease',
                  }}
                >
                  {SUBTITLE}
                </p>
              </header>
            </ScrollReveal>
          </div>

          {/* Untracked — scene layout */}
          <div
            ref={untrackedSectionRef}
            role="region"
            aria-label="Untracked"
            style={{
              ...fullBleedWrap,
              position: 'relative',
              marginTop: 'clamp(32px, 6vw, 56px)',
              marginBottom: 0,
              minHeight: 'min(70vh, 720px)',
              paddingTop: 'clamp(48px, 8vw, 96px)',
              paddingBottom: 'clamp(48px, 8vw, 96px)',
            }}
          >
            <RevealLine show={untrackedVisible} delayMs={0}>
              <div aria-hidden style={watermarkScene}>
                UNTRACKED
              </div>
            </RevealLine>

            <div
              style={{
                position: 'relative',
                zIndex: 1,
                paddingLeft: hPad,
                paddingRight: hPad,
              }}
            >
              <RevealLine show={untrackedVisible} delayMs={200}>
                <h2
                  style={{
                    fontFamily: '"Instrument Serif", Georgia, serif',
                    fontSize: '28px',
                    fontStyle: 'italic',
                    fontWeight: 400,
                    margin: '0 0 12px',
                    opacity: 0.9,
                    color: '#fff',
                  }}
                >
                  Untracked
                </h2>
              </RevealLine>
              <RevealLine show={untrackedVisible} delayMs={350}>
                <p
                  style={{
                    fontFamily: '"Instrument Serif", Georgia, serif',
                    fontSize: '16px',
                    lineHeight: 1.5,
                    margin: '0 0 32px',
                    opacity: 0.5,
                    color: 'rgba(255,255,255,0.92)',
                    maxWidth: '560px',
                  }}
                >
                  The infrastructure underground music deserves.
                </p>
              </RevealLine>
            </div>

            <RevealLine show={untrackedVisible} delayMs={500}>
              <div style={{ width: '100%', marginTop: 0, marginBottom: '24px' }}>
                <UntrackedPlayer active={active} revealSequence={untrackedVisible} />
              </div>
            </RevealLine>

            <div
              style={{
                position: 'relative',
                zIndex: 1,
                paddingLeft: hPad,
                paddingRight: hPad,
              }}
            >
              <RevealLine show={untrackedVisible} delayMs={650}>
                <a
                  href={UNTRACKED_SITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    fontFamily: '"Space Mono", monospace',
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.35)',
                    textDecoration: 'none',
                  }}
                >
                  untrackedmusic.com →
                </a>
              </RevealLine>
            </div>
          </div>

          <div
            style={{
              width: '60px',
              height: '1px',
              margin: '80px auto',
              background: 'rgba(255,255,255,0.08)',
            }}
            aria-hidden
          />

          {/* War Room — scene layout */}
          <div
            ref={warRoomSectionRef}
            role="region"
            aria-label="The War Room"
            style={{
              ...fullBleedWrap,
              position: 'relative',
              marginBottom: 0,
              minHeight: 'min(55vh, 560px)',
              paddingTop: 'clamp(32px, 6vw, 64px)',
              paddingBottom: 'clamp(48px, 8vw, 96px)',
            }}
          >
            <RevealLine show={warRoomVisible} delayMs={0}>
              <div aria-hidden style={watermarkScene}>
                WAR ROOM
              </div>
            </RevealLine>

            <div
              style={{
                position: 'relative',
                zIndex: 1,
                paddingLeft: hPad,
                paddingRight: hPad,
              }}
            >
              <RevealLine show={warRoomVisible} delayMs={200}>
                <h2
                  style={{
                    fontFamily: '"Instrument Serif", Georgia, serif',
                    fontSize: '28px',
                    fontStyle: 'italic',
                    fontWeight: 400,
                    margin: '0 0 16px',
                    opacity: 0.9,
                    color: '#fff',
                  }}
                >
                  The War Room
                </h2>
              </RevealLine>
              <RevealLine show={warRoomVisible} delayMs={350}>
                <p
                  style={{
                    fontFamily: '"Space Mono", monospace',
                    fontSize: '13px',
                    lineHeight: 1.5,
                    margin: '0 0 16px',
                    opacity: 0.55,
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  2 people · 24 hours · 1st place
                </p>
                <p
                  style={{
                    fontFamily: '"Instrument Serif", Georgia, serif',
                    fontSize: '16px',
                    lineHeight: 1.55,
                    margin: '0 0 28px',
                    opacity: 0.5,
                    color: 'rgba(255,255,255,0.92)',
                    maxWidth: '500px',
                  }}
                >
                  Multi-agent adversarial debate engine. Three LLMs argue about your product until they
                  find the truth.
                </p>
              </RevealLine>
              <RevealLine show={warRoomVisible} delayMs={500}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {WAR_BADGES.map(name => (
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
              </RevealLine>
            </div>
          </div>

          {/* Footer */}
          <div
            ref={footerSectionRef}
            role="contentinfo"
            style={{
              ...fullBleedWrap,
              position: 'relative',
              paddingTop: '120px',
              paddingBottom: '80px',
              textAlign: 'center',
            }}
          >
            <RevealLine show={footerVisible} delayMs={0}>
              <div aria-hidden style={watermarkFooter}>
                ANGLEMYER
              </div>
            </RevealLine>

            <RevealLine show={footerVisible} delayMs={200}>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem 0.75rem',
                  marginBottom: '1rem',
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
            </RevealLine>

            <RevealLine show={footerVisible} delayMs={350}>
              <a href="mailto:tucker@untrackedmusic.com" style={{ ...linkMuted, display: 'inline-block' }}>
                tucker@untrackedmusic.com
              </a>
            </RevealLine>

            <RevealLine show={footerVisible} delayMs={450}>
              <p
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: '9px',
                  color: 'rgba(255,255,255,0.15)',
                  margin: '48px 0 0',
                  lineHeight: 1.5,
                }}
              >
                Built with WebGL, Three.js, and too much caffeine.
              </p>
            </RevealLine>
          </div>
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
