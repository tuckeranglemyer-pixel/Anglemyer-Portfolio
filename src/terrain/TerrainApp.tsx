import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { world, PIERCE_T, type Terra, type Peaks } from './world'
import './terrain.css'

const TerrainScene = lazy(() => import('./TerrainScene'))

// ── content: everything that is NOT on the main site ─────────────────────────
const PLATES = [
  { src: '/terrain/climb/ridge.jpg', cap: 'The ridge, into the cloud' },
  { src: '/terrain/climb/crest.jpg', cap: 'The crest' },
  { src: '/terrain/climb/lake.jpg', cap: 'Minnewanka, below' },
]
const BUNKER_ROWS = [
  { name: 'tuck 003', meta: 'House · 59:42', url: 'https://soundcloud.com/tuckerq/tuck-003' },
  { name: 'bay st (tucker remix)', meta: 'Deep House · 3:00', url: 'https://soundcloud.com/tuckerq' },
  { name: 'Foggy', meta: 'Dance · 1:30', url: 'https://soundcloud.com/tuckerq' },
  { name: '73.7K likes', meta: '90 followers · @tuck.angle', url: 'https://www.tiktok.com/@tuck.angle' },
  { name: 'Untracked', meta: 'Surfacing the underground · 800+ tracks', url: 'https://untrackedmusic.com' },
]
const END_LINKS = [
  { label: 'SoundCloud', href: 'https://soundcloud.com/tuckerq' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@tuck.angle' },
  { label: 'tuckerangle.com', href: '/' },
]

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60)
  return `${m}:${String(ss).padStart(2, '0')}`
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
  const hoverFrac = useRef(-1)
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
      const hf = hoverFrac.current
      for (let i = 0; i < n; i++) {
        const bh = Math.max(peaks.peaks[i] * h * 0.92, 2 * dpr)
        const near = hf >= 0 && Math.abs(i / n - hf) < 0.006
        ctx.fillStyle =
          i / n <= prog ? '#a794e8' : near ? 'rgba(167,148,232,0.9)' : 'rgba(236,233,225,0.72)'
        ctx.fillRect(i * bw, (h - bh) / 2, Math.max(bw * 0.62, 1), bh)
      }
      // ghost playhead under the cursor: teaches "this is a scrubber" before any click
      if (hf >= 0) {
        const hx = hf * w
        ctx.fillStyle = '#a794e8'
        ctx.fillRect(hx, 0, Math.max(1.5 * dpr, 1), h)
        ctx.font = `${10 * dpr}px 'Space Mono', monospace`
        const label = fmtTime(hf * peaks.duration)
        const tx = Math.min(hx + 8 * dpr, w - 44 * dpr)
        ctx.fillText(label, tx, 12 * dpr)
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
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        hoverFrac.current = (e.clientX - r.left) / r.width
      }}
      onMouseLeave={() => {
        hoverFrac.current = -1
      }}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        onSeek((e.clientX - r.left) / r.width)
      }}
    />
  )
}

