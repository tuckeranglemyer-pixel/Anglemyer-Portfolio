import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'

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

const FADE_MS = 600

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

function ModeToggle({
  mode,
  accent,
  onToggle,
}: {
  mode: Mode
  accent: string
  onToggle: () => void
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
        right: '1.5rem',
        zIndex: 60,
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
          background: 'rgba(255,255,255,0.08)',
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
            background: 'rgba(255,255,255,0.9)',
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
    hero: 'Tucker Anglemyer',
    subtitle:
      'Providence College · Accounting & Finance · Incoming PwC · Founder, Untracked',
    bio: "Builder, founder, operator. Providence College double major in Accounting and Finance. Incoming PwC. Founded Untracked — an AI-powered music discovery platform for DJs. First place at the yconic New England Inter-Collegiate AI Hackathon. D1 athlete. Friars Club tour guide. Student Congress. The kind of person who debugs production on the bus home from giving a campus tour in a blazer.",
    untrackedDesc:
      'AI-powered music discovery for DJs. React, FastAPI, pgvector embeddings, MERT audio analysis. 800+ enriched tracks.',
    warRoomDesc:
      'Multi-agent adversarial AI product analysis engine. 1st place, yconic New England AI Hackathon. Built in 24 hours.',
    footer: 'React · TypeScript · Python · FastAPI · PostgreSQL · Firestore · pgvector · Vercel · Railway',
  },
  creative: {
    hero: 'ANGLEMYER',
    subtitle: 'Underground house · AI at 2am · Solo shows · The range is the resume',
    bio: 'I go to shows alone and talk to strangers about 4/4 kicks. I code agents at 2am and give campus tours in a blazer. I can explain deferred tax assets and why UK garage never got American respect — same breath.',
    untrackedDesc:
      'The infrastructure underground music deserves. Building the tool I wish existed when I started digging for tracks.',
    warRoomDesc:
      'Two people. 24 hours. First place. Competing with CS masters students while holding a conversation about cutting edge AI.',
    footer: 'Radius Chicago · Royale Boston · Solo dolo',
  },
} as const

const PROJECT_LINKS = {
  untracked: 'https://untrackedmusic.com',
  warRoom: 'https://frontend-pi-seven-13.vercel.app/',
} as const

const SOCIAL = [
  { label: 'GitHub', href: 'https://github.com/tuckeranglemyer-pixel' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tucker-anglemyer-42a13a32b/' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@untrackedmusic' },
] as const

interface MainContentProps {
  mode: Mode
  active?: boolean
  accent: string
  onToggleMode: () => void
}

