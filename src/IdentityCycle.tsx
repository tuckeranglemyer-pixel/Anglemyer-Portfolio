import { useEffect, useRef, useState, useLayoutEffect } from 'react'

const CYCLE_IMAGES = [
  '/textures/cycle/001.webp',
  '/textures/cycle/002.jpg',
  '/textures/cycle/003.jpg',
  '/textures/cycle/004.jpeg',
  '/textures/cycle/005.jpg',
  '/textures/cycle/006.jpg',
  '/textures/cycle/007.jpg',
  '/textures/cycle/008.jpg',
  '/textures/cycle/009.jpg',
  '/textures/cycle/010.jpg',
  '/textures/cycle/011.jpeg',
  '/textures/cycle/012.jpg',
  '/textures/cycle/013.webp',
  '/textures/cycle/014.webp',
  '/textures/cycle/015.webp',
  '/textures/cycle/016.webp',
  '/textures/cycle/017.webp',
  '/textures/cycle/018.webp',
  '/textures/cycle/019.webp',
  '/textures/cycle/020.webp',
  '/textures/cycle/021.webp',
  '/textures/cycle/022.webp',
  '/textures/cycle/023.webp',
  '/textures/cycle/024.webp',
  '/textures/cycle/025.webp',
  '/textures/cycle/026.webp',
  '/textures/cycle/027.webp',
  '/textures/cycle/028.webp',
  '/textures/cycle/029.webp',
  '/textures/cycle/030.webp',
  '/textures/cycle/031.webp',
  '/textures/cycle/032.webp',
  '/textures/cycle/033.webp',
  '/textures/cycle/034.webp',
  '/textures/cycle/035.webp',
  '/textures/cycle/036.webp',
  '/textures/cycle/037.webp',
  '/textures/cycle/038.webp',
  '/textures/cycle/039.webp',
  '/textures/cycle/040.webp',
  '/textures/cycle/041.webp',
  '/textures/cycle/042.webp',
  '/textures/cycle/043.webp',
  '/textures/cycle/044.webp',
  '/textures/cycle/045.webp',
  '/textures/cycle/046.webp',
  '/textures/cycle/047.webp',
  '/textures/cycle/048.webp',
  '/textures/cycle/049.webp',
  '/textures/cycle/050.webp',
  '/textures/cycle/051.webp',
  '/textures/cycle/052.webp',
  '/textures/cycle/053.webp',
  '/textures/cycle/054.webp',
  '/textures/cycle/055.webp',
  '/textures/cycle/056.webp',
  '/textures/cycle/057.webp',
  '/textures/cycle/058.jpg',
  '/textures/cycle/059.webp',
  '/textures/cycle/060.jpeg',
  '/textures/cycle/061.jpg',
  '/textures/cycle/062.jpg',
  '/textures/cycle/063.webp',
  '/textures/cycle/064.png',
  '/textures/cycle/065.jpg',
  '/textures/cycle/066.jpg',
  '/textures/cycle/067.avif',
  '/textures/cycle/068.png',
  '/textures/cycle/069.jpeg',
  '/textures/cycle/070.jpg',
  '/textures/cycle/071.webp',
  '/textures/cycle/072.jpg',
  '/textures/cycle/073.jpg',
  '/textures/cycle/074.jpg',
  '/textures/cycle/075.jpg',
  '/textures/cycle/076.jpg',
  '/textures/cycle/077.jpg',
  '/textures/cycle/078.jpg',
  '/textures/cycle/079.jpg',
  '/textures/cycle/080.jpg',
  '/textures/cycle/081.avif',
] as const

type CycleUrl = (typeof CYCLE_IMAGES)[number]

const LETTERS = ['A', 'N', 'G', 'L', 'E', 'M', 'Y', 'E', 'R'] as const
const N = LETTERS.length

const LETTER_STAGGER_MS = 30
const FAST_PHASE_STEPS = 35
const ENTRANCE_FADE_MS = 400
const CROSSFADE_MS = 80
const SETTLE_STEPS = 8
const SETTLE_BASE_MS = 220
const HOLD_LAST_MS = 500
const EXIT_MS = 400
const SWAP_PROB = 0.7

function fastPhaseGapMs(gapIndex: number): number {
  if (gapIndex < 5) return 300
  if (gapIndex < 10) return 200
  return 120
}

