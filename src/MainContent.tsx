import { useState, useEffect, useRef, type ReactNode } from 'react'

type Mode = 'pro' | 'creative'

// ─── Reveal ───────────────────────────────────────────────────────────────────
// Each child fades in and slides up 20px when it enters the viewport.
// `active` must be true before observation begins — prevents animations firing
// while the parent container is still invisible (pre-main phase).
function Reveal({
  children,
  delay = 0,
  active = true,
}: {
  children: ReactNode
  delay?: number
  active?: boolean
}) {
  const ref     = useRef<HTMLDivElement>(null)
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
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [active])

  return (
    <div
      ref={ref}
      style={{
        opacity:   show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.75s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}ms,
                     transform 0.75s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

// ─── ProjectBlock ─────────────────────────────────────────────────────────────
interface LinkDef {
  label: string
  href: string
}

function ProjectBlock({
  title,
  description,
  link,
  delay = 0,
  active,
}: {
  title: string
  description: string
  link?: LinkDef
  delay?: number
  active?: boolean
}) {
  return (
    <Reveal delay={delay} active={active}>
      <div style={{ marginBottom: '3.5rem' }}>
        <h2
          style={{
            fontFamily: '"Instrument Serif", serif',
            fontStyle:  'italic',
            fontSize:   '28px',
            fontWeight: 400,
            color:      'rgba(255,255,255,0.95)',
            margin:     '0 0 14px',
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            fontFamily:  '"Space Mono", monospace',
            fontSize:    '13px',
            lineHeight:  1.85,
            color:       'rgba(255,255,255,0.4)',
            margin:      '0 0 16px',
            letterSpacing: '0.02em',
          }}
        >
          {description}
        </p>

        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:     'inline-flex',
              alignItems:  'center',
              gap:         '7px',
              fontFamily:  '"Space Mono", monospace',
              fontSize:    '11px',
              letterSpacing: '0.12em',
              color:       'rgba(255,255,255,0.4)',
              textDecoration: 'none',
              transition:  'color 0.2s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.88)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            <span style={{ fontSize: '15px', lineHeight: 1 }}>→</span>
            {link.label}
          </a>
        )}
      </div>
    </Reveal>
  )
}

// ─── MainContent ──────────────────────────────────────────────────────────────
interface MainContentProps {
  mode: Mode
  // Becomes true once the page is fully visible so reveals don't fire early
  active?: boolean
}

export default function MainContent({ mode, active = false }: MainContentProps) {
  // Hero fades out briefly when mode switches so the style change isn't abrupt
  const [displayMode, setDisplayMode] = useState<Mode>(mode)
  const [heroOpacity,  setHeroOpacity]  = useState(1)

  useEffect(() => {
    if (mode === displayMode) return
    setHeroOpacity(0)
    const t = setTimeout(() => {
      setDisplayMode(mode)
      setHeroOpacity(1)
    }, 220)
    return () => clearTimeout(t)
  }, [mode, displayMode])

  const isPro = displayMode === 'pro'

  return (
    <div
      style={{
        maxWidth:      '600px',
        paddingLeft:   '48px',
        paddingRight:  '48px',
        paddingTop:    '80px',
        paddingBottom: '96px',
      }}
    >
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <Reveal delay={0} active={active}>
        <div
          style={{
            opacity:    heroOpacity,
            transition: 'opacity 0.22s ease',
            marginBottom: '72px',
          }}
        >
          <h1
            style={{
              margin:     '0 0 22px',
              lineHeight: 1.0,
              ...(isPro
                ? {
                    fontFamily:    '"Instrument Serif", serif',
                    fontSize:      'clamp(52px, 7vw, 80px)',
                    fontWeight:    400,
                    letterSpacing: '-0.02em',
                    color:         'rgba(255,255,255,0.95)',
                  }
                : {
                    fontFamily:    '"Space Mono", monospace',
                    fontSize:      'clamp(40px, 5.5vw, 72px)',
                    fontWeight:    700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                    color:         'white',
                  }),
            }}
          >
            {isPro ? 'Tucker Anglemyer' : 'ANGLEMYER'}
          </h1>

          <p
            style={{
              fontFamily:    '"Space Mono", monospace',
              fontSize:      '12px',
              letterSpacing: '0.2em',
              color:         'rgba(255,255,255,0.3)',
              margin:        0,
              lineHeight:    1.65,
            }}
          >
            {isPro
              ? 'Providence College\u2009·\u2009Accounting & Finance\u2009·\u2009Incoming PwC\u2009·\u2009Founder, Untracked'
              : 'Underground house\u2009·\u2009AI at 2am\u2009·\u2009Solo shows\u2009·\u2009The range is the resume'}
          </p>
        </div>
      </Reveal>

      {/* ── Projects ─────────────────────────────────────────────────────────── */}
      <ProjectBlock
        title="Untracked"
        description="AI-powered music discovery for DJs. React, FastAPI, pgvector embeddings, MERT audio analysis. 800+ enriched tracks. Building the infrastructure underground music deserves."
        link={{ label: 'untrackedmusic.com', href: 'https://untrackedmusic.com' }}
        delay={80}
        active={active}
      />

      <ProjectBlock
        title="The War Room"
        description="Multi-agent adversarial AI product analysis engine. 1st place, yconic New England AI Hackathon. Built in 24 hours with a two-person team."
        delay={160}
        active={active}
      />

      {/* ── Contact ──────────────────────────────────────────────────────────── */}
      <Reveal delay={240} active={active}>
        <a
          href="mailto:tucker@untrackedmusic.com"
          style={{
            fontFamily:    '"Space Mono", monospace',
            fontSize:      '11px',
            letterSpacing: '0.15em',
            color:         'rgba(255,255,255,0.25)',
            textDecoration: 'none',
            transition:    'color 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
        >
          tucker@untrackedmusic.com
        </a>
      </Reveal>
    </div>
  )
}
