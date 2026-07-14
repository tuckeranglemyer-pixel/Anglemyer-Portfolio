import { useEffect, useRef, useState } from 'react'
import {
  PROFILE,
  WORK,
  CODE,
  TIKTOK,
  VENTURES,
} from './content'
import './site.css'

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── scroll reveal ────────────────────────────────────────────────────────────
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
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
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
            const dur = 1600
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
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [value])
  return <span ref={ref}>{display}</span>
}

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

// ── thin ring cursor (fine pointers only) ────────────────────────────────────
function RingCursor() {
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
    }
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      ring.current?.classList.toggle('hovering', !!t?.closest('a, button, [data-cursor]'))
    }
    const loop = () => {
      rx += (mx - rx) * 0.22
      ry += (my - ry) * 0.22
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
  return <div ref={ring} className="cursor-ring" aria-hidden />
}

function Monument({ lines }: { lines: string[] }) {
  const ghostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches || reducedMotion()) return
    let raf = 0
    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0
    const onMove = (e: MouseEvent) => {
      cx = e.clientX / window.innerWidth - 0.5
      cy = e.clientY / window.innerHeight - 0.5
    }
    const loop = () => {
      tx += (cx * 46 - tx) * 0.06
      ty += (cy * 26 - ty) * 0.06
      if (ghostRef.current)
        ghostRef.current.style.transform = `scale(1.1) translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`
      raf = requestAnimationFrame(loop)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    raf = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])
  const renderLines = () =>
    lines.map((l, i) => (
      <span className="monument-line" key={i}>
        <span>{l}</span>
      </span>
    ))
  return (
    <h1 className="monument" aria-label={lines.join(' ')}>
      <div className="monument-layer monument-ghost" aria-hidden ref={ghostRef}>
        {renderLines()}
      </div>
      <div className="monument-layer monument-fore" aria-hidden>
        {renderLines()}
      </div>
    </h1>
  )
}

// ── generic brutalist index row ──────────────────────────────────────────────
function IndexRow({
  num,
  name,
  sub,
  meta,
  href,
  placeholder,
  flag,
  nameSm,
}: {
  num: string
  name: string
  sub?: string
  meta?: string[]
  href?: string
  placeholder?: boolean
  flag?: string
  nameSm?: boolean
}) {
  const Tag = href ? 'a' : 'div'
  return (
    <Tag
      className={`index-row${placeholder ? ' index-placeholder' : ''}`}
      {...(href ? { href, target: '_blank', rel: 'noreferrer' } : {})}
    >
      <span className="index-num">{num}</span>
      <div className="index-main">
        <h3 className={`index-name${nameSm ? ' sm' : ''}`}>{name}</h3>
        {sub && <p className="index-sub">{sub}</p>}
      </div>
      <div className="index-meta">
        {flag && <span className="index-flag">{flag}</span>}
        {meta?.map((m, i) => (
          <span key={i}>{m}</span>
        ))}
        {href && <span className="index-arrow">↗</span>}
      </div>
    </Tag>
  )
}

const pad2 = (n: number) => String(n).padStart(2, '0')

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
      <RingCursor />

      <header className="site-nav">
        <a className="nav-brand" href="#top">
          TUCKER ANGLEMYER©
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
          <div className="hero-top">
            <span className="live">
              <span className="dot" />
              Available for work
            </span>
            <span>
              Providence, RI &nbsp;/&nbsp; <LiveClock />
            </span>
          </div>

          <Monument lines={['Tucker', 'Anglemyer']} />

          <div className="hero-bottom">
            <div className="hero-lede-wrap">
              <p className="hero-eyebrow">{PROFILE.eyebrow}</p>
              <p className="hero-lede">{PROFILE.lede}</p>
            </div>
            <span className="hero-cue">Scroll ↓</span>
          </div>
        </section>

        {/* ── Selected Work ── */}
        <section className="section reveal" id="work" ref={workRef}>
          <div className="section-head">
            <span className="tag-label">01 — Websites, designed &amp; built</span>
            <h2 className="section-label">Selected Work</h2>
          </div>
          <div className="index-list">
            {WORK.map((w, i) => (
              <IndexRow
                key={i}
                num={pad2(i + 1)}
                name={w.title}
                sub={w.blurb}
                meta={[`${w.role} · ${w.year}`, w.tags.join(' · ')]}
                href={w.url && w.url !== '#' ? w.url : undefined}
                placeholder={w.placeholder}
                flag={w.placeholder ? 'Add site' : undefined}
              />
            ))}
          </div>
        </section>

        {/* ── Code & Fixes ── */}
        <section className="section reveal" id="code" ref={codeRef}>
          <div className="section-head">
            <span className="tag-label">02 — 770 contributions this year</span>
            <h2 className="section-label">Code &amp; Fixes</h2>
          </div>
          <div className="index-list">
            {CODE.map((c, i) => (
              <IndexRow
                key={i}
                num={pad2(i + 1)}
                name={c.title}
                nameSm
                sub={c.description}
                meta={[c.kind, c.repo]}
                href={c.url}
              />
            ))}
          </div>
        </section>

        {/* ── TikTok ── */}
        <section className="section reveal" id="tiktok" ref={tiktokRef}>
          <div className="section-head">
            <span className="tag-label">03 — Where I blew up building in public</span>
            <h2 className="section-label">TikTok</h2>
          </div>
          <div className="tiktok-body">
            <div className="tiktok-stat">
              <span className="tiktok-bignum">
                <CountUp value={TIKTOK.likes} />
              </span>
              <div className="tiktok-statmeta">
                Likes
                <br />
                {TIKTOK.followers} followers
                <br />
                <a href={TIKTOK.url} target="_blank" rel="noreferrer">
                  {TIKTOK.handle}
                </a>
              </div>
            </div>
            <p className="tiktok-quote">{TIKTOK.blurb}</p>
            <a className="tiktok-watch" href={TIKTOK.url} target="_blank" rel="noreferrer">
              Watch on TikTok ↗
            </a>
          </div>
        </section>

        {/* ── Ventures ── */}
        <section className="section reveal" id="ventures" ref={venturesRef}>
          <div className="section-head">
            <span className="tag-label">04 — What I'm building</span>
            <h2 className="section-label">Ventures</h2>
          </div>
          <div className="index-list">
            {VENTURES.map((v, i) => (
              <IndexRow
                key={i}
                num={pad2(i + 1)}
                name={v.name}
                sub={`${v.tagline} — ${v.description}`}
                meta={[v.meta, v.tags.join(' · ')]}
                href={v.url}
              />
            ))}
          </div>
        </section>

        {/* ── Contact ── */}
        <section className="section reveal" id="contact" ref={contactRef}>
          <div className="section-head">
            <span className="tag-label">05 — Available for work</span>
          </div>
          <p className="contact-lead">Let's build something.</p>
          <a className="contact-email" href={`mailto:${PROFILE.email}`}>
            {PROFILE.email}
          </a>
          <div className="contact-socials">
            {PROFILE.socials.map((s) => (
              <a href={s.href} target="_blank" rel="noreferrer" key={s.label}>
                {s.label} ↗
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Tucker Anglemyer</span>
        <span>Providence, RI — 41.82°N 71.41°W</span>
      </footer>
    </div>
  )
}
