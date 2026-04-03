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

const LETTERS = ['A', 'N', 'G', 'L', 'E', 'M', 'Y', 'E', 'R'] as const
const N = LETTERS.length

const FAST_MS = 80
const LETTER_STAGGER_MS = 30
/** Same total fast phase as 39 steps with 38×80ms gaps. */
const FAST_PHASE_MS = (CYCLE_IMAGES.length - 1) * FAST_MS
const SETTLE_DELAYS_MS = [150, 250, 400, 600, 900] as const
const HOLD_LAST_MS = 500
const INTRO_MS = 400
const FLY_MS = 800
const FLY_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const SWAP_PROB = 0.7

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

function creHeroFontPx(): number {
  return clampHeroFontPx(6, 26, 22) * CRE_FONT_SIZE_SCALE
}

function randomBgPos(): string {
  const x = 50 + (Math.random() * 20 - 10)
  const y = 50 + (Math.random() * 20 - 10)
  return `${x.toFixed(1)}% ${y.toFixed(1)}%`
}

function randomImage(): CycleUrl {
  return CYCLE_IMAGES[Math.floor(Math.random() * CYCLE_IMAGES.length)]!
}

function initialLetters(): { urls: CycleUrl[]; positions: string[] } {
  return {
    urls: Array.from({ length: N }, () => randomImage()),
    positions: Array.from({ length: N }, () => randomBgPos()),
  }
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

/** Migration: fixed center + translate + scale → hero rect (font size via uniform scale). */
type FlySnap = {
  sx: number
  sy: number
  dx: number
  dy: number
  scale: number
  startFontPx: number
  targetFontPx: number
  clipOp: number
  solidOp: number
  scrimOp: number
  transitioning: boolean
}

export type IdentityCycleProps = {
  active: boolean
  onComplete: () => void
  onCrossfadeStart?: () => void
  heroContainerRef: RefObject<HTMLDivElement | null>
}

function useLetterRotations(): number[] {
  const [rotationsDeg] = useState(() =>
    Array.from({ length: N }, () => (Math.random() * 6 - 3)),
  )
  return rotationsDeg
}

function resolveHeroTargetEl(
  heroContainerRef: RefObject<HTMLDivElement | null>,
): HTMLElement | null {
  if (typeof document === 'undefined') return heroContainerRef.current
  const byAttr = document.querySelector('[data-hero-target]')
  if (byAttr instanceof HTMLElement) return byAttr
  return heroContainerRef.current
}

export default function IdentityCycle({
  active,
  onComplete,
  onCrossfadeStart,
  heroContainerRef,
}: IdentityCycleProps) {
  const [letters, setLetters] = useState(() => initialLetters())
  const rotationsDeg = useLetterRotations()

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

    const tickLetter = (index: number) => {
      setLetters(prev => {
        const urls = [...prev.urls]
        const positions = [...prev.positions]
        if (Math.random() < SWAP_PROB) {
          urls[index] = randomImage()
        }
        positions[index] = randomBgPos()
        return { ...prev, urls, positions }
      })
    }

    ;(async () => {
      try {
        await delay(INTRO_MS, signal)

        const letterCleanups: (() => void)[] = []
        for (let i = 0; i < N; i++) {
          const startId = window.setTimeout(() => {
            const intervalId = window.setInterval(() => tickLetter(i), FAST_MS)
            letterCleanups.push(() => clearInterval(intervalId))
          }, i * LETTER_STAGGER_MS)
          letterCleanups.push(() => clearTimeout(startId))
        }

        try {
          await delay(FAST_PHASE_MS, signal)
        } finally {
          letterCleanups.forEach(c => c())
        }

        const finals = pickFiveRandomImages()
        for (let step = 0; step < finals.length; step++) {
          const img = finals[step]!
          setLetters(prev => ({
            ...prev,
            urls: Array.from({ length: N }, () => img),
            positions: Array.from({ length: N }, () => randomBgPos()),
          }))
          await delay(SETTLE_DELAYS_MS[step]!, signal)
        }

        await delay(HOLD_LAST_MS, signal)

        const targetEl = resolveHeroTargetEl(heroContainerRef)
        const cycleWrap = cycleTextWrapRef.current
        const measureEl = cycleWrap?.querySelector('.identity-cycle-letters') ?? cycleWrap

        if (!targetEl || !cycleWrap || !measureEl) {
          onCrossfadeRef.current?.()
          onCompleteRef.current()
          return
        }

        const targetRect = targetEl.getBoundingClientRect()
        const startRect = cycleWrap.getBoundingClientRect()
        const measureComputed = getComputedStyle(measureEl as Element)
        const startFontPx = parseFloat(measureComputed.fontSize)
        const targetFontPx = creHeroFontPx()

        const sx = startRect.left + startRect.width / 2
        const sy = startRect.top + startRect.height / 2
        const tx = targetRect.left + targetRect.width / 2
        const ty = targetRect.top + targetRect.height / 2
        const dx = tx - sx
        const dy = ty - sy
        const scale =
          startFontPx > 0 && Number.isFinite(startFontPx)
            ? targetFontPx / startFontPx
            : 1

        onCrossfadeRef.current?.()

        const fromSnap: FlySnap = {
          sx,
          sy,
          dx: 0,
          dy: 0,
          scale: 1,
          startFontPx,
          targetFontPx,
          clipOp: 1,
          solidOp: 0,
          scrimOp: 1,
          transitioning: false,
        }

        const toSnap: FlySnap = {
          sx,
          sy,
          dx,
          dy,
          scale,
          startFontPx,
          targetFontPx,
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

  const letterMargin = '0 -0.02em'

  const renderLetterRow = (opts: {
    variant: 'clip' | 'solid'
    size: 'cycle' | 'fly'
    flyFontPx?: number
    layerOpacity?: number
    opTransition?: string
    /** Extra transitions for clip/solid crossfade (fill, background). */
    letterExtraTransition?: string
  }) => (
    <div
      className="identity-cycle-letters hero-cycle-h1--pro identity-cycle-h1--viewport"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: 'max-content',
        maxWidth: '100vw',
        margin: '0 auto',
        fontSize:
          opts.size === 'cycle'
            ? 'clamp(20vw, 25vw, 30vw)'
            : opts.flyFontPx != null
              ? `${opts.flyFontPx}px`
              : 'inherit',
        lineHeight: 0.85,
      }}
    >
      {LETTERS.map((ch, i) => (
        <div
          key={`${opts.variant}-${ch}-${i}`}
          style={{
            display: 'inline-block',
            margin: letterMargin,
            transform: `rotate(${rotationsDeg[i]}deg)`,
          }}
        >
          {opts.variant === 'clip' ? (
            <span
              className="identity-cycle-letter identity-cycle-h1"
              style={{
                display: 'inline-block',
                WebkitTextFillColor: 'transparent',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                backgroundSize: '200%',
                backgroundPosition: letters.positions[i],
                backgroundImage: `url(${letters.urls[i]})`,
                fontSize: 'inherit',
                lineHeight: 0.85,
                opacity: opts.layerOpacity ?? 1,
                transition: [opts.opTransition, opts.letterExtraTransition]
                  .filter(Boolean)
                  .join(', '),
              }}
            >
              {ch}
            </span>
          ) : (
            <span
              className="hero-cycle-h1 hero-cycle-h1--cre"
              style={{
                display: 'inline-block',
                color: 'rgba(255,255,255,0.92)',
                WebkitTextFillColor: 'rgba(255,255,255,0.92)',
                fontSize: 'inherit',
                lineHeight: 0.85,
                opacity: opts.layerOpacity ?? 1,
                transition: [opts.opTransition, opts.letterExtraTransition]
                  .filter(Boolean)
                  .join(', '),
              }}
            >
              {ch}
            </span>
          )}
        </div>
      ))}
    </div>
  )

  if (!active) return null

  if (phase === 'fly' && flySnap) {
    const s = flySnap
    const transformTransition = s.transitioning ? `transform ${FLY_MS}ms ${FLY_EASE}` : 'none'
    const opTransition = s.transitioning ? `opacity ${FLY_MS}ms ${FLY_EASE}` : 'none'
    const fillTransition = s.transitioning
      ? `-webkit-text-fill-color ${FLY_MS}ms ${FLY_EASE}`
      : 'none'
    const bgFadeTransition = s.transitioning
      ? `opacity ${FLY_MS}ms ${FLY_EASE}, background-size ${FLY_MS}ms ${FLY_EASE}`
      : 'none'

    const t = s.transitioning
      ? `translate(-50%, -50%) translate(${s.dx}px, ${s.dy}px) scale(${s.scale})`
      : 'translate(-50%, -50%)'

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
            left: s.sx,
            top: s.sy,
            zIndex: 100,
            transform: t,
            transformOrigin: 'center center',
            transition: transformTransition,
            pointerEvents: 'none',
            boxSizing: 'border-box',
            willChange: s.transitioning ? 'transform' : undefined,
          }}
        >
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div
              style={{
                opacity: s.clipOp,
                transition: opTransition,
              }}
            >
              {renderLetterRow({
                variant: 'clip',
                size: 'fly',
                flyFontPx: s.startFontPx,
                layerOpacity: 1,
                opTransition,
                letterExtraTransition: bgFadeTransition,
              })}
            </div>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                opacity: s.solidOp,
                transition: opTransition,
              }}
            >
              {renderLetterRow({
                variant: 'solid',
                size: 'fly',
                flyFontPx: s.startFontPx,
                layerOpacity: 1,
                opTransition,
                letterExtraTransition: fillTransition,
              })}
            </div>
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
        {renderLetterRow({ variant: 'clip', size: 'cycle' })}
      </div>
    </>
  )
}
