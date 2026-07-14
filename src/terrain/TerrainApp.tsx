import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { world, PIERCE_T, type Terra, type Peaks, type Contrib } from './world'
import './terrain.css'

const TerrainScene = lazy(() => import('./TerrainScene'))

// ── content ───────────────────────────────────────────────────────────────────
const WORK = [
  { name: 'TWO THIRTY', cls: 'Event site', year: '2025', url: 'https://twothirty.fm', beacon: { x: -14, z: -2 } },
  { name: 'UNTRACKED', cls: 'Product', year: '2025', url: 'https://untrackedmusic.com', beacon: { x: 6, z: -16 } },
  { name: 'PERKS BEER GARDEN', cls: 'Hospitality', year: '2025', url: 'https://perks-harwich-port.vercel.app/', beacon: { x: 16, z: 8 } },
]
const CODE = [
  { name: 'War Room', meta: '211 commits · 24 hours · 3 LLMs debating 31,668 review chunks', url: 'https://github.com/tuckeranglemyer-pixel/War-Room' },
  { name: 'ACE-Step on AMD (ROCm)', meta: 'Discussion #404 · people trained models off these fixes', url: 'https://github.com/ace-step/ACE-Step/discussions/404' },
  { name: 'LoKr instability writeup', meta: 'Discussion #1232 · first report of the Kronecker-path bug', url: 'https://github.com/ace-step/ACE-Step-1.5/discussions/1232' },
  { name: 'untracked-audio-engine', meta: 'The part of Untracked that does the listening', url: 'https://github.com/tuckeranglemyer-pixel/untracked-audio-engine' },
]
const BUNKER_ROWS = [
  { name: 'tuck 003', meta: 'House · 59:42', url: 'https://soundcloud.com/tuckerq/tuck-003' },
  { name: 'bay st (tucker remix)', meta: 'Deep House · 3:00', url: 'https://soundcloud.com/tuckerq' },
  { name: 'Foggy', meta: 'Dance · 1:30', url: 'https://soundcloud.com/tuckerq' },
  { name: '73.7K likes', meta: '90 followers · @tuck.angle', url: 'https://www.tiktok.com/@tuck.angle' },
  { name: 'Untracked', meta: 'Surfacing the underground · 800+ tracks', url: 'https://untrackedmusic.com' },
]
const SOCIALS = [
  { label: 'Email', href: 'mailto:tucker@untrackedmusic.com' },
  { label: 'GitHub', href: 'https://github.com/tuckeranglemyer-pixel' },
  { label: 'SoundCloud', href: 'https://soundcloud.com/tuckerq' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@tuck.angle' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/tucker-anglemyer-42a13a32b' },
]

// ── contributions ridgeline ───────────────────────────────────────────────────
function Ridgeline({ contrib }: { contrib: Contrib }) {
  const { path, peakX } = useMemo(() => {
    const days = contrib.days
    const W = 1000
    const H = 120
    const max = Math.max(...days.map((d) => d.c), 1)
    const pts: string[] = [`0,${H}`]
    let px = 0
    days.forEach((d, i) => {
      const x = (i / (days.length - 1)) * W
      const y = H - Math.sqrt(d.c / max) * (H - 8)
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
      if (d.c === max) px = x
    })
    pts.push(`${W},${H}`)
    return { path: pts.join(' '), peakX: px }
  }, [contrib])
  return (
    <div className="ridgeline">
      <svg viewBox="0 0 1000 132" preserveAspectRatio="none" aria-hidden>
        <polygon points={path} fill="#12151c" stroke="#ece9e1" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <circle cx={peakX} cy="10" r="3" fill="#a794e8" />
      </svg>
      <div className="ridgeline-cap">
        <span>
          {contrib.total} contributions · {contrib.days.filter((d) => d.c > 0).length} days on
        </span>
      </div>
    </div>
  )
}

