import { useEffect, useRef, useState, useLayoutEffect } from 'react'

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
const CROSSFADE_MS = 400

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

export type IdentityCycleProps = {
  active: boolean
  onComplete: () => void
  onCrossfadeStart?: () => void
}

export default function IdentityCycle({ active, onComplete, onCrossfadeStart }: IdentityCycleProps) {
  const [bgUrl, setBgUrl] = useState<CycleUrl>(CYCLE_IMAGES[0])
  const [bgPos, setBgPos] = useState('50% 50%')
  const [layerOpacity, setLayerOpacity] = useState(1)
  const [introIn, setIntroIn] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const onCompleteRef = useRef(onComplete)
  const onCrossfadeRef = useRef(onCrossfadeStart)

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

        onCrossfadeRef.current?.()
        setLayerOpacity(0)
        await delay(CROSSFADE_MS, signal)
        onCompleteRef.current()
      } catch (e) {
        if ((e as Error).name !== 'AbortError') throw e
      }
    })().catch(() => {})

    return () => {
      ac.abort()
      abortRef.current = null
    }
  }, [active])

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
          opacity: introIn ? layerOpacity : 0,
          transition: `opacity ${CROSSFADE_MS}ms ease`,
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
          transform: introIn ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.8)',
          opacity: introIn ? layerOpacity : 0,
          transition: `transform ${INTRO_MS}ms ease, opacity ${CROSSFADE_MS}ms ease`,
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