export default function MainContent({
  mode,
  active = false,
  accent,
  onToggleMode,
}: MainContentProps) {
  const isMobile = useIsMobile()

  const [displayMode, setDisplayMode] = useState<Mode>(mode)
  const [layerOpacity, setLayerOpacity] = useState(1)

  useEffect(() => {
    if (mode === displayMode) return
    setLayerOpacity(0)
    const t = setTimeout(() => {
      setDisplayMode(mode)
      setLayerOpacity(1)
    }, FADE_MS)
    return () => clearTimeout(t)
  }, [mode, displayMode])

  const isPro = displayMode === 'pro'
  const c = COPY[displayMode]

  const hPad = isMobile ? '24px' : '48px'
  const vPad = isMobile ? '60px' : '80px'

  const accentVar: CSSProperties & { '--accent-color': string } = {
    '--accent-color': accent,
  }

  return (
    <>
      <ModeToggle mode={mode} accent={accent} onToggle={onToggleMode} />

      <div
        style={{
          maxWidth: '600px',
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'hidden',
          paddingLeft: hPad,
          paddingRight: hPad,
          paddingTop: vPad,
          paddingBottom: isMobile ? '140px' : '96px',
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            ...accentVar,
            opacity: layerOpacity,
            transition: 'opacity 0.6s ease',
          }}
        >
          <ScrollReveal active={active}>
            <header style={{ marginBottom: '36px' }}>
              <h1
                style={{
                  fontFamily: isPro ? '"Instrument Serif", Georgia, serif' : '"Space Mono", monospace',
                  fontSize: isPro ? 'clamp(2.75rem, 8vw, 4.25rem)' : 'clamp(2rem, 6vw, 3rem)',
                  fontWeight: isPro ? 300 : 700,
                  fontStyle: isPro ? 'normal' : 'normal',
                  lineHeight: isPro ? 1.05 : 1.1,
                  letterSpacing: isPro ? '-0.02em' : '0.28em',
                  textTransform: isPro ? 'none' : 'uppercase',
                  color: 'rgba(255,255,255,0.96)',
                  margin: 0,
                  transition:
                    'font-size 0.6s ease, letter-spacing 0.6s ease, color 0.6s ease',
                }}
              >
                {c.hero}
              </h1>

              <p
                style={{
                  marginTop: '16px',
                  fontFamily: '"Space Mono", monospace',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  letterSpacing: isPro ? '0.04em' : '0.06em',
                  opacity: isPro ? 0.3 : 0.45,
                  color: 'rgba(255,255,255,0.95)',
                  maxWidth: '520px',
                  transition: 'opacity 0.6s ease, letter-spacing 0.6s ease',
                }}
              >
                {c.subtitle}
              </p>
            </header>
          </ScrollReveal>

          <ScrollReveal active={active}>
            <p
              style={{
                fontFamily: isPro ? '"Instrument Serif", Georgia, serif' : '"Space Mono", monospace',
                fontSize: isPro ? '18px' : '16px',
                lineHeight: isPro ? 1.72 : 1.65,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.45)',
                margin: '0 0 48px',
                maxWidth: '550px',
                transition: 'font-size 0.6s ease, color 0.6s ease',
              }}
            >
              {c.bio}
            </p>
          </ScrollReveal>

          <ScrollReveal active={active}>
            <section style={{ marginBottom: '48px' }}>
              <h2
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: '10px',
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.25)',
                  margin: '0 0 20px',
                }}
              >
                Projects
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }}>
                <div>
                  <a
                    className="main-project-title"
                    href={PROJECT_LINKS.untracked}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Untracked
                  </a>
                  <p
                    style={{
                      fontFamily: '"Space Mono", monospace',
                      fontSize: '12px',
                      lineHeight: 1.55,
                      color: 'rgba(255,255,255,0.35)',
                      margin: 0,
                      maxWidth: '550px',
                      transition: 'color 0.6s ease',
                    }}
                  >
                    {c.untrackedDesc}
                  </p>
                </div>

                <div>
                  <a
                    className="main-project-title"
                    href={PROJECT_LINKS.warRoom}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    The War Room
                  </a>
                  <p
                    style={{
                      fontFamily: '"Space Mono", monospace',
                      fontSize: '12px',
                      lineHeight: 1.55,
                      color: 'rgba(255,255,255,0.35)',
                      margin: 0,
                      maxWidth: '550px',
                      transition: 'color 0.6s ease',
                    }}
                  >
                    {c.warRoomDesc}
                  </p>
                </div>
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal active={active}>
            <p
              style={{
                fontFamily: '"Space Mono", monospace',
                fontSize: '11px',
                lineHeight: 1.6,
                letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.32)',
                margin: '0 0 40px',
                maxWidth: '550px',
                transition: 'color 0.6s ease',
              }}
            >
              {c.footer}
            </p>
          </ScrollReveal>

          <ScrollReveal active={active}>
            <div
              style={{
                fontFamily: '"Space Mono", monospace',
                fontSize: '11px',
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              <div style={{ marginBottom: '14px' }}>
                {SOCIAL.map((s, i) => (
                  <span key={s.href}>
                    {i > 0 && <span style={{ color: 'rgba(255,255,255,0.2)' }}>  </span>}
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="main-social-link"
                    >
                      {s.label}
                    </a>
                  </span>
                ))}
              </div>
              <a href="mailto:tucker@untrackedmusic.com" className="main-email-link">
                tucker@untrackedmusic.com
              </a>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </>
  )
}
