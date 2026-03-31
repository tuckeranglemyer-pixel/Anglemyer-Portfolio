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
// Hero title uses data-hero-name for layout hooks; water ripples are global (WaterDisplacement).
// Letters within 70px of cursor sink with blur/rotate; spring back when fin leaves.
// Tiny red particles spawn as letters sink; max 30; updated in rAF.
const SPRING =
  'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'

type BloodParticle = {
  el: HTMLDivElement
  x: number
  y: number
  vx: number
  vy: number
  born: number
}

function HeroName({ name, style }: { name: string; style: CSSProperties }) {
  const h1Ref          = useRef<HTMLHeadingElement>(null)
  const spanRefs       = useRef<(HTMLSpanElement | null)[]>([])
  const cursorRef      = useRef({ x: -9999, y: -9999 })
  const letterRotRef   = useRef<number[]>([])
  const wasSunkRef     = useRef<boolean[]>([])
  const particlesRef   = useRef<BloodParticle[]>([])
  const particleHostRef = useRef<HTMLDivElement>(null)

  const chars = Array.from(name)

  useEffect(() => {
    letterRotRef.current = Array.from(name).map(() => (Math.random() - 0.5) * 24)
    wasSunkRef.current   = Array.from(name).map(() => false)
  }, [name])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    let raf: number
    let cancelled = false

    function tick(now: number) {
      if (cancelled) return
      const host = particleHostRef.current
      if (!host) {
        raf = requestAnimationFrame(tick)
        return
      }

      const h1 = h1Ref.current
      const cx = cursorRef.current.x
      const cy = cursorRef.current.y

      let overName = false
      if (h1) {
        const r = h1.getBoundingClientRect()
        overName = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom
      }

      const bboxes = spanRefs.current.map(span => {
        if (!span) return null
        const r = span.getBoundingClientRect()
        return { span, mx: r.left + r.width * 0.5, my: r.top + r.height * 0.5 }
      })

      const rot = letterRotRef.current
      const was = wasSunkRef.current

      bboxes.forEach((item, i) => {
        if (!item) return
        const { span, mx, my } = item
        const dist = Math.hypot(cx - mx, cy - my)
        const deg  = rot[i] ?? 0

        const shouldSink = overName && dist < 70

        if (shouldSink) {
          span.style.transition = 'none'
          span.style.transform  = 'translateY(45px) rotate(' + deg.toFixed(2) + 'deg)'
          span.style.opacity    = '0'
          span.style.filter     = 'blur(2px)'

          if (!was[i]) {
            was[i] = true
            const nSpawn = 3 + (Math.random() < 0.5 ? 1 : 0)
            const cap = 30 - particlesRef.current.length
            const toAdd = Math.min(nSpawn, Math.max(0, cap))
            for (let k = 0; k < toAdd; k++) {
              const el = document.createElement('div')
              el.style.cssText =
                'position:fixed;width:3px;height:3px;border-radius:50%;' +
                'background:#cc0000;opacity:0.5;pointer-events:none;z-index:9998;will-change:transform,opacity'
              el.style.left = `${mx - 1.5}px`
              el.style.top  = `${my - 1.5}px`
              host.appendChild(el)
              particlesRef.current.push({
                el,
                x: mx,
                y: my,
                vx: (Math.random() - 0.5) * 1.2,
                vy: -6 - Math.random() * 4,
                born: now,
              })
            }
          }
        } else {
          was[i] = false
          span.style.transition = SPRING
          span.style.transform  = ''
          span.style.opacity    = ''
          span.style.filter     = ''
        }
      })

      const life = 400
      const parts = particlesRef.current
      const g = 0.42
      for (let p = parts.length - 1; p >= 0; p--) {
        const pt = parts[p]
        const age = now - pt.born
        if (age >= life) {
          pt.el.remove()
          parts.splice(p, 1)
          continue
        }
        pt.vy += g
        pt.x += pt.vx
        pt.y += pt.vy
        const t = age / life
        pt.el.style.left   = `${pt.x - 1.5}px`
        pt.el.style.top    = `${pt.y - 1.5}px`
        pt.el.style.opacity = String(0.5 * (1 - t))
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <div
        ref={particleHostRef}
        aria-hidden
        style={{
          position:      'fixed',
          inset:         0,
          pointerEvents: 'none',
          zIndex:        9998,
        }}
      />
      <h1
        ref={h1Ref}
        data-hero-name=""
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
    </>
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
      <Reveal delay={0} active={active}>
        <div
          style={{
            opacity:      heroOpacity,
            transition:   'opacity 0.22s ease',
            marginBottom: '72px',
          }}
        >
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

          <PretextHero
            mode={displayMode}
            color="rgba(255,255,255,0.45)"
            accent={accent}
          />
        </div>
      </Reveal>

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

      <Reveal delay={300} active={active}>
        <EmailLink />
      </Reveal>
    </div>
  )
}