// ── the artifact ──────────────────────────────────────────────────────────────
export default function TerrainApp() {
  const [terra, setTerra] = useState<Terra | null>(null)
  const [peaks, setPeaks] = useState<Peaks | null>(null)
  const [audioOn, setAudioOn] = useState(false)
  const [counted, setCounted] = useState(false)
  const [gateGone, setGateGone] = useState(false)
  const [below, setBelow] = useState(false)
  const belowRef = useRef(false)
  const wallHeadEl = useRef<HTMLSpanElement>(null)
  const ready = counted && !!terra

  useEffect(() => {
    if (!ready) return
    const id = setTimeout(() => setGateGone(true), 900)
    return () => clearTimeout(id)
  }, [ready])

  const lite = useMemo(
    () =>
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        window.matchMedia('(pointer: coarse)').matches ||
        new URLSearchParams(window.location.search).has('lite')),
    [],
  )

  const sections = useRef<(HTMLElement | null)[]>([])
  const elevEl = useRef<HTMLSpanElement>(null)
  const loaderEl = useRef<HTMLSpanElement>(null)
  const pierceEl = useRef<HTMLDivElement>(null)
  const audioEl = useRef<HTMLAudioElement>(null)
  const playProg = useRef(0)
  const bassFloor = useRef(0)
  const kickEnv = useRef(0)
  const lastKick = useRef(0)
  const dispRef = useRef<SVGFEDisplacementMapElement>(null)
  const turbRef = useRef<SVGFETurbulenceElement>(null)
  const violRef = useRef<HTMLDivElement>(null)
  const foreRef = useRef<HTMLDivElement>(null)
  const hoveringName = useRef(false)
  const chain = useRef<{
    ctx: AudioContext
    gain: GainNode
    filter: BiquadFilterNode
    analyser: AnalyserNode
    bins: Uint8Array<ArrayBuffer>
  } | null>(null)

  useEffect(() => {
    document.title = 'Summit to Bunker · Tucker Anglemyer'
    fetch('/terrain/costigan.json').then((r) => r.json()).then(setTerra)
    fetch('/terrain/tuck004-peaks.json').then((r) => r.json()).then(setPeaks)
    const loading = document.getElementById('loading')
    if (loading) loading.remove()
  }, [])

  // gate: ELEV counts 0 -> 2,973 while the mountain loads behind it
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

  // the OG name ink: dead until hovered, then a slow liquid wobble + violet fringe
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let ink = 0
    const loop = () => {
      const now = performance.now() / 1000
      const target = hoveringName.current ? 1 : 0
      ink += (target - ink) * 0.08
      const disp = dispRef.current
      const turb = turbRef.current
      const fore = foreRef.current
      const viol = violRef.current
      if (disp && turb && fore) {
        if (ink > 0.01) {
          const bx = (0.011 + 0.004 * Math.sin(now * 0.9)).toFixed(4)
          const by = (0.017 + 0.005 * Math.sin(now * 0.7 + 1.3)).toFixed(4)
          turb.setAttribute('baseFrequency', `${bx} ${by}`)
          disp.setAttribute('scale', (ink * 7).toFixed(2))
          fore.style.filter = 'url(#tink)'
          if (viol) {
            viol.style.filter = 'url(#tink)'
            viol.style.opacity = (ink * 0.8).toFixed(3)
          }
        } else {
          disp.setAttribute('scale', '0')
          fore.style.filter = 'none'
          if (viol) {
            viol.style.filter = 'none'
            viol.style.opacity = '0'
          }
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

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
        if (belowRef.current !== world.underground) {
          belowRef.current = world.underground
          setBelow(world.underground)
        }

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
          const target = 0.08 + 0.42 * Math.pow(depthProg, 1.4)
          c.gain.gain.value += (target - c.gain.gain.value) * 0.03
        }
      }
      const c = chain.current
      const audio = audioEl.current
      if (c && audio && !audio.paused) {
        c.analyser.getByteFrequencyData(c.bins)
        let sum = 0
        for (let i = 1; i <= 5; i++) sum += c.bins[i]
        const inst = sum / 5 / 255
        bassFloor.current += (inst - bassFloor.current) * 0.04
        const now = performance.now()
        if (
          inst > Math.max(bassFloor.current * 1.32, 0.16) &&
          now - lastKick.current > 220
        ) {
          kickEnv.current = 1
          lastKick.current = now
        }
        kickEnv.current *= 0.86
        world.bass = kickEnv.current * 0.92 + inst * 0.08
        playProg.current = audio.currentTime / (audio.duration || 1)
      } else {
        world.bass *= 0.94
      }
      if (wallHeadEl.current) {
        wallHeadEl.current.textContent =
          audio && !audio.paused
            ? `NOW PLAYING · TUCK 004 · ${fmtTime(audio.currentTime)} / 2:27`
            : 'TUCK 004 · DEEP HOUSE · 2:27 CUT · PRESSED 06.28.26. TAP THE WALL TO DROP IN.'
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
      gain.gain.value = 0.0001 // fade in from silence; the rAF loop ramps to target
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
    audio.currentTime = frac * (audio.duration || 147)
  }

  const bind = (i: number) => (el: HTMLElement | null) => {
    sections.current[i] = el
  }

  return (
    <div className={`terra${lite ? ' lite' : ''}`}>
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
            MOUNT COSTIGAN, ALBERTA · REAL SUMMIT DATA ▸ <span ref={loaderEl}>ELEV 0 M</span>
          </span>
          <span className="gate-sub">CLIMBED 2026 · 12 MI IN</span>
        </div>
      )}

      {/* pierce blackout */}
      <div className="terra-pierce" ref={pierceEl} aria-hidden />

      <header className="terra-nav">
        <span className="terra-brand">SUMMIT TO BUNKER</span>
        <a className="terra-home" href="/">
          BY TUCKER ANGLEMYER© ↗
        </a>
      </header>

      {/* HUD: two instruments, nothing else */}
      <aside className={`terra-hud${ready ? ' on' : ''}`} aria-hidden>
        <span className="hud-elev" ref={elevEl}>
          ELEV 2,973 M
        </span>
        <button className="hud-snd" onClick={toggleAudio}>
          {audioOn ? (below ? 'SND ▮▮' : 'SND ▮▮ · THROUGH ROCK') : 'SND ▶ TUCK 004'}
        </button>
      </aside>

      <main className="terra-main">
        {/* 00 SUMMIT */}
        <section className={`band band-summit${ready ? ' up' : ''}`} ref={bind(0)}>
          {lite && (
            <img
              className="lite-topo"
              src="/terrain/costigan-topo.jpg"
              alt=""
              aria-hidden
              loading="eager"
            />
          )}
          <div className="summit-top">
            <span className="mono-label">
              MOUNT COSTIGAN · 2,973 M · 12 MILES IN.
              <br />
              I CLIMBED THIS. YOU'RE SCROLLING THE DATA.
            </span>
          </div>
          <h1
            className="terra-monument"
            aria-label="Summit to Bunker"
            onMouseEnter={() => (hoveringName.current = true)}
            onMouseLeave={() => (hoveringName.current = false)}
          >
            <svg className="tink-defs" width="0" height="0" aria-hidden focusable="false">
              <filter id="tink" x="-15%" y="-15%" width="130%" height="130%">
                <feTurbulence
                  ref={turbRef}
                  type="fractalNoise"
                  baseFrequency="0.011 0.017"
                  numOctaves={2}
                  seed={7}
                  result="n"
                />
                <feDisplacementMap
                  ref={dispRef}
                  in="SourceGraphic"
                  in2="n"
                  scale="0"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </svg>
            <div className="tm-layer tm-viol" aria-hidden ref={violRef}>
              <span className="m-line">
                <span>Summit</span>
              </span>
              <span className="m-line">
                <span>To Bunker</span>
              </span>
            </div>
            <div className="tm-layer tm-fore" aria-hidden ref={foreRef}>
              <span className="m-line">
                <span>Summit</span>
              </span>
              <span className="m-line">
                <span>To Bunker</span>
              </span>
            </div>
          </h1>
          <div className="summit-bottom">
            <div>
              <p className="terra-eyebrow">A descent of Mount Costigan · Tucker Anglemyer</p>
              <p className="terra-lede">
                The mountain I climbed, rebuilt from its elevation data. Under it, the music I
                make. The two have nothing to do with each other. I like them both.
              </p>
            </div>
            <span className="terra-cue">Begin descent ↓</span>
          </div>
        </section>

        {/* 01 THE CLIMB */}
        <section className="band" ref={bind(1)}>
          <div className="band-inner wide">
            <span className="mono-label">01 · The climb</span>
            <h2>12 miles in.</h2>
            <p className="band-copy">
              Backpacked the Minnewanka shore, then up the ridge. Mount Costigan, 2,973 meters,
              June 2026.
            </p>
            <div className="plates">
              {PLATES.map((p) => (
                <figure className="plate" key={p.src}>
                  <img src={p.src} alt={p.cap} loading="lazy" />
                  <figcaption>{p.cap}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* THE PIERCE */}
        <section className="band band-pierce" ref={bind(2)}>
          <div className="band-inner center">
            <span className="pierce-zero">0 M</span>
            <span className="mono-label center">Past this line, the music</span>
          </div>
        </section>

        {/* 02 THE BUNKER */}
        <section className="band band-bunker" ref={bind(3)}>
          <div className="band-inner wide">
            <span className="mono-label">02 · The bunker · -22 M</span>
            <span className="mono-label wall-head" ref={wallHeadEl}>
              TUCK 004 · DEEP HOUSE · 2:27 CUT · PRESSED 06.28.26. TAP THE WALL TO DROP IN.
            </span>
            <div className="wall-wrap">
              {peaks && <WaveWall peaks={peaks} progressRef={playProg} onSeek={seek} />}
              {!audioOn && (
                <span className="wall-play" aria-hidden>
                  ▶
                </span>
              )}
            </div>
            <p className="wall-cap">The wall is the mix. 1,200 bars · 2:27. Tap anywhere.</p>
            <div className="ledger">
              {BUNKER_ROWS.map((t) => (
                <a key={t.name} className="ledger-row" href={t.url} target="_blank" rel="noreferrer">
                  <span className="lr-name sm">{t.name}</span>
                  <span className="lr-meta">{t.meta}</span>
                  <span className="lr-arrow">↗</span>
                </a>
              ))}
            </div>
            <figure className="plate plate-desk">
              <img src="/terrain/climb/decks.jpg" alt="The decks, at dusk" loading="lazy" />
              <figcaption>Where the mixes get made</figcaption>
            </figure>
          </div>
        </section>

        {/* 03 END OF LINE */}
        <section className="band band-end" ref={bind(4)}>
          <div className="band-inner">
            <span className="mono-label">03 · End of line</span>
            <h2>That's the bottom.</h2>
            <div className="end-socials">
              {END_LINKS.map((s) => (
                <a key={s.label} href={s.href} {...(s.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}>
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
              Mount Costigan · 51.2834 N 115.2854 W · © {new Date().getFullYear()}
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

      <audio ref={audioEl} src="/audio/tuck-004-clip.mp3" preload="metadata" loop />
    </div>
  )
}
