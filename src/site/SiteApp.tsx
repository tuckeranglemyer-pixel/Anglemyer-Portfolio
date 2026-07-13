import { useEffect, useRef, useState, Fragment } from 'react'
import MagneticName from './MagneticName'
import {
  PROFILE,
  WORK,
  CODE,
  TIKTOK,
  VENTURES,
  type WorkItem,
  type CodeItem,
  type Venture,
} from './content'
import './site.css'

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── scroll-reveal ────────────────────────────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reducedMotion()) {
      el.classList.add('in')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
}

// ── count-up on reveal ───────────────────────────────────────────────────────
function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(value)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const m = value.match(/^([\d.]+)(.*)$/)
    if (!m || reducedMotion()) {
      setDisplay(value)
      return
    }
    const target = parseFloat(m[1])
    const suffix = m[2]
    const decimals = (m[1].split('.')[1] || '').length
    let started = false
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !started) {
            started = true
            const dur = 1500
            const start = performance.now()
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / dur)
              const eased = 1 - Math.pow(1 - t, 3)
              if (t < 1) {
                setDisplay((target * eased).toFixed(decimals) + suffix)
                requestAnimationFrame(tick)
              } else {
                setDisplay(value)
              }
            }
            requestAnimationFrame(tick)
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [value])
  return <span ref={ref}>{display}</span>
}

