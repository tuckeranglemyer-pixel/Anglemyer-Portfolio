import { useState, useEffect, useRef, useCallback, type ReactNode, type CSSProperties } from 'react'
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
  link,
  delay = 0,
  active,
  accent,
}: {
  title: string
  link?: LinkDef
  delay?: number
  active?: boolean
  accent: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <Reveal delay={delay} active={active}>
      <div style={{ marginBottom: '2rem' }}>
        {/* Title — skews and shifts to accent on hover */}
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
            cursor:        'default',
            color:         hovered ? accent : 'rgba(255,255,255,0.85)',
            transform:     hovered ? 'skewX(-2deg) scale(1.02)' : 'skewX(0deg) scale(1)',
            transformOrigin: 'left center',
            transition:    'transform 0.3s ease, color 0.3s ease',
          }}
        >
          {title}
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
// Renders the hero h1 with every character in its own inline-block <span>.
// On mousemove, characters within 60px of the cursor sink down and blur via
// direct DOM style writes — no React state. CSS transition springs them back.
function HeroName({ name, style }: { name: string; style: CSSProperties }) {
  const spanRefs = useRef<(HTMLSpanElement | null)[]>([])
  const rafRef   = useRef(0)
  const chars    = Array.from(name)

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLHeadingElement>) => {
    const cx = e.clientX
    const cy = e.clientY
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      // Batch reads first, then writes to avoid forced reflows
      const data = spanRefs.current.map(span => {
        if (!span) return null
        const r = span.getBoundingClientRect()
        return { span, mx: r.left + r.width / 2, my: r.top + r.height / 2 }
      })
      data.forEach(item => {
        if (!item) return
        const { span, mx, my } = item
        const dist = Math.sqrt((cx - mx) ** 2 + (cy - my) ** 2)
        const t    = Math.max(0, 1 - dist / 60)
        if (t > 0) {
          span.style.transform = `translateY(${(8 + t * 7).toFixed(1)}px)`
          span.style.opacity   = (1 - t * 0.7).toFixed(3)
          span.style.filter    = `blur(${t.toFixed(2)}px)`
        } else {
          span.style.transform = ''
          span.style.opacity   = ''
          span.style.filter    = ''
        }
      })
    })
  }, [])

  const onMouseLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    spanRefs.current.forEach(span => {
      if (!span) return
      span.style.transform = ''
      span.style.opacity   = ''
      span.style.filter    = ''
    })
  }, [])

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
            // inline-block enables transform; spaces stay inline so word-wrap works
            display:    char === ' ' ? 'inline' : 'inline-block',
            transition: 'transform 0.4s ease-out, opacity 0.4s ease-out, filter 0.4s ease-out',
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
        link={{ label: 'untrackedmusic.com', href: 'https://untrackedmusic.com' }}
        delay={80}
        active={active}
        accent={accent}
      />

      <ProjectBlock
        title="The War Room"
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
