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
// Letters within 80px of the fin are violently dragged underwater:
//   translateY 40-80px · scale → 0.3 · opacity → 0 · random ±15° tumble.
// On fin exit each letter bobs back with an easeOutElastic spring (800ms).
// Splash particles (white + blood-red circles) erupt from each letter as
// it first crosses the pull threshold, then arc down under gravity.
type SplashParticle = {
  el: HTMLDivElement
  x: number; y: number
  vx: number; vy: number
  born: number
}

function HeroName({ name, style }: { name: string; style: CSSProperties }) {
  const h1Ref         = useRef<HTMLHeadingElement>(null)
  const spanRefs      = useRef<(HTMLSpanElement | null)[]>([])
  const splashContRef = useRef<HTMLDivElement>(null)
  const chars         = Array.from(name)

  // Per-letter stable randomisation — re-seeded on name change
  const letterData = useRef<{ rot: number; dy: number }[]>([])
  const wasSunkRef = useRef<boolean[]>([])
  useEffect(() => {
    const cs = Array.from(name)
    letterData.current = cs.map(() => ({
      rot: (Math.random() - 0.5) * 30,   // ±15 ° tumble
      dy:  40 + Math.random() * 40,       // 40–80 px violent sink
    }))
    wasSunkRef.current = cs.map(() => false)
  }, [name])

  const cursorRef     = useRef({ x: -9999, y: -9999 })
  const inHeroRef     = useRef(false)
  const prevInHeroRef = useRef(false)
  const splashRef     = useRef<SplashParticle[]>([])
  const rafRef        = useRef(0)

  useEffect(() => {
    // Non-null assertions: refs are guaranteed set by mount time;
    // the guard below provides runtime safety in case of edge cases.
    const h1   = h1Ref.current!
    const cont = splashContRef.current!
    if (!h1 || !cont) return

    // Inject shake keyframe (2px amplitude, 150ms one-shot on fin entry)
    const shakeEl = document.createElement('style')
    shakeEl.textContent =
      '@keyframes heroShake{' +
      '0%,100%{transform:translate(0,0)}' +
      '20%{transform:translate(-2px,-1px)}' +
      '40%{transform:translate(2px,1px)}' +
      '60%{transform:translate(-1px,2px)}' +
      '80%{transform:translate(1px,-1px)}}'
    document.head.appendChild(shakeEl)

    const onMouseMove  = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY }
      inHeroRef.current = true
    }
    const onMouseLeave = () => { inHeroRef.current = false }
    h1.addEventListener('mousemove',  onMouseMove,  { passive: true })
    h1.addEventListener('mouseleave', onMouseLeave)

    const MAX_SPLASH = 40

    // Spawn 4-6 particles per letter crossing the pull threshold.
    // They shoot mostly upward then fall under gravity over 400ms.
    function spawnSplash(sx: number, sy: number) {
      const count = 4 + Math.floor(Math.random() * 3)
      for (let k = 0; k < count; k++) {
        if (splashRef.current.length >= MAX_SPLASH) break
        const isBlood = Math.random() < 0.4
        const color   = isBlood ? 'rgba(204,0,0,0.9)' : 'rgba(255,255,255,0.85)'
        const el      = document.createElement('div')
        el.style.cssText =
          'position:absolute;top:0;left:0;width:3px;height:3px;border-radius:50%;' +
          `background:${color};pointer-events:none;will-change:transform,opacity;`
        cont.appendChild(el)
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.2
        const spd = 2.5 + Math.random() * 4.5
        splashRef.current.push({
          el, x: sx, y: sy,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          born: performance.now(),
        })
      }
    }

    function tick() {
      const { x: cx, y: cy } = cursorRef.current
      const inHero            = inHeroRef.current
      const now               = performance.now()

      // Screen shake fires once on fin entry
      if (inHero && !prevInHeroRef.current) {
        h1.style.animation = 'heroShake 150ms ease-out'
        setTimeout(() => { if (h1) h1.style.animation = '' }, 160)
      }
      prevInHeroRef.current = inHero

      // Only do expensive work when there's something to animate
      if (inHero || splashRef.current.length > 0) {
        // Batch reads first to avoid layout thrashing
        const bboxes = spanRefs.current.map((span, i) => {
          if (!span) return null
          const r  = span.getBoundingClientRect()
          const ld = letterData.current[i] ?? { rot: 0, dy: 50 }
          return { span, i, mx: r.left + r.width * 0.5, my: r.top + r.height * 0.5, ld }
        })

        // Batch writes
        bboxes.forEach(item => {
          if (!item) return
          const { span, i, mx, my, ld } = item

          if (!inHero) {
            // Cursor left — spring all sunk letters back to the surface
            if (wasSunkRef.current[i]) {
              wasSunkRef.current[i] = false
              span.style.transition = 'transform 0.8s cubic-bezier(0.34,1.56,0.64,1), opacity 0.8s ease-out, filter 0.8s ease-out'
              span.style.transform  = ''
              span.style.opacity    = ''
              span.style.filter     = ''
            }
            return
          }

          const dist   = Math.hypot(cx - mx, cy - my)
          const RADIUS = 80
          const t      = Math.max(0, 1 - dist / RADIUS)

          if (t > 0) {
            // Violent underwater pull — no transition while sinking
            span.style.transition = 'none'
            span.style.transform  =
              `translateY(${(ld.dy * t).toFixed(1)}px) ` +
              `scale(${(1 - 0.7 * t).toFixed(3)}) ` +
              `rotate(${(ld.rot * t).toFixed(1)}deg)`
            span.style.opacity    = Math.max(0, 1 - t).toFixed(3)
            span.style.filter     = `blur(${(t * 2).toFixed(2)}px)`
            // Trigger splash the first time a letter crosses the threshold
            if (!wasSunkRef.current[i] && t > 0.35) {
              wasSunkRef.current[i] = true
              spawnSplash(mx, my)
            }
          } else if (wasSunkRef.current[i]) {
            // Letter drifted outside radius — elastic float-back
            wasSunkRef.current[i] = false
            span.style.transition = 'transform 0.8s cubic-bezier(0.34,1.56,0.64,1), opacity 0.8s ease-out, filter 0.8s ease-out'
            span.style.transform  = ''
            span.style.opacity    = ''
            span.style.filter     = ''
          }
        })

        // Advance + age splash particles
        for (let i = splashRef.current.length - 1; i >= 0; i--) {
          const p   = splashRef.current[i]
          const age = now - p.born
          if (age >= 400) {
            p.el.remove()
            splashRef.current.splice(i, 1)
            continue
          }
          p.x  += p.vx
          p.y  += p.vy
          p.vy += 0.35    // gravity
          p.vx *= 0.97    // air drag
          const frac = age / 400
          p.el.style.transform = `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`
          p.el.style.opacity   = (0.85 * (1 - frac * frac)).toFixed(3)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      h1.removeEventListener('mousemove',  onMouseMove)
      h1.removeEventListener('mouseleave', onMouseLeave)
      document.head.removeChild(shakeEl)
      splashRef.current.forEach(p => p.el.remove())
      splashRef.current.length = 0
    }
  }, [])

  return (
    <>
      {/* Fixed splash container — outside h1's stacking context so particles
          can fly above/below the heading without being clipped */}
      <div
        ref={splashContRef}
        style={{
          position:      'fixed',
          top:           0,
          left:          0,
          width:         0,
          height:        0,
          overflow:      'visible',
          pointerEvents: 'none',
          zIndex:        9996,
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
              willChange: 'transform, opacity, filter',
              // Default spring-back transition; overridden to 'none' while sinking
              transition: 'transform 0.8s cubic-bezier(0.34,1.56,0.64,1), opacity 0.8s ease-out, filter 0.8s ease-out',
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
        link={{ label: 'untrackedmusic.com', href: 'https://untrackedmusic.com' }}
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