// ── live broadcast clock ─────────────────────────────────────────────────────
function fmtTime() {
  try {
    return (
      new Date().toLocaleTimeString('en-US', {
        hour12: false,
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' ET'
    )
  } catch {
    return ''
  }
}
function LiveClock() {
  const [t, setT] = useState(fmtTime)
  useEffect(() => {
    const id = setInterval(() => setT(fmtTime()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="clock">{t}</span>
}

// ── custom cursor (fine pointers only) ───────────────────────────────────────
function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    document.body.classList.add('has-custom-cursor')
    let mx = window.innerWidth / 2
    let my = window.innerHeight / 2
    let rx = mx
    let ry = my
    let raf = 0
    const move = (e: MouseEvent) => {
      mx = e.clientX
      my = e.clientY
      if (dot.current)
        dot.current.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`
    }
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      ring.current?.classList.toggle('hovering', !!t?.closest('a, button, [data-cursor]'))
    }
    const loop = () => {
      rx += (mx - rx) * 0.2
      ry += (my - ry) * 0.2
      if (ring.current)
        ring.current.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`
      raf = requestAnimationFrame(loop)
    }
    window.addEventListener('mousemove', move, { passive: true })
    window.addEventListener('mouseover', over, { passive: true })
    raf = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseover', over)
      cancelAnimationFrame(raf)
      document.body.classList.remove('has-custom-cursor')
    }
  }, [])
  return (
    <>
      <div ref={dot} className="cursor-dot" aria-hidden />
      <div ref={ring} className="cursor-ring" aria-hidden />
    </>
  )
}

const Eq = () => (
  <span className="eq" aria-hidden>
    <span />
    <span />
    <span />
    <span />
    <span />
  </span>
)

function Marquee({ items }: { items: string[] }) {
  const group = (
    <div className="marquee-item">
      {items.map((it, i) => (
        <Fragment key={i}>
          {it}
          <span>✳</span>
        </Fragment>
      ))}
    </div>
  )
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee-track">
        {group}
        {group}
      </div>
    </div>
  )
}

function SectionHeader({ index, label, note }: { index: string; label: string; note: string }) {
  return (
    <div className="section-head">
      <span className="section-index">{index}</span>
      <h2 className="section-label">{label}</h2>
      <span className="section-note">{note}</span>
    </div>
  )
}

function monogram(s: string) {
  return s.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase() || '—'
}

function WorkCard({ item, n }: { item: WorkItem; n: number }) {
  const isLink = item.url && item.url !== '#'
  const Tag = isLink ? 'a' : 'div'
  return (
    <Tag
      className={`work-card${item.placeholder ? ' is-placeholder' : ''}`}
      {...(isLink ? { href: item.url, target: '_blank', rel: 'noreferrer' } : {})}
    >
      <span className="work-num">{String(n).padStart(2, '0')}</span>
      <div className="work-thumb">
        {item.image ? (
          <img src={item.image} alt={item.title} loading="lazy" />
        ) : (
          <span className="work-monogram">{monogram(item.client || item.title)}</span>
        )}
        {item.placeholder && <span className="placeholder-flag">replace me</span>}
      </div>
      <div className="work-body">
        <div className="work-top">
          <h3 className="work-title">{item.title}</h3>
          <span className="work-year">{item.year}</span>
        </div>
        <p className="work-meta">
          {item.client} · {item.role}
        </p>
        <p className="work-blurb">{item.blurb}</p>
        <div className="tag-row">
          {item.tags.map((t) => (
            <span className="tag" key={t}>
              {t}
            </span>
          ))}
        </div>
        {isLink && <span className="work-cta">Visit site →</span>}
      </div>
    </Tag>
  )
}

function CodeRow({ item }: { item: CodeItem }) {
  return (
    <a
      className={`code-row${item.placeholder ? ' is-placeholder' : ''}`}
      href={item.url}
      target="_blank"
      rel="noreferrer"
    >
      <span className="code-kind">{item.kind}</span>
      <div className="code-main">
        <h3 className="code-title">{item.title}</h3>
        <p className="code-repo">{item.repo}</p>
        <p className="code-desc">{item.description}</p>
      </div>
      <span className="code-arrow">↗</span>
    </a>
  )
}

function VentureCard({ v }: { v: Venture }) {
  return (
    <a className="venture-card" href={v.url} target="_blank" rel="noreferrer">
      <div className="venture-top">
        <h3 className="venture-name">{v.name}</h3>
        <span className="venture-meta">{v.meta}</span>
      </div>
      <p className="venture-tagline">{v.tagline}</p>
      <p className="venture-desc">{v.description}</p>
      <div className="tag-row">
        {v.tags.map((t) => (
          <span className="tag" key={t}>
            {t}
          </span>
        ))}
      </div>
      <span className="venture-cta">Open →</span>
    </a>
  )
}

export default function SiteApp() {
  const workRef = useReveal()
  const codeRef = useReveal()
  const tiktokRef = useReveal()
  const venturesRef = useReveal()
  const contactRef = useReveal()

  useEffect(() => {
    const el = document.getElementById('loading')
    if (el) el.remove()
    const w = window as Window & { _loaderTimer?: ReturnType<typeof setTimeout> }
    if (w._loaderTimer) clearTimeout(w._loaderTimer)
  }, [])

  return (
    <div className="site">
      <div className="site-bg" aria-hidden />
      <div className="aurora a1" aria-hidden />
      <div className="aurora a2" aria-hidden />
      <div className="site-grain" aria-hidden />
      <CustomCursor />

      <header className="site-nav">
        <a className="nav-brand" href="#top">
          <span className="nav-dot" />
          TUCKER ANGLEMYER
        </a>
        <nav className="nav-links">
          <a href="#work">Work</a>
          <a href="#code">Code</a>
          <a href="#tiktok">TikTok</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <main className="site-main">
        {/* ── Hero ── */}
        <section className="hero" id="top">
          <div className="hero-status">
            <span className="live">
              <span className="nav-dot" />
              Available for work
            </span>
            <span className="sep">/</span>
            <span>Providence, RI</span>
            <span className="sep">/</span>
            <LiveClock />
            <span className="sep">/</span>
            <Eq />
          </div>
          <MagneticName text={PROFILE.name} />
          <p className="hero-lede">{PROFILE.lede}</p>
          <div className="hero-cta">
            <a className="btn btn-primary" href="#work">
              View the work
            </a>
            <a className="btn" href={PROFILE.socials[0].href} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="btn" href={TIKTOK.url} target="_blank" rel="noreferrer">
              TikTok
            </a>
          </div>
          <div className="hero-scrollcue">Scroll to explore</div>
        </section>
      </main>

      <Marquee
        items={['Client Sites', 'Open Source', 'Underground Music', 'Building in Public', 'Design & Code']}
      />

      <main className="site-main">
        {/* ── Selected Work ── */}
        <section className="section reveal" id="work" ref={workRef}>
          <SectionHeader index="01" label="Selected Work" note="Websites designed & built" />
          <div className="work-grid">
            {WORK.map((w, i) => (
              <WorkCard item={w} n={i + 1} key={i} />
            ))}
          </div>
        </section>

        {/* ── Code & Fixes ── */}
        <section className="section reveal" id="code" ref={codeRef}>
          <SectionHeader
            index="02"
            label="Code & Fixes"
            note="770 contributions this year · guides, repos & fixes"
          />
          <div className="code-list">
            {CODE.map((c, i) => (
              <CodeRow item={c} key={i} />
            ))}
          </div>
        </section>

        {/* ── TikTok ── */}
        <section className="section reveal" id="tiktok" ref={tiktokRef}>
          <SectionHeader index="03" label="TikTok" note="Where I blew up building in public" />
          <div className="tiktok-feature">
            <div className="tiktok-stats">
              <a className="tiktok-handle" href={TIKTOK.url} target="_blank" rel="noreferrer">
                {TIKTOK.handle}
              </a>
              <div className="stat-row">
                <div className="stat">
                  <span className="stat-num">
                    <CountUp value={TIKTOK.likes} />
                  </span>
                  <span className="stat-label">likes</span>
                </div>
                <div className="stat">
                  <span className="stat-num">
                    <CountUp value={TIKTOK.followers} />
                  </span>
                  <span className="stat-label">followers</span>
                </div>
              </div>
              <p className="tiktok-blurb">{TIKTOK.blurb}</p>
              <a className="btn btn-primary" href={TIKTOK.url} target="_blank" rel="noreferrer">
                Watch on TikTok →
              </a>
            </div>
            <a
              className="tiktok-featured"
              href={TIKTOK.featured.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="tiktok-featured-label">Went viral</span>
              <span className="tiktok-play">▶</span>
              <p className="tiktok-featured-caption">“{TIKTOK.featured.caption}”</p>
            </a>
          </div>
        </section>

        {/* ── Ventures ── */}
        <section className="section reveal" id="ventures" ref={venturesRef}>
          <SectionHeader index="04" label="Ventures" note="What I'm building" />
          <div className="venture-grid">
            {VENTURES.map((v, i) => (
              <VentureCard v={v} key={i} />
            ))}
          </div>
        </section>

        {/* ── Contact ── */}
        <section className="section contact reveal" id="contact" ref={contactRef}>
          <SectionHeader index="05" label="Contact" note="Let's build something" />
          <p className="contact-lead">Have a site to build, or just want to talk music?</p>
          <a className="contact-email" href={`mailto:${PROFILE.email}`}>
            {PROFILE.email}
          </a>
          <div className="contact-socials">
            {PROFILE.socials.map((s) => (
              <a href={s.href} target="_blank" rel="noreferrer" key={s.label}>
                {s.label}
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Tucker Anglemyer</span>
        <span>Providence, RI · {'◉'} Untracked</span>
      </footer>
    </div>
  )
}
