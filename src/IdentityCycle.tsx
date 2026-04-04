import { useEffect, useRef, useState, useLayoutEffect } from 'react'

const CYCLE_IMAGES = [
  '/textures/cycle/01.jpg',
  '/textures/cycle/02.jpg',
  '/textures/cycle/03.jpeg',
  '/textures/cycle/04.jpg',
  '/textures/cycle/05.jpg',
  '/textures/cycle/06.jpg',
  '/textures/cycle/07.jpg',
  '/textures/cycle/08.jpg',
  '/textures/cycle/09.jpg',
  '/textures/cycle/10.jpeg',
  '/textures/cycle/11.webp',
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
  '/textures/cycle/27.webp',
  '/textures/cycle/28.webp',
  '/textures/cycle/29.webp',
  '/textures/cycle/30.webp',
  '/textures/cycle/31.webp',
  '/textures/cycle/32.webp',
  '/textures/cycle/33.webp',
  '/textures/cycle/34.webp',
  '/textures/cycle/35.webp',
  '/textures/cycle/36.webp',
  '/textures/cycle/37.webp',
  '/textures/cycle/38.webp',
  '/textures/cycle/39.webp',
  '/textures/cycle/40.webp',
  '/textures/cycle/41.webp',
  '/textures/cycle/42.webp',
  '/textures/cycle/43.webp',
  '/textures/cycle/44.webp',
  '/textures/cycle/45.webp',
  '/textures/cycle/46.webp',
  '/textures/cycle/47.webp',
  '/textures/cycle/48.webp',
  '/textures/cycle/49.webp',
  '/textures/cycle/50.webp',
  '/textures/cycle/51.webp',
  '/textures/cycle/52.webp',
  '/textures/cycle/53.webp',
  '/textures/cycle/54.webp',
  '/textures/cycle/55.webp',
  '/textures/cycle/56.jpg',
  '/textures/cycle/57.webp',
  '/textures/cycle/58.jpeg',
  '/textures/cycle/59.jpg',
  '/textures/cycle/60.jpg',
  '/textures/cycle/61.webp',
  '/textures/cycle/62.png',
  '/textures/cycle/63.jpg',
  '/textures/cycle/64.jpg',
  '/textures/cycle/65.avif',
  '/textures/cycle/66.png',
  '/textures/cycle/67.jpeg',
  '/textures/cycle/68.jpg',
  '/textures/cycle/69.webp',
  '/textures/cycle/70.jpg',
  '/textures/cycle/71.jpg',
  '/textures/cycle/72.jpg',
  '/textures/cycle/73.jpg',
  '/textures/cycle/74.jpg',
] as const

type CycleUrl = (typeof CYCLE_IMAGES)[number]

const LETTERS = ['A', 'N', 'G', 'L', 'E', 'M', 'Y', 'E', 'R'] as const
const N = LETTERS.length

const FAST_MS = 120
const LETTER_STAGGER_MS = 30
const FAST_PHASE_STEPS = 35
const FAST_PHASE_MS = (FAST_PHASE_STEPS - 1) * FAST_MS
const SETTLE_DELAYS_MS = [150, 250, 400, 600, 900] as const
const HOLD_LAST_MS = 500
const INTRO_MS = 400
const EXIT_MS = 400
const SWAP_PROB = 0.7

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

export type IdentityCycleProps = {
  active: boolean
  onComplete: () => void
}

function useLetterRotations(): number[] {
  const [rotationsDeg] = useState(() =>
    Array.from({ length: N }, () => (Math.random() * 6 - 3)),
  )
  return rotationsDeg
}

export default function IdentityCycle({ active, onComplete }: IdentityCycleProps) {
  const [letters, setLetters] = useState(() => initialLetters())
  const rotationsDeg = useLetterRotations()
  const [imagesReady, setImagesReady] = useState(false)

  const layerOpacity = 1
  const [introIn, setIntroIn] = useState(false)
  const [exitOut, setExitOut] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const onCompleteRef = useRef(onComplete)

  useLayoutEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    let cancelled = false
    const total = CYCLE_IMAGES.length
    let loaded = 0
    const onOneDone = () => {
      loaded += 1
      if (!cancelled && loaded >= total) setImagesReady(true)
    }
    for (const url of CYCLE_IMAGES) {
      const img = new Image()
      img.onload = onOneDone
      img.onerror = onOneDone
      img.src = url
    }
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!active) {
      setIntroIn(false)
      setExitOut(false)
      return
    }
    if (!imagesReady) {
      setIntroIn(false)
      setExitOut(false)
      return
    }
    setIntroIn(false)
    setExitOut(false)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIntroIn(true))
    })
    return () => cancelAnimationFrame(id)
  }, [active, imagesReady])

  useEffect(() => {
    if (!active || !imagesReady) return

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

        await new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setExitOut(true)
              resolve()
            })
          })
        })

        await delay(EXIT_MS, signal)
        onCompleteRef.current()
      } catch (e) {
        if ((e as Error).name !== 'AbortError') throw e
      }
    })().catch(() => {})

    return () => {
      ac.abort()
      abortRef.current = null
    }
  }, [active, imagesReady])

  const letterMargin = '0 -0.02em'
  const exitEase = 'ease'
  const exitTransition = `opacity ${EXIT_MS}ms ${exitEase}, transform ${EXIT_MS}ms ${exitEase}`

  const scrimOpacity = !introIn ? 0 : exitOut ? 0 : layerOpacity
  const textOpacity = !introIn ? 0 : exitOut ? 0 : layerOpacity
  const textTransform = !introIn
    ? 'translate(-50%, -50%) scale(0.8)'
    : exitOut
      ? 'translate(-50%, -50%) scale(1.05)'
      : 'translate(-50%, -50%) scale(1)'

  if (!active) return null

  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99,
          background: 'rgba(0,0,0,0.3)',
          opacity: scrimOpacity,
          transition: exitOut
            ? `opacity ${EXIT_MS}ms ${exitEase}`
            : `opacity ${INTRO_MS}ms ease`,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        className="identity-cycle-text-wrap"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          zIndex: 100,
          transform: textTransform,
          opacity: textOpacity,
          transition: exitOut
            ? exitTransition
            : `transform ${INTRO_MS}ms ease, opacity ${INTRO_MS}ms ease`,
          pointerEvents: 'none',
        }}
      >
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
            fontSize: 'clamp(20vw, 25vw, 30vw)',
            lineHeight: 0.85,
          }}
        >
          {LETTERS.map((ch, i) => (
            <div
              key={`${ch}-${i}`}
              style={{
                display: 'inline-block',
                margin: letterMargin,
                transform: `rotate(${rotationsDeg[i]}deg)`,
              }}
            >
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
                }}
              >
                {ch}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
