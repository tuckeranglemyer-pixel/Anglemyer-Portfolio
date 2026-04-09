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
        transform: show ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.75s ease ${delay}ms, transform 0.75s ease ${delay}ms`,
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

function ProjectDarkPanel({
  active,
  watermarkText,
  readableTitle,
  children,
}: {
  active: boolean
  watermarkText: string
  readableTitle: string
  children: ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [panelIn, setPanelIn] = useState(false)
  const [watermarkIn, setWatermarkIn] = useState(false)
  const [contentIn, setContentIn] = useState(false)

  useEffect(() => {
    if (!active) return
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPanelIn(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [active])

  useEffect(() => {
    if (!panelIn) return
    const t1 = window.setTimeout(() => setWatermarkIn(true), 200)
    const t2 = window.setTimeout(() => setContentIn(true), 400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [panelIn])

  return (
    <div ref={rootRef} style={{ ...fullBleedWrap, marginBottom: 0 }}>
      <div
        style={{
          minHeight: '50vh',
          padding: 'clamp(48px, 10vw, 80px)',
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
          overflow: 'hidden',
          opacity: panelIn ? 1 : 0,
          transform: panelIn ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.75s ease, transform 0.75s ease',
        }}
      >
        <div
          aria-hidden
          style={{
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
            fontSize: 'clamp(4rem, 12vw, 10rem)',
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
            color: '#fff',
            opacity: watermarkIn ? 0.15 : 0,
            lineHeight: 0.9,
            pointerEvents: 'none',
            transition: 'opacity 0.6s ease',
          }}
        >
          {watermarkText}
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2
            style={{
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontSize: '32px',
              fontStyle: 'italic',
              fontWeight: 400,
              margin: '0 0 clamp(32px, 5vw, 48px)',
              opacity: contentIn ? 0.9 : 0,
              color: '#fff',
              transition: 'opacity 0.65s ease',
            }}
          >
            {readableTitle}
          </h2>
          <div style={{ opacity: contentIn ? 1 : 0, transition: 'opacity 0.65s ease' }}>{children}</div>
        </div>
      </div>
    </div>
  )
}

function FooterPanel({ active }: { active: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [panelIn, setPanelIn] = useState(false)
  const [contentIn, setContentIn] = useState(false)

  useEffect(() => {
    if (!active) return
    const el = rootRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPanelIn(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [active])

  useEffect(() => {
    if (!panelIn) return
    const t = window.setTimeout(() => setContentIn(true), 400)
    return () => clearTimeout(t)
  }, [panelIn])

  const linkStyle: CSSProperties = {
    fontFamily: '"Space Mono", monospace',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.38)',
    textDecoration: 'none',
    transition: 'opacity 0.25s ease',
  }

  return (
    <div ref={rootRef} style={fullBleedWrap}>
      <div
        style={{
          padding: 'clamp(48px, 10vw, 80px)',
          background: 'rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          opacity: panelIn ? 1 : 0,
          transform: panelIn ? 'translateY(0)' : 'translateY(30px)',
          transition: 'opacity 0.75s ease, transform 0.75s ease',
        }}
      >
        <div style={{ opacity: contentIn ? 1 : 0, transition: 'opacity 0.65s ease' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem 0.75rem',
              marginBottom: '1.25rem',
            }}
          >
            {SOCIAL.map((s, i) => (
              <span key={s.href} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
                {i > 0 ? (
                  <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '12px', userSelect: 'none' }}>
                    ·
                  </span>
                ) : null}
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="main-footer-social"
                  style={linkStyle}
                >
                  {s.label}
                </a>
              </span>
            ))}
          </div>
          <a
            href="mailto:tucker@untrackedmusic.com"
            className="main-footer-email"
            style={{ ...linkStyle, display: 'inline-block', marginBottom: '1.5rem' }}
          >
            tucker@untrackedmusic.com
          </a>
          <p
            style={{
              fontFamily: '"Space Mono", monospace',
              fontSize: '10px',
              color: 'rgba(255,255,255,0.2)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Built with WebGL, Three.js, and too much caffeine.
          </p>
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

const COPY = {
  pro: {
    subtitle:
      'Providence College · Accounting & Finance · Incoming PwC · Founder, Untracked',
  },
  creative: {
    subtitle: 'Underground house · AI at 2am · Solo shows · The range is the resume',
  },
} as const

const UNTRACKED_SITE = 'https://untrackedmusic.com'

const SOCIAL = [
  { label: 'GitHub', href: 'https://github.com/tuckeranglemyer-pixel' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tucker-anglemyer-42a13a32b' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@untrackedmusic' },
] as const

const WAR_BADGES = ['CrewAI', 'ChromaDB', 'DGX Spark'] as const

export type ContentPhase = 'entry' | 'main'

interface MainContentProps {
  phase: ContentPhase
  mode: Mode
  active?: boolean
  accent: string
  onToggleMode: () => void
  /** Full-viewport identity cycle: hide entire main chrome while running. */
  identityCycleHidesContent?: boolean
  /** Ref to `.pretext-hero` root (layout / measurement). */
  heroContainerRef?: RefObject<HTMLDivElement | null>
  /** Keep PretextHero invisible until IdentityCycle ends (layout still measurable). */
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

  const isPro = mode === 'pro'
  const c = COPY[mode]

  const hPad = isMobile ? '16px' : '48px'
  const vPad = isMobile ? '24px' : '80px'

  const accentVar: CSSProperties & { '--accent-color': string } = {
    '--accent-color': accent,
  }

  const mainOpacity =
    !chromeVisible ? 0 : identityCycleHidesContent ? 0 : 1
  const mainPointer =
    chromeVisible && !identityCycleHidesContent ? 'auto' : 'none'

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
                    letterSpacing: isPro ? '0.04em' : '0.06em',
                    opacity: isPro ? 0.3 : 0.45,
                    color: 'rgba(255,255,255,0.55)',
                    maxWidth: '520px',
                    transition: 'opacity 0.6s ease, letter-spacing 0.6s ease',
                  }}
                >
                  {c.subtitle}
                </p>
              </header>
            </ScrollReveal>

            <ProjectDarkPanel
              active={active}
              watermarkText="UNTRACKED"
              readableTitle="Untracked"
            >
              <UntrackedPlayer active={active} />
              <a
                href={UNTRACKED_SITE}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '28px',
                  fontFamily: '"Space Mono", monospace',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.38)',
                  textDecoration: 'none',
                  transition: 'opacity 0.2s ease',
                }}
              >
                untrackedmusic.com →
              </a>
            </ProjectDarkPanel>

            <ProjectDarkPanel
              active={active}
              watermarkText="THE WAR ROOM"
              readableTitle="The War Room"
            >
              <p
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.55)',
                  margin: '0 0 20px',
                  lineHeight: 1.5,
                }}
              >
                2 people · 24 hours · 1st place
              </p>
              <p
                style={{
                  fontFamily: '"Instrument Serif", Georgia, serif',
                  fontSize: '18px',
                  lineHeight: 1.55,
                  color: 'rgba(255,255,255,0.7)',
                  margin: '0 0 28px',
                  maxWidth: '520px',
                }}
              >
                Multi-agent adversarial debate engine. Three LLMs arguing about your product until they find the truth.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {WAR_BADGES.map(name => (
                  <span
                    key={name}
                    style={{
                      fontFamily: '"Space Mono", monospace',
                      fontSize: '9px',
                      color: 'rgba(255,255,255,0.45)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      padding: '4px 12px',
                    }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </ProjectDarkPanel>

            <FooterPanel active={active} />
          </div>
        </div>
      </div>
    </div>
  )
}
