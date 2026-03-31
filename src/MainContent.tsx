import { useState, useEffect, useRef, type ReactNode } from 'react'

type Mode = 'pro' | 'creative'

const HERO_COPY: Record<Mode, string> = {
  pro:
    'Builder, founder, operator. Providence College double major in Accounting and Finance. Incoming PwC. Founded Untracked — an AI-powered music discovery platform for DJs. First place at the yconic New England Inter-Collegiate AI Hackathon. D1 athlete. Friars Club tour guide. Student Congress. The kind of person who debugs production on the bus home from giving a campus tour in a blazer.',
  creative:
    'I go to shows alone and talk to strangers about four-on-the-floor kicks. I code AI agents at 2am and give campus tours in a blazer the next morning. I can explain deferred tax assets and why UK garage never got the American respect it deserved — same breath. Built a hackathon-winning AI engine with a two-person team against CS grad students from Brown and Northeastern. The range is the point.',
}

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
function ProjectBlock({
  title,
  titleHref,
  description,
  delay = 0,
  active,
  accent,
}: {
  title:       string
  titleHref?:  string
  description: string
  delay?:      number
  active?:     boolean
  accent:      string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Reveal delay={delay} active={active}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          paddingLeft:    '20px',
          borderLeft:     hovered ? `1px solid ${accent}` : '1px solid rgba(255,255,255,0.06)',
          boxShadow:      hovered ? `-2px 0 16px -4px ${accent}66` : 'none',
          transition:   'border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        <h2
          style={{
            margin:         0,
            paddingBottom:  '4px',
            position:       'relative',
            display:        'inline-block',
            transform:      hovered ? 'translateX(8px)' : 'translateX(0)',
            transition:   'transform 0.3s ease',
          }}
        >
          {titleHref ? (
            <a
              href={titleHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily:    '"Instrument Serif", serif',
                fontStyle:     'italic',
                fontSize:      '32px',
                fontWeight:    400,
                letterSpacing: '-0.01em',
                lineHeight:    1.15,
                color:         hovered ? accent : 'rgba(255,255,255,0.9)',
                textDecoration: 'none',
                display:       'inline-block',
                position:      'relative',
                paddingBottom: '3px',
                transition:    'color 0.3s ease',
              }}
            >
              {title}
              <span
                aria-hidden
                style={{
                  position:   'absolute',
                  bottom:     0,
                  left:       0,
                  height:     '1px',
                  width:      hovered ? '100%' : '0%',
                  background: accent,
                  transition: 'width 0.3s ease',
                }}
              />
            </a>
          ) : (
            <span
              style={{
                fontFamily:    '"Instrument Serif", serif',
                fontStyle:     'italic',
                fontSize:      '32px',
                color:         'rgba(255,255,255,0.9)',
              }}
            >
              {title}
            </span>
          )}
        </h2>
        <p
          style={{
            margin:         '10px 0 0',
            fontFamily:     '"Space Mono", monospace',
            fontSize:       '12px',
            lineHeight:     1.45,
            color:            'rgba(255,255,255,0.35)',
            maxWidth:       '520px',
          }}
        >
          {description}
        </p>
      </div>
    </Reveal>
  )
}

// ─── FixedSocialLinks ─────────────────────────────────────────────────────────
const SOCIAL: { letter: string; label: string; href: string }[] = [
  { letter: 'G', label: 'GitHub',   href: 'https://github.com/tuckeranglemyer-pixel' },
  { letter: 'L', label: 'LinkedIn', href: 'https://www.linkedin.com/in/tucker-anglemyer-42a13a32b/' },
  { letter: 'T', label: 'TikTok',   href: 'https://www.tiktok.com/@untrackedmusic' },
]

function FixedSocialLinks({ isMobile, active }: { isMobile: boolean; active: boolean }) {
  if (!active) return null

  if (isMobile) {
    return (
      <div
        style={{
          position:       'fixed',
          left:           0,
          right:          0,
          bottom:         0,
          zIndex:         50,
          display:        'flex',
          justifyContent: 'center',
          alignItems:     'center',
          flexWrap:       'wrap',
          gap:            '20px 28px',
          padding:        '16px 16px calc(20px + env(safe-area-inset-bottom, 0px))',
          pointerEvents:  'auto',
        }}
      >
        {SOCIAL.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily:     '"Space Mono", monospace',
              fontSize:       '11px',
              letterSpacing:  '0.08em',
              color:            'rgba(255,255,255,0.35)',
              textDecoration: 'none',
            }}
          >
            {label}
          </a>
        ))}
      </div>
    )
  }

  return (
    <nav
      aria-label="Social links"
      style={{
        position:       'fixed',
        right:          'max(16px, env(safe-area-inset-right, 0px))',
        top:            '50%',
        transform:      'translateY(-50%)',
        zIndex:         50,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-end',
        gap:            '32px',
        pointerEvents:  'auto',
        maxWidth:       'min(200px, calc(100vw - 32px))',
        overflow:       'hidden',
        boxSizing:      'border-box',
      }}
    >
      {SOCIAL.map(({ letter, label, href }) => (
        <SocialLinkDesktop key={label} letter={letter} label={label} href={href} />
      ))}
    </nav>
  )
}

