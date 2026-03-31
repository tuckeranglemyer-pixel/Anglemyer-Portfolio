import { useState, useEffect, useRef, type ReactNode, type CSSProperties } from 'react'
import PretextHero from './PretextHero'

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
  titleHref,
  link,
  delay = 0,
  active,
  accent,
}: {
  title:      string
  titleHref?: string
  link?:      LinkDef
  delay?:     number
  active?:    boolean
  accent:     string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Reveal delay={delay} active={active}>
      <div style={{ marginBottom: '2rem' }}>
        {/* Title — skews and shifts to accent on hover; optionally a link */}
        <h2
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            fontFamily:    '"Instrument Serif", serif',
            fontStyle:     'italic',
            fontSize:      '24px',
            fontWeight:    400,
            margin:        link ? '0 0 10px' : '0',
            letterSpacing: '-0.01em',
            lineHeight:    1.15,
            display:       'inline-block',
            cursor:        titleHref ? 'pointer' : 'default',
            color:         hovered ? accent : 'rgba(255,255,255,0.85)',
            transform:     hovered ? 'skewX(-2deg) scale(1.02)' : 'skewX(0deg) scale(1)',
            transformOrigin: 'left center',
            transition:    'transform 0.3s ease, color 0.3s ease',
          }}
        >
          {titleHref ? (
            <a
              href={titleHref}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {title}
            </a>
          ) : title}
        </h2>

        {link && (
          <div>
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
          </div>
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

// ─── HeroName ─────────────────────────────────────────────────────────────────
// Simplified: CSS transitions handle all animation — no rAF, no particles.
// On mousemove: letters within 70px sink (translateY + rotate + fade + blur).
//   transition: none while sinking so they snap immediately to the pulled position.
// On mouseleave: ALL letters reset with the spring transition — can never get stuck.
function HeroName({ name, style }: { name: string; style: CSSProperties }) {
  const spanRefs   = useRef<(HTMLSpanElement | null)[]>([])
  const chars      = Array.from(name)
  const SPRING     = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.5s ease, filter 0.5s ease'

  // Per-letter stable random rotation — re-seeded when name changes
  const letterRot = useRef<number[]>([])
  useEffect(() => {
    letterRot.current = Array.from(name).map(() => (Math.random() - 0.5) * 20)
  }, [name])

  const onMouseMove = (e: React.MouseEvent<HTMLHeadingElement>) => {
    const cx = e.clientX
    const cy = e.clientY

    // Batch reads
    const bboxes = spanRefs.current.map(span => {
      if (!span) return null
      const r = span.getBoundingClientRect()
      return { span, mx: r.left + r.width * 0.5, my: r.top + r.height * 0.5 }
    })

    // Batch writes
    bboxes.forEach((item, i) => {
      if (!item) return
      const { span, mx, my } = item
      const dist = Math.hypot(cx - mx, cy - my)
      const rot  = letterRot.current[i] ?? 0

      if (dist < 70) {
        const t = 1 - dist / 70  // 0 at edge → 1 at cursor
        span.style.transition = 'none'
        span.style.transform  = `translateY(${(50 * t).toFixed(1)}px) rotate(${(rot * t).toFixed(1)}deg)`
        span.style.opacity    = String(Math.max(0, 1 - t).toFixed(3))
        span.style.filter     = `blur(${(2 * t).toFixed(2)}px)`
      } else {
        span.style.transition = SPRING
        span.style.transform  = ''
        span.style.opacity    = ''
        span.style.filter     = ''
      }
    })
  }

  // mouseleave always fires a full reset — letters can never get stuck mid-sink
  const onMouseLeave = () => {
    spanRefs.current.forEach(span => {
      if (!span) return
      span.style.transition = SPRING
      span.style.transform  = ''
      span.style.opacity    = ''
      span.style.filter     = ''
    })
  }

  return (
    <h1
      data-hero-name=""
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={style}
    >
      {chars.map((char, i) => (
        <span
          key={i}
          ref={el => { spanRefs.current[i] = el }}
          style={{
            display:    char === ' ' ? 'inline' : 'inline-block',
            transition: SPRING,
          }}
        >
          {char}
        </span>
      ))}
    </h1>
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
          {/* Hero name — per-character spans, fin-sink effect on hover */}
          <HeroName
            name={isPro ? 'Tucker Anglemyer' : 'ANGLEMYER'}
            style={{
              fontFamily:    isPro ? '"Instrument Serif", serif' : '"Space Mono", monospace',
              fontSize:      isMobile ? '48px' : (isPro ? '80px' : '72px'),
              fontWeight:    isPro ? 400 : 700,
              color:         isPro ? 'rgba(255,255,255,0.95)' : 'white',
              letterSpacing: isPro ? '-0.02em' : '0.06em',
              textTransform: isPro ? 'none' : 'uppercase',
              lineHeight:    1.0,
              margin:        '0 0 36px',
            }}
          />

          {/* Pretext bio — cursor-reactive paragraph */}
          <PretextHero
            mode={displayMode}
            color="rgba(255,255,255,0.45)"
            accent={accent}
          />
        </div>
      </Reveal>

      {/* ── Projects ─────────────────────────────────────────────────────────── */}
      <ProjectBlock
        title="Untracked"
        titleHref="https://untrackedmusic.com"
        delay={80}
        active={active}
        accent={accent}
      />

      <ProjectBlock
        title="The War Room"
        titleHref="https://frontend-pi-seven-13.vercel.app/"
        delay={160}
        active={active}
        accent={accent}
      />

      {/* ── Social links ─────────────────────────────────────────────────────── */}
      <Reveal delay={240} active={active}>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '1.25rem' }}>
          {[
            { label: 'GitHub',   href: 'https://github.com/tuckeranglemyer-pixel' },
            { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tucker-anglemyer-42a13a32b/' },
            { label: 'TikTok',  href: 'https://www.tiktok.com/@untrackedmusic' },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily:     '"Space Mono", monospace',
                fontSize:       '11px',
                letterSpacing:  '0.1em',
                color:          'rgba(255,255,255,0.25)',
                textDecoration: 'none',
                transition:     'color 0.2s ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.25)')}
            >
              {label}
            </a>
          ))}
        </div>
      </Reveal>

      {/* ── Contact ──────────────────────────────────────────────────────────── */}
      <Reveal delay={300} active={active}>
        <EmailLink />
      </Reveal>
    </div>
  )
}
