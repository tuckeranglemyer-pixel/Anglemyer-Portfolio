import { useState, useEffect, useRef, type ReactNode } from 'react'

type Mode = 'pro' | 'creative'

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

// ─── Reveal ───────────────────────────────────────────────────────────────────
function Reveal({
  children,
  delay = 0,
  active = true,
}: {
  children: ReactNode
  delay?: number
  active?: boolean
}) {
  const ref          = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setShow(true); io.disconnect() } },
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
interface LinkDef { label: string; href: string }

function ProjectBlock({
  title,
  description,
  link,
  delay = 0,
  active,
  accent,
}: {
  title: string
  description: string
  link?: LinkDef
  delay?: number
  active?: boolean
  accent: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Reveal delay={delay} active={active}>
      <div style={{ marginBottom: '3.5rem' }}>
        {/* Title — skews and shifts to accent on hover */}
        <h2
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            fontFamily:    '"Instrument Serif", serif',
            fontStyle:     'italic',
            fontSize:      '28px',
            fontWeight:    400,
            margin:        '0 0 14px',
            letterSpacing: '-0.01em',
            lineHeight:    1.15,
            display:       'inline-block',
            cursor:        'default',
            color:         hovered ? accent : 'rgba(255,255,255,0.95)',
            transform:     hovered ? 'skewX(-2deg) scale(1.02)' : 'skewX(0deg) scale(1)',
            transformOrigin: 'left center',
            transition:    'transform 0.3s ease, color 0.3s ease',
          }}
        >
          {title}
        </h2>

        <p
          style={{
            fontFamily:    '"Space Mono", monospace',
            fontSize:      '13px',
            lineHeight:    1.85,
            color:         'rgba(255,255,255,0.4)',
            margin:        '0 0 16px',
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
              display:        'inline-flex',
              alignItems:     'center',
              gap:            '7px',
              fontFamily:     '"Space Mono", monospace',
              fontSize:       '11px',
              letterSpacing:  '0.12em',
              color:          'rgba(255,255,255,0.4)',
              textDecoration: 'none',
              transition:     'color 0.2s ease',
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

// ─── EmailLink ────────────────────────────────────────────────────────────────
// Underline expands left-to-right on hover using a width transition on an
// absolutely-positioned span. React controls the width via hover state.
function EmailLink() {
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href="mailto:tucker@untrackedmusic.com"
      style={{
        position:       'relative',
        display:        'inline-block',
        fontFamily:     '"Space Mono", monospace',
        fontSize:       '11px',
        letterSpacing:  '0.15em',
        color:          hovered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)',
        textDecoration: 'none',
        transition:     'color 0.25s ease',
        paddingBottom:  '2px',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      tucker@untrackedmusic.com
      {/* expanding underline */}
      <span
        style={{
          position:   'absolute',
          bottom:     0,
          left:       0,
          height:     '1px',
          background: 'rgba(255,255,255,0.35)',
          width:      hovered ? '100%' : '0%',
          transition: 'width 0.35s ease',
        }}
      />
    </a>
  )
}

// ─── MainContent ──────────────────────────────────────────────────────────────
interface MainContentProps {
  mode:    Mode
  accent:  string
  active?: boolean
}

export default function MainContent({ mode, accent, active = false }: MainContentProps) {
  const isMobile = useIsMobile()

  // Hero fades out briefly when mode switches so the style swap isn't abrupt
  const [displayMode, setDisplayMode] = useState<Mode>(mode)
  const [heroOpacity,  setHeroOpacity]  = useState(1)

  useEffect(() => {
    if (mode === displayMode) return
    setHeroOpacity(0)
    const t = setTimeout(() => { setDisplayMode(mode); setHeroOpacity(1) }, 220)
    return () => clearTimeout(t)
  }, [mode, displayMode])

  const isPro = displayMode === 'pro'

  const hPad = isMobile ? '24px' : '48px'
  const vPad = isMobile ? '60px' : '80px'

  return (
    <div
      style={{
        maxWidth:      '600px',
        paddingLeft:   hPad,
        paddingRight:  hPad,
        paddingTop:    vPad,
        paddingBottom: '96px',
      }}
    >
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <Reveal delay={0} active={active}>
        <div
          style={{
            opacity:      heroOpacity,
            transition:   'opacity 0.22s ease',
            marginBottom: '72px',
          }}
        >
          <h1
            style={{
              margin:         '0 0 22px',
              lineHeight:     1.0,
              overflowWrap:   'break-word',
              ...(isPro
                ? {
                    fontFamily:    '"Instrument Serif", serif',
                    fontSize:      isMobile ? '48px' : 'clamp(52px, 7vw, 80px)',
                    fontWeight:    400,
                    letterSpacing: '-0.02em',
                    color:         'rgba(255,255,255,0.95)',
                  }
                : {
                    fontFamily:    '"Space Mono", monospace',
                    fontSize:      isMobile ? '48px' : 'clamp(44px, 6vw, 72px)',
                    fontWeight:    700,
                    letterSpacing: isMobile ? '0.05em' : '0.08em',
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
        accent={accent}
      />

      <ProjectBlock
        title="The War Room"
        description="Multi-agent adversarial AI product analysis engine. 1st place, yconic New England AI Hackathon. Built in 24 hours with a two-person team."
        delay={160}
        active={active}
        accent={accent}
      />

      {/* ── Contact ──────────────────────────────────────────────────────────── */}
      <Reveal delay={240} active={active}>
        <EmailLink />
      </Reveal>
    </div>
  )
}