function SocialLinkDesktop({
  letter,
  label,
  href,
}: {
  letter: string
  label:  string
  href:   string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        'flex',
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'flex-end',
        gap:            '10px',
        textDecoration: 'none',
        outline:        'none',
      }}
    >
      <span
        style={{
          fontFamily:     '"Space Mono", monospace',
          fontSize:       '11px',
          letterSpacing:  '0.12em',
          color:            'rgba(255,255,255,0.75)',
          opacity:        hovered ? 1 : 0,
          transform:      hovered ? 'translateX(0)' : 'translateX(6px)',
          transition:     'opacity 0.3s ease, transform 0.3s ease',
          whiteSpace:     'nowrap',
          pointerEvents:  'none',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily:     '"Space Mono", monospace',
          fontSize:       '11px',
          color:            hovered ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)',
          display:        'inline-block',
          transform:      hovered ? 'rotate(0deg)' : 'rotate(90deg)',
          transformOrigin: 'center center',
          transition:     'transform 0.3s ease, color 0.3s ease',
          width:          '14px',
          textAlign:      'center',
        }}
      >
        {letter}
      </span>
    </a>
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

export default function MainContent({
  mode,
  accent,
  active = false,
}: MainContentProps) {
  const isMobile = useIsMobile()

  const [displayMode, setDisplayMode] = useState<Mode>(mode)
  const [heroOpacity,  setHeroOpacity]  = useState(1)

  useEffect(() => {
    if (mode === displayMode) return
    queueMicrotask(() => setHeroOpacity(0))
    const t = setTimeout(() => {
      setDisplayMode(mode)
      setHeroOpacity(1)
    }, 220)
    return () => clearTimeout(t)
  }, [mode, displayMode])

  const isPro = displayMode === 'pro'

  const hPad = isMobile ? '24px' : '48px'
  const vPad = isMobile ? '60px' : '80px'

  return (
    <>
    <div
      style={{
        maxWidth:      '600px',
        width:         '100%',
        boxSizing:     'border-box',
        overflowX:     'hidden',
        paddingLeft:   hPad,
        paddingRight:  hPad,
        paddingTop:    vPad,
        paddingBottom: isMobile ? '140px' : '96px',
      }}
    >
      <Reveal delay={0} active={active}>
        <div
          style={{
            opacity:      heroOpacity,
            transition:   'opacity 0.22s ease',
            marginBottom: '72px',
          }}
        >
          {/* Reserve space for WebGL hero title (HeroPlane) */}
          <div
            aria-hidden
            style={{
              marginBottom: '36px',
              minHeight: isMobile ? '48px' : (isPro ? '160px' : '88px'),
            }}
          />

          <p
            style={{
              fontFamily: displayMode === 'pro' ? '"Instrument Serif", serif' : '"Space Mono", monospace',
              fontSize:   displayMode === 'pro' ? '18px' : '16px',
              fontWeight: 400,
              color:      'rgba(255,255,255,0.45)',
              lineHeight: 1.7,
              margin:     0,
            }}
          >
            {HERO_COPY[displayMode]}
          </p>
        </div>
      </Reveal>

      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          gap:            '48px',
          marginBottom:   '48px',
        }}
      >
        <ProjectBlock
          title="Untracked"
          titleHref="https://untrackedmusic.com"
          description="AI-powered music discovery for DJs"
          delay={80}
          active={active}
          accent={accent}
        />

        <ProjectBlock
          title="The War Room"
          titleHref="https://frontend-pi-seven-13.vercel.app/"
          description="4th place, yconic AI Hackathon - multi-agent product analysis utilizing Nvidia DGX Spark"
          delay={160}
          active={active}
          accent={accent}
        />
      </div>

      <Reveal delay={300} active={active}>
        <EmailLink />
      </Reveal>
    </div>

    <FixedSocialLinks isMobile={isMobile} active={active} />
    </>
  )
}
