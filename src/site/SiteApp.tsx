import { useEffect, useRef } from 'react'
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

// ── scroll-reveal: fade sections up as they enter view ───────────────────────
function useReveal() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
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
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return ref
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

// ── Work card ────────────────────────────────────────────────────────────────
function WorkCard({ item }: { item: WorkItem }) {
  const isLink = item.url && item.url !== '#'
  const Tag = isLink ? 'a' : 'div'
  return (
    <Tag
      className={`work-card${item.placeholder ? ' is-placeholder' : ''}`}
      {...(isLink ? { href: item.url, target: '_blank', rel: 'noreferrer' } : {})}
    >
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

// ── Code row ─────────────────────────────────────────────────────────────────
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

// ── Venture card ─────────────────────────────────────────────────────────────
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
    // hide the index.html fast-load screen once mounted
    const el = document.getElementById('loading')
    if (el) el.remove()
    const w = window as Window & { _loaderTimer?: ReturnType<typeof setTimeout> }
    if (w._loaderTimer) clearTimeout(w._loaderTimer)
  }, [])

  return (
    <div className="site">
      <div className="site-bg" aria-hidden />
      <div className="site-grain" aria-hidden />

      <header className="site-nav">
        <a className="nav-brand" href="#top">
          TA
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
          <p className="hero-eyebrow">{PROFILE.eyebrow}</p>
          <MagneticName text={PROFILE.name} />
          <p className="hero-lede">{PROFILE.lede}</p>
          <div className="hero-cta">
            <a className="btn btn-primary" href="#work">
              View work
            </a>
            <a className="btn" href={PROFILE.socials[0].href} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="btn" href={TIKTOK.url} target="_blank" rel="noreferrer">
              TikTok
            </a>
          </div>
        </section>

        {/* ── Selected Work ── */}
        <section className="section reveal" id="work" ref={workRef}>
          <SectionHeader index="01" label="Selected Work" note="Websites I've designed & built" />
          <div className="work-grid">
            {WORK.map((w, i) => (
              <WorkCard item={w} key={i} />
            ))}
          </div>
        </section>

        {/* ── Code & Fixes ── */}
        <section className="section reveal" id="code" ref={codeRef}>
          <SectionHeader index="02" label="Code & Fixes" note="770 contributions this year · guides, repos & fixes" />
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
                  <span className="stat-num">{TIKTOK.likes}</span>
                  <span className="stat-label">likes</span>
                </div>
                <div className="stat">
                  <span className="stat-num">{TIKTOK.followers}</span>
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
        <span>Providence, RI</span>
      </footer>
    </div>
  )
}