// ── waveform wall ─────────────────────────────────────────────────────────────
function WaveWall({
  peaks,
  progressRef,
  onSeek,
}: {
  peaks: Peaks
  progressRef: React.MutableRefObject<number>
  onSeek: (frac: number) => void
}) {
  const cv = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = cv.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let raf = 0
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = canvas.clientWidth * dpr
      const h = canvas.clientHeight * dpr
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      ctx.clearRect(0, 0, w, h)
      const n = peaks.peaks.length
      const bw = w / n
      const prog = progressRef.current
      for (let i = 0; i < n; i++) {
        const bh = Math.max(peaks.peaks[i] * h * 0.92, 2 * dpr)
        ctx.fillStyle = i / n <= prog ? '#a794e8' : 'rgba(236,233,225,0.72)'
        ctx.fillRect(i * bw, (h - bh) / 2, Math.max(bw * 0.62, 1), bh)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [peaks, progressRef])
  return (
    <canvas
      ref={cv}
      className="wavewall"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        onSeek((e.clientX - r.left) / r.width)
      }}
    />
  )
}

// ── the app ───────────────────────────────────────────────────────────────────
export default function TerrainApp() {
  const [terra, setTerra] = useState<Terra | null>(null)
  const [peaks, setPeaks] = useState<Peaks | null>(null)
  const [contrib, setContrib] = useState<Contrib | null>(null)
  const [audioOn, setAudioOn] = useState(false)
  const [counted, setCounted] = useState(false)
  const [gateGone, setGateGone] = useState(false)
  const ready = counted && !!terra

  // unmount the gate after its fade: overlay-killing browser extensions
  // (cookie-banner blockers) can pin a fixed overlay's styles with
  // !important, so removal must not depend on CSS.
  useEffect(() => {
    if (!ready) return
    const id = setTimeout(() => setGateGone(true), 900)
    return () => clearTimeout(id)
  }, [ready])

  const lite = useMemo(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        window.matchMedia('(pointer: coarse)').matches),
    [],
  )

  const sections = useRef<(HTMLElement | null)[]>([])
  const elevEl = useRef<HTMLSpanElement>(null)
  const loaderEl = useRef<HTMLSpanElement>(null)
  const pierceEl = useRef<HTMLDivElement>(null)
  const audioEl = useRef<HTMLAudioElement>(null)
  const playProg = useRef(0)
  const chain = useRef<{
    ctx: AudioContext
    gain: GainNode
    filter: BiquadFilterNode
    analyser: AnalyserNode
    bins: Uint8Array
  } | null>(null)

  useEffect(() => {
    fetch('/terrain/costigan.json').then((r) => r.json()).then(setTerra)
    fetch('/terrain/tuck004-peaks.json').then((r) => r.json()).then(setPeaks)
    fetch('/terrain/contributions.json').then((r) => r.json()).then(setContrib)
    const loading = document.getElementById('loading')
    if (loading) loading.remove()
  }, [])

  // preloader: ELEV counts 0 -> 2,973 while the terrain loads behind it
  useEffect(() => {
    const dur = 1500
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      if (loaderEl.current)
        loaderEl.current.textContent = `ELEV ${Math.round(2973 * eased).toLocaleString()} M`
      if (t < 1) raf = requestAnimationFrame(tick)
      else setCounted(true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // staggered band reveals
  useEffect(() => {
    if (!ready) return
    const els = document.querySelectorAll('.band-inner')
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach((el) => el.classList.add('in'))
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
      { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [ready])

  // scroll -> world.t, HUD, pierce blackout, audio depth
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const els = sections.current.filter(Boolean) as HTMLElement[]
      if (els.length >= 2) {
        const mid = window.scrollY + window.innerHeight * 0.5
        const centers = els.map((el) => el.offsetTop + el.offsetHeight / 2)
        let t = 0
        if (mid <= centers[0]) t = 0
        else if (mid >= centers[centers.length - 1]) t = centers.length - 1
        else {
          for (let i = 0; i < centers.length - 1; i++) {
            if (mid >= centers[i] && mid < centers[i + 1]) {
              t = i + (mid - centers[i]) / (centers[i + 1] - centers[i])
              break
            }
          }
        }
        world.t = t
        world.underground = t >= PIERCE_T

        if (elevEl.current) {
          if (t < PIERCE_T) {
            const elev = Math.round(2973 - (t / PIERCE_T) * (2973 - 1475))
            elevEl.current.textContent = `ELEV ${elev.toLocaleString()} M`
            elevEl.current.classList.remove('neg')
          } else {
            const depth = Math.round(((t - PIERCE_T) / 2) * 42)
            elevEl.current.textContent = `DEPTH -${depth} M`
            elevEl.current.classList.add('neg')
          }
        }
        if (pierceEl.current) {
          const rise = Math.min(1, Math.max(0, (t - (PIERCE_T - 0.62)) / 0.34))
          const fall = 1 - Math.min(1, Math.max(0, (t - (PIERCE_T + 0.08)) / 0.3))
          pierceEl.current.style.opacity = String(Math.min(rise, fall))
        }
        const c = chain.current
        if (c) {
          const depthProg = Math.min(1, t / PIERCE_T)
          c.filter.frequency.value = world.underground ? 18000 : 120 * Math.pow(150, depthProg)
          c.gain.gain.value = 0.14 + 0.8 * Math.pow(depthProg, 1.4)
        }
      }
      const c = chain.current
      const audio = audioEl.current
      if (c && audio && !audio.paused) {
        c.analyser.getByteFrequencyData(c.bins)
        let sum = 0
        for (let i = 1; i <= 6; i++) sum += c.bins[i]
        world.bass += (sum / 6 / 255 - world.bass) * 0.25
        playProg.current = audio.currentTime / (audio.duration || 1)
      } else {
        world.bass *= 0.94
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const enableAudio = () => {
    const audio = audioEl.current
    if (!audio) return
    if (!chain.current) {
      const ctx = new AudioContext()
      const src = ctx.createMediaElementSource(audio)
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 140
      const gain = ctx.createGain()
      gain.gain.value = 0.15
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      src.connect(filter)
      filter.connect(gain)
      gain.connect(analyser)
      analyser.connect(ctx.destination)
      chain.current = { ctx, gain, filter, analyser, bins: new Uint8Array(analyser.frequencyBinCount) }
    }
    chain.current.ctx.resume()
    audio.play()
    setAudioOn(true)
  }
  const toggleAudio = () => {
    const audio = audioEl.current
    if (!audio) return
    if (audio.paused) enableAudio()
    else {
      audio.pause()
      setAudioOn(false)
    }
  }
  const seek = (frac: number) => {
    const audio = audioEl.current
    if (!audio) return
    if (audio.paused) enableAudio()
    audio.currentTime = frac * (audio.duration || 1118)
  }

  const setBeacon = (b: { x: number; z: number } | null) => {
    if (b) {
      world.beacon.x = b.x
      world.beacon.z = b.z
      world.beacon.i = 1.4
    } else world.beacon.i = 0
  }

  const bind = (i: number) => (el: HTMLElement | null) => {
    sections.current[i] = el
  }

  return (
    <div className="terra">
      {terra && !lite && (
        <div className="terra-canvas-wrap" aria-hidden>
          <Suspense fallback={null}>
            <TerrainScene terra={terra} />
          </Suspense>
        </div>
      )}

      {/* the gate: elevation counts up while the mountain arrives */}
      {!gateGone && (
        <div className={`summit-gate${ready ? ' done' : ''}`} aria-hidden={ready}>
          <span className="gate-line">
            MOUNT COSTIGAN ▸ <span ref={loaderEl}>ELEV 0 M</span>
          </span>
        </div>
      )}

      {/* pierce blackout */}
      <div className="terra-pierce" ref={pierceEl} aria-hidden />

      <header className="terra-nav">
        <a className="terra-brand" href="/">
          TUCKER ANGLEMYER©
        </a>
        <div className="terra-nav-right">
          <span className="terra-tag">TERRAIN · V2 DRAFT</span>
          <a href="/">current site ↗</a>
        </div>
      </header>

      {/* HUD: three instruments, nothing else */}
      <aside className={`terra-hud${ready ? ' on' : ''}`} aria-hidden>
        <span className="hud-elev" ref={elevEl}>
          ELEV 2,973 M
        </span>
        <span className="hud-right">
          <span className="hud-live">
            <span className="hud-dot" />
            AVAILABLE
          </span>
          <button className="hud-snd" onClick={toggleAudio}>
            {audioOn ? 'SND ▮▮' : 'SND ▶'}
          </button>
        </span>
      </aside>

      <main className="terra-main">
        {/* 00 SUMMIT */}
        <section className={`band band-summit${ready ? ' up' : ''}`} ref={bind(0)}>
          <div className="summit-top">
            <span className="mono-label">MOUNT COSTIGAN · 2,973 M · 12 MILES IN</span>
          </div>
          <h1 className="terra-monument">
            <span className="m-line">
              <span>Tucker</span>
            </span>
            <span className="m-line">
              <span>Anglemyer</span>
            </span>
          </h1>
          <div className="summit-bottom">
            <div>
              <p className="terra-eyebrow">Providence College · Incoming PwC · Founder, Untracked</p>
              <p className="terra-lede">
                I build sites and ship code. I run Untracked, working to surface the underground.
              </p>
            </div>
            <span className="terra-cue">Begin descent ↓</span>
          </div>
        </section>

        {/* 01 THE WORK */}
        <section className="band" ref={bind(1)}>
          <div className="band-inner wide">
            <span className="mono-label">01 · The work</span>
            <div className="ledger">
              {WORK.map((w) => (
                <a
                  key={w.name}
                  className="ledger-row"
                  href={w.url}
                  target="_blank"
                  rel="noreferrer"
                  onMouseEnter={() => setBeacon(w.beacon)}
                  onMouseLeave={() => setBeacon(null)}
                >
                  <span className="lr-name">{w.name}</span>
                  <span className="lr-meta">
                    {w.cls} · {w.year}
                  </span>
                  <span className="lr-arrow">↗</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* 02 THE CODE */}
        <section className="band" ref={bind(2)}>
          <div className="band-inner wide">
            <span className="mono-label">02 · The code</span>
            {contrib && <Ridgeline contrib={contrib} />}
            <div className="ledger">
              {CODE.map((c) => (
                <a key={c.name} className="ledger-row" href={c.url} target="_blank" rel="noreferrer">
                  <span className="lr-name sm">{c.name}</span>
                  <span className="lr-meta">{c.meta}</span>
                  <span className="lr-arrow">↗</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* THE PIERCE */}
        <section className="band band-pierce" ref={bind(3)}>
          <div className="band-inner center">
            <span className="pierce-zero">0 M</span>
            <span className="mono-label center">Working to surface the underground</span>
          </div>
        </section>

        {/* 03 THE BUNKER */}
        <section className="band band-bunker" ref={bind(4)}>
          <div className="band-inner wide">
            <span className="mono-label">03 · The bunker</span>
            <span className="mono-label wall-head">
              NOW PLAYING · TUCK 004 · DEEP HOUSE · 18:38 · PRESSED 06.28.26
            </span>
            {peaks && <WaveWall peaks={peaks} progressRef={playProg} onSeek={seek} />}
            <div className="ledger">
              {BUNKER_ROWS.map((t) => (
                <a key={t.name} className="ledger-row" href={t.url} target="_blank" rel="noreferrer">
                  <span className="lr-name sm">{t.name}</span>
                  <span className="lr-meta">{t.meta}</span>
                  <span className="lr-arrow">↗</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* 04 END OF LINE */}
        <section className="band band-end" ref={bind(5)}>
          <div className="band-inner">
            <span className="mono-label">04 · End of line</span>
            <a className="end-email" href="mailto:tucker@untrackedmusic.com">
              tucker@untrackedmusic.com
            </a>
            <div className="end-socials">
              {SOCIALS.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer">
                  {s.label} ↗
                </a>
              ))}
            </div>
            <button
              className="end-return"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              Return to summit ↑
            </button>
            <p className="end-coords">
              Providence, RI · 41.82 N 71.41 W · © {new Date().getFullYear()}
            </p>
            <span className="friar" title="the friar · 12 mi in" aria-label="a friar">
              <svg viewBox="0 0 24 32" aria-hidden>
                <path d="M12 2c-4.4 0-7 3.2-7 7.2v3.2c0 1.2.6 2.2 1.5 2.8L5 30h14l-1.5-14.8c.9-.6 1.5-1.6 1.5-2.8V9.2C19 5.2 16.4 2 12 2z" />
                <circle cx="12" cy="9.5" r="3.2" fill="#0b0d11" />
              </svg>
            </span>
          </div>
        </section>
      </main>

      <audio ref={audioEl} src="/audio/tuck-004.mp3" preload="metadata" loop />
    </div>
  )
}
