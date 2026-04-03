import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import PretextHero from './PretextHero'

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
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tucker-anglemyer-42a13a32b' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@untrackedmusic' },
] as const

export type ContentPhase = 'entry' | 'main'

interface MainContentProps {
  phase: ContentPhase
  mode: Mode
  active?: boolean
  accent: string
  onToggleMode: () => void
  /** Supreme-style identity cycle overlay (positioned over hero strip). */
  identityCycleOverlay?: ReactNode
  /** Hide PretextHero while cycle runs; reveal during crossfade. */
  heroSuppressedForIdentityCycle?: boolean
}

export default function MainContent({
  phase,
  mode,
  active = false,
  accent,
  onToggleMode,
  identityCycleOverlay,
  heroSuppressedForIdentityCycle = false,
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

  return (
    <>
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
              <div
                style={{
                  opacity: heroSuppressedForIdentityCycle ? 0 : 1,
                  transition: 'opacity 0.4s ease',
                }}
              >
                <PretextHero mode={mode} active={active} isMobile={isMobile} heroLayout="main" />
              </div>
              {identityCycleOverlay}
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
              <header style={{ marginBottom: '48px' }}>
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

            <ScrollReveal active={active}>
              <p
                style={{
                  fontFamily: isPro ? '"Instrument Serif", Georgia, serif' : '"Space Mono", monospace',
                  fontSize: '18px',
                  lineHeight: isPro ? 1.72 : 1.65,
                  fontWeight: 400,
                  color: 'rgba(255,255,255,0.55)',
                  margin: '0 0 96px',
                  maxWidth: '550px',
                  transition: 'font-size 0.6s ease, color 0.6s ease',
                }}
              >
                {c.bio}
              </p>
            </ScrollReveal>

          <ScrollReveal active={active}>
            <section style={{ marginBottom: '96px' }}>
              <h2
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: '11px',
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.22)',
                  margin: '0 0 24px',
                }}
              >
                Projects
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
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
                      fontSize: '14px',
                      lineHeight: 1.55,
                      color: 'rgba(255,255,255,0.38)',
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
                      fontSize: '14px',
                      lineHeight: 1.55,
                      color: 'rgba(255,255,255,0.38)',
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
                fontSize: '14px',
                lineHeight: 1.6,
                letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.38)',
                margin: '0 0 24px',
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
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.38)',
              }}
            >
              <div style={{ marginBottom: '24px' }}>
                {SOCIAL.map((s, i) => (
                  <span key={s.href}>
                    {i > 0 && <span style={{ color: 'rgba(255,255,255,0.22)' }}>  </span>}
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
      </div>
    </>
  )
}
