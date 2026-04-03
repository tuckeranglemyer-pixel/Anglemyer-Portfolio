import {
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
  type RefObject,
} from 'react'

const CYCLE_IMAGES = [
  '/textures/cycle/01.jpg',
  '/textures/cycle/02.jpeg',
  '/textures/cycle/03.png',
  '/textures/cycle/04.jpg',
  '/textures/cycle/05.jpg',
  '/textures/cycle/06.jpg',
  '/textures/cycle/07.jpg',
  '/textures/cycle/08.webp',
  '/textures/cycle/09.jpeg',
  '/textures/cycle/10.jpg',
  '/textures/cycle/11.jpg',
  '/textures/cycle/12.webp',
  '/textures/cycle/13.webp',
  '/textures/cycle/14.webp',
  '/textures/cycle/15.webp',
  '/textures/cycle/16.webp',
  '/textures/cycle/17.webp',
  '/textures/cycle/18.webp',
  '/textures/cycle/19.webp',
  '/textures/cycle/20.webp',
  '/textures/cycle/21.webp',
  '/textures/cycle/22.webp',
  '/textures/cycle/23.webp',
  '/textures/cycle/24.webp',
  '/textures/cycle/25.webp',
  '/textures/cycle/26.webp',
  '/textures/cycle/27.jpeg',
  '/textures/cycle/28.jpeg',
  '/textures/cycle/29.jpeg',
  '/textures/cycle/30.jpeg',
  '/textures/cycle/31.jpeg',
  '/textures/cycle/32.jpeg',
  '/textures/cycle/33.png',
  '/textures/cycle/34.jpg',
  '/textures/cycle/35.webp',
  '/textures/cycle/36.jpg',
  '/textures/cycle/37.jpg',
  '/textures/cycle/38.jpg',
  '/textures/cycle/39.jpg',
] as const

type CycleUrl = (typeof CYCLE_IMAGES)[number]

const FAST_MS = 80
const SETTLE_DELAYS_MS = [150, 250, 400, 600, 900] as const
const HOLD_LAST_MS = 500
const INTRO_MS = 400
const FLY_MS = 800
const FLY_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'

function rootRemPx(): number {
  if (typeof document === 'undefined') return 16
  const fs = getComputedStyle(document.documentElement).fontSize
  return parseFloat(fs) || 16
}

function clampHeroFontPx(minRem: number, vwPercent: number, maxRem: number): number {
  if (typeof window === 'undefined') {
    return minRem * rootRemPx()
  }
  const root = rootRemPx()
  const minPx = minRem * root
  const maxPx = maxRem * root
  const preferred = (vwPercent / 100) * window.innerWidth
  return Math.min(maxPx, Math.max(minPx, preferred))
}

const CRE_FONT_SIZE_SCALE = 0.85

/** Matches PretextHero creSpec / `.hero-cycle-h1--cre` for ANGLEMYER landing size. */
function creHeroFontPx(): number {
  return clampHeroFontPx(6, 26, 22) * CRE_FONT_SIZE_SCALE
}

function randomBgPos(): string {
  const x = 50 + (Math.random() * 20 - 10)
  const y = 50 + (Math.random() * 20 - 10)
  return `${x.toFixed(1)}% ${y.toFixed(1)}%`
}