const SUM_FAST_GAPS_MS = Array.from({ length: FAST_PHASE_STEPS - 1 }, (_, i) =>
  fastPhaseGapMs(i),
).reduce((a, b) => a + b, 0)

/** After entrance: last letter finishes at (N−1)*stagger + all gaps between ticks */
const FAST_PHASE_TOTAL_MS = (N - 1) * LETTER_STAGGER_MS + SUM_FAST_GAPS_MS

function easeInQuad(t: number): number {
  return t * t
}

function settleStepDelayMs(step: number): number {
  const progress = step / (SETTLE_STEPS - 1)
  return SETTLE_BASE_MS * (1 + easeInQuad(progress))
}

function randomBgPos(): string {
  const x = 50 + (Math.random() * 20 - 10)
  const y = 50 + (Math.random() * 20 - 10)
  return `${x.toFixed(1)}% ${y.toFixed(1)}%`
}

function randomImage(): CycleUrl {
  return CYCLE_IMAGES[Math.floor(Math.random() * CYCLE_IMAGES.length)]!
}

type LetterState = {
  fUrl: CycleUrl
  bUrl: CycleUrl
  fOp: number
  bOp: number
  pos: string
  opacityTransition: boolean
}

function initialLetter(): LetterState {
  const u = randomImage()
  const p = randomBgPos()
  return {
    fUrl: u,
    bUrl: u,
    fOp: 1,
    bOp: 0,
    pos: p,
    opacityTransition: true,
  }
}

function initialLetters(): LetterState[] {
  return Array.from({ length: N }, () => initialLetter())
}

function pickSettleImages(count: number): CycleUrl[] {
  const out: CycleUrl[] = []
  for (let i = 0; i < count; i++) {
    out.push(CYCLE_IMAGES[Math.floor(Math.random() * CYCLE_IMAGES.length)]!)
  }
  return out
}

function startCrossfade(L: LetterState, url: CycleUrl, pos: string): LetterState {
  return {
    ...L,
    bUrl: url,
    pos,
    fOp: 0,
    bOp: 1,
    opacityTransition: true,
  }
}

function finishCrossfade(L: LetterState): LetterState {
  return {
    fUrl: L.bUrl,
    bUrl: L.fUrl,
    fOp: 1,
    bOp: 0,
    pos: L.pos,
    opacityTransition: false,
  }
}