function pickFiveRandomImages(): CycleUrl[] {
  const out: CycleUrl[] = []
  for (let i = 0; i < 5; i++) {
    out.push(CYCLE_IMAGES[Math.floor(Math.random() * CYCLE_IMAGES.length)]!)
  }
  return out
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('aborted', 'AbortError'))
      return
    }
    const t = window.setTimeout(() => {
      if (signal.aborted) reject(new DOMException('aborted', 'AbortError'))
      else resolve()
    }, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

type FlySnap = {
  top: number
  left: number
  width: number
  height: number
  fontPx: number
  clipOp: number
  solidOp: number
  scrimOp: number
  transitioning: boolean
}

const flyBoxTransition = (ms: number) =>
  `top ${ms}ms ${FLY_EASE}, left ${ms}ms ${FLY_EASE}, width ${ms}ms ${FLY_EASE}, height ${ms}ms ${FLY_EASE}, font-size ${ms}ms ${FLY_EASE}`

export type IdentityCycleProps = {
  active: boolean
  onComplete: () => void
  /** Reveal MainContent / start fly — MainContent fades 0→1 over the same 0.8s. */
  onCrossfadeStart?: () => void
  heroContainerRef: RefObject<HTMLDivElement | null>
}

export default function IdentityCycle({
  active,
  onComplete,
  onCrossfadeStart,
  heroContainerRef,
}: IdentityCycleProps) {
  const [bgUrl, setBgUrl] = useState<CycleUrl>(CYCLE_IMAGES[0])
  const [bgPos, setBgPos] = useState('50% 50%')
  const layerOpacity = 1
  const [introIn, setIntroIn] = useState(false)
  const [phase, setPhase] = useState<'cycle' | 'fly'>('cycle')
  const [flySnap, setFlySnap] = useState<FlySnap | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const onCompleteRef = useRef(onComplete)
  const onCrossfadeRef = useRef(onCrossfadeStart)
  const cycleTextWrapRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    onCompleteRef.current = onComplete
    onCrossfadeRef.current = onCrossfadeStart
  }, [onComplete, onCrossfadeStart])

  useEffect(() => {
    for (const url of CYCLE_IMAGES) {
      const img = new Image()
      img.src = url
    }
  }, [])

  useEffect(() => {
    if (!active) return
    setIntroIn(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIntroIn(true))
    })
    return () => cancelAnimationFrame(id)
  }, [active])

  useEffect(() => {
    if (!active) return

    const ac = new AbortController()
    abortRef.current = ac
    const { signal } = ac

    ;(async () => {
      try {
        await delay(INTRO_MS, signal)

        for (let i = 0; i < CYCLE_IMAGES.length; i++) {
          setBgUrl(CYCLE_IMAGES[i]!)
          setBgPos(randomBgPos())
          if (i < CYCLE_IMAGES.length - 1) await delay(FAST_MS, signal)
        }

        const finals = pickFiveRandomImages()
        for (let i = 0; i < finals.length; i++) {
          setBgUrl(finals[i]!)
          setBgPos(randomBgPos())
          await delay(SETTLE_DELAYS_MS[i]!, signal)
        }

        await delay(HOLD_LAST_MS, signal)

        const heroEl = heroContainerRef.current
        const cycleWrap = cycleTextWrapRef.current
        const h1El = cycleWrap?.querySelector('h1')

        if (!heroEl || !cycleWrap || !h1El) {
          onCrossfadeRef.current?.()
          onCompleteRef.current()
          return
        }

        const startRect = cycleWrap.getBoundingClientRect()
        const targetRect = heroEl.getBoundingClientRect()
        const startFontPx = parseFloat(getComputedStyle(h1El).fontSize)
        const targetFontPx = creHeroFontPx()

        onCrossfadeRef.current?.()

        const fromSnap: FlySnap = {
          top: startRect.top,
          left: startRect.left,
          width: startRect.width,
          height: startRect.height,
          fontPx: startFontPx,
          clipOp: 1,
          solidOp: 0,
          scrimOp: 1,
          transitioning: false,
        }

        const toSnap: FlySnap = {
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          fontPx: targetFontPx,
          clipOp: 0,
          solidOp: 1,
          scrimOp: 0,
          transitioning: true,
        }

        setPhase('fly')
        setFlySnap(fromSnap)

        await new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setFlySnap(toSnap)
              resolve()
            })
          })
        })

        await delay(FLY_MS, signal)
        onCompleteRef.current()
      } catch (e) {
        if ((e as Error).name !== 'AbortError') throw e
      }
    })().catch(() => {})

    return () => {
      ac.abort()
      abortRef.current = null
    }
  }, [active, heroContainerRef])

  if (!active) return null

  if (phase === 'fly' && flySnap) {
    const s = flySnap
    const boxTransition = s.transitioning ? flyBoxTransition(FLY_MS) : 'none'
    const opTransition = s.transitioning ? `opacity ${FLY_MS}ms ${FLY_EASE}` : 'none'

    return (
      <>
        <div
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99,
            background: 'rgba(0,0,0,0.3)',
            opacity: s.scrimOp,
            transition: opTransition,
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'fixed',
            top: s.top,
            left: s.left,
            width: s.width,
            height: s.height,
            zIndex: 100,
            fontSize: `${s.fontPx}px`,
            transition: boxTransition,
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
            }}
          >
            <h1
              className="hero-cycle-h1 hero-cycle-h1--cre identity-cycle-h1"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                margin: 0,
                lineHeight: 0.85,
                WebkitTextFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                backgroundSize: '200%',
                backgroundPosition: bgPos,
                backgroundImage: `url(${bgUrl})`,
                opacity: s.clipOp,
                transition: opTransition,
                fontSize: 'inherit',
              }}
            >
              ANGLEMYER
            </h1>
            <h1
              className="hero-cycle-h1 hero-cycle-h1--cre"
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                margin: 0,
                lineHeight: 0.85,
                color: 'rgba(255,255,255,0.92)',
                WebkitTextFillColor: 'rgba(255,255,255,0.92)',
                opacity: s.solidOp,
                transition: opTransition,
                fontSize: 'inherit',
                pointerEvents: 'none',
              }}
            >
              ANGLEMYER
            </h1>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99,
          background: 'rgba(0,0,0,0.3)',
          opacity: introIn ? layerOpacity : 0,
          transition: `opacity ${INTRO_MS}ms ease`,
          pointerEvents: 'none',
        }}
      />
      <div
        ref={cycleTextWrapRef}
        aria-hidden
        className="identity-cycle-text-wrap"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          zIndex: 100,
          transform: introIn ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.8)',
          opacity: introIn ? layerOpacity : 0,
          transition: `transform ${INTRO_MS}ms ease, opacity ${INTRO_MS}ms ease`,
          pointerEvents: 'none',
        }}
      >
        <h1
          className="hero-cycle-h1 hero-cycle-h1--pro identity-cycle-h1 identity-cycle-h1--viewport"
          style={{
            position: 'relative',
            left: 'auto',
            top: 'auto',
            width: 'max-content',
            maxWidth: '100vw',
            margin: '0 auto',
            WebkitTextFillColor: 'transparent',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            backgroundSize: '200%',
            backgroundPosition: bgPos,
            backgroundImage: `url(${bgUrl})`,
            fontSize: 'clamp(20vw, 25vw, 30vw)',
            lineHeight: 0.85,
          }}
        >
          ANGLEMYER
        </h1>
      </div>
    </>
  )
}