function bumpPositionOnly(L: LetterState, pos: string): LetterState {
  return { ...L, pos, opacityTransition: false }
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

const clipTextStyle = {
  WebkitTextFillColor: 'transparent' as const,
  WebkitBackgroundClip: 'text' as const,
  backgroundClip: 'text' as const,
  backgroundSize: '200%' as const,
}

export default function IdentityCycle({ active, onComplete }: IdentityCycleProps) {
  const [letters, setLetters] = useState<LetterState[]>(() => initialLetters())
  const rotationsDeg = useLetterRotations()
  const [imagesReady, setImagesReady] = useState(false)

  const layerOpacity = 1
  const [introIn, setIntroIn] = useState(false)
  const [exitOut, setExitOut] = useState(false)
  const [shellOpacity, setShellOpacity] = useState(0)

  const abortRef = useRef<AbortController | null>(null)
  const onCompleteRef = useRef(onComplete)
  const crossfadeTimeoutsRef = useRef<number[]>([])

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
      setShellOpacity(0)
      return
    }
    if (!imagesReady) {
      setIntroIn(false)
      setExitOut(false)
      setShellOpacity(0)
      return
    }
    setIntroIn(false)
    setExitOut(false)
    setShellOpacity(0)
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setShellOpacity(1)
        setIntroIn(true)
      })
    })
    return () => cancelAnimationFrame(id)
  }, [active, imagesReady])

  useEffect(() => {
    if (!active || !imagesReady) return

    const ac = new AbortController()
    abortRef.current = ac
    const { signal } = ac

    const scheduleCrossfadeEnd = (index: number) => {
      const tid = window.setTimeout(() => {
        setLetters(prev =>
          prev.map((L, j) => (j === index ? finishCrossfade(L) : L)),
        )
        crossfadeTimeoutsRef.current = crossfadeTimeoutsRef.current.filter(x => x !== tid)
      }, CROSSFADE_MS)
      crossfadeTimeoutsRef.current.push(tid)
    }

    const tickLetter = (index: number) => {
      const pos = randomBgPos()
      if (Math.random() < SWAP_PROB) {
        const url = randomImage()
        scheduleCrossfadeEnd(index)
        setLetters(prev =>
          prev.map((x, j) => (j === index ? startCrossfade(x, url, pos) : x)),
        )
      } else {
        setLetters(prev =>
          prev.map((x, j) => (j === index ? bumpPositionOnly(x, pos) : x)),
        )
      }
    }

    ;(async () => {
      try {
        await delay(ENTRANCE_FADE_MS, signal)

        const letterCleanups: (() => void)[] = []
        for (let i = 0; i < N; i++) {
          let gapCount = 0
          const chainIds: number[] = []

          const scheduleNext = () => {
            if (signal.aborted) return
            if (gapCount >= FAST_PHASE_STEPS - 1) return
            const gap = fastPhaseGapMs(gapCount)
            gapCount += 1
            const tid = window.setTimeout(() => {
              tickLetter(i)
              scheduleNext()
            }, gap)
            chainIds.push(tid)
          }

          const startId = window.setTimeout(() => {
            tickLetter(i)
            scheduleNext()
          }, i * LETTER_STAGGER_MS)

          letterCleanups.push(() => {
            clearTimeout(startId)
            chainIds.forEach(id => clearTimeout(id))
          })
        }

        try {
          await delay(FAST_PHASE_TOTAL_MS, signal)
        } finally {
          letterCleanups.forEach(c => c())
        }

        await delay(CROSSFADE_MS, signal)

        const finals = pickSettleImages(SETTLE_STEPS)
        for (let step = 0; step < SETTLE_STEPS; step++) {
          const img = finals[step]!
          const stepDelay = settleStepDelayMs(step)
          setLetters(prev =>
            prev.map(L => startCrossfade(L, img, randomBgPos())),
          )
          for (let i = 0; i < N; i++) {
            scheduleCrossfadeEnd(i)
          }
          await delay(stepDelay, signal)
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
      crossfadeTimeoutsRef.current.forEach(t => clearTimeout(t))
      crossfadeTimeoutsRef.current = []
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

  const opacityEase = 'ease'
  const crossfadeTransition = `opacity ${CROSSFADE_MS}ms ${opacityEase}`

  if (!active) return null

  return (
    <>
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99,
          opacity: shellOpacity,
          transition: exitOut
            ? `opacity ${EXIT_MS}ms ${exitEase}`
            : `opacity ${ENTRANCE_FADE_MS}ms ${opacityEase}`,
          pointerEvents: 'none',
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            opacity: scrimOpacity,
            transition: exitOut
              ? `opacity ${EXIT_MS}ms ${exitEase}`
              : `opacity ${ENTRANCE_FADE_MS}ms ${opacityEase}`,
            pointerEvents: 'none',
          }}
        />
      </div>
      <div
        aria-hidden
        className="identity-cycle-text-wrap"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          zIndex: 100,
          transform: textTransform,
          opacity: textOpacity * shellOpacity,
          transition: exitOut
            ? exitTransition
            : `transform ${ENTRANCE_FADE_MS}ms ease, opacity ${ENTRANCE_FADE_MS}ms ease`,
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
          {LETTERS.map((ch, i) => {
            const L = letters[i]!
            const opTrans = L.opacityTransition ? crossfadeTransition : 'none'
            return (
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
                    position: 'relative',
                    display: 'inline-block',
                    fontSize: 'inherit',
                    lineHeight: 0.85,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      visibility: 'hidden',
                      display: 'inline-block',
                      fontSize: 'inherit',
                      lineHeight: 0.85,
                    }}
                  >
                    {ch}
                  </span>
                  <span
                    aria-hidden
                    className="identity-cycle-h1"
                    style={{
                      ...clipTextStyle,
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundPosition: L.pos,
                      backgroundImage: `url(${L.bUrl})`,
                      opacity: L.bOp,
                      transition: opTrans,
                      zIndex: 1,
                      fontSize: 'inherit',
                      lineHeight: 0.85,
                    }}
                  >
                    {ch}
                  </span>
                  <span
                    aria-hidden
                    className="identity-cycle-h1"
                    style={{
                      ...clipTextStyle,
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundPosition: L.pos,
                      backgroundImage: `url(${L.fUrl})`,
                      opacity: L.fOp,
                      transition: opTrans,
                      zIndex: 2,
                      fontSize: 'inherit',
                      lineHeight: 0.85,
                    }}
                  >
                    {ch}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
