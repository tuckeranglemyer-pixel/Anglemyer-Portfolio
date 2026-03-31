import { useState, useEffect, useRef, useMemo, memo, type CSSProperties } from 'react'
import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react'

export type WaterMode = 'pro' | 'creative'

// ─── presets ─────────────────────────────────────────────────────────────────
interface GradientState {
  color1: string; color2: string; color3: string
  uSpeed: number; uStrength: number; uFrequency: number
}

const PRESETS: Record<WaterMode, GradientState> = {
  // NIGHT — dark cool navy (fixed hexes; ShaderGradient brightness dims env lift)
  pro: {
    color1: '#0a1628', color2: '#0d1f3c', color3: '#060e1e',
    uSpeed: 0.08, uStrength: 2.5, uFrequency: 3.0,
  },
  // DAY — dark warm embers, slightly more movement
  creative: {
    color1: '#1a0a0a', color2: '#1f1005', color3: '#0e0a1e',
    uSpeed: 0.12, uStrength: 3.0, uFrequency: 3.5,
  },
}

// ─── color math ──────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0'))
    .join('')
}

function lerpHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t)
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// ─── component ───────────────────────────────────────────────────────────────
interface WaterBackgroundProps {
  style?: CSSProperties
  mode?: WaterMode
}

/** ~30fps max during mode crossfade — enough for smooth colors, fewer React/R3F reconciliations. */
const MODE_TRANSITION_PAINT_MS = 33

function WaterBackgroundInner({
  style,
  mode = 'pro',
}: WaterBackgroundProps) {
  // Live gradient state — updated ~30fps during transitions (not every rAF)
  const [g, setG] = useState<GradientState>(PRESETS[mode])

  // Ref always holds the latest animated state for the next transition start
  const currentRef = useRef<GradientState>(PRESETS[mode])
  const animRef    = useRef<number | null>(null)
  const lastPaintRef = useRef(0)

  useEffect(() => {
    const from   = currentRef.current
    const target = PRESETS[mode]
    const unchanged =
      from.color1 === target.color1 &&
      from.color2 === target.color2 &&
      from.color3 === target.color3 &&
      from.uSpeed === target.uSpeed &&
      from.uStrength === target.uStrength &&
      from.uFrequency === target.uFrequency
    if (unchanged) return

    const DURATION = 900
    let startTime: number | null = null

    if (animRef.current) cancelAnimationFrame(animRef.current)

    function tick(now: number) {
      if (startTime === null) startTime = now
      const t = easeInOutCubic(Math.min((now - startTime) / DURATION, 1))

      const next: GradientState = {
        color1:     lerpHex(from.color1,    target.color1,    t),
        color2:     lerpHex(from.color2,    target.color2,    t),
        color3:     lerpHex(from.color3,    target.color3,    t),
        uSpeed:     lerp(from.uSpeed,     target.uSpeed,     t),
        uStrength:  lerp(from.uStrength,  target.uStrength,  t),
        uFrequency: lerp(from.uFrequency, target.uFrequency, t),
      }

      currentRef.current = next
      const done = t >= 1
      const due =
        done ||
        now - lastPaintRef.current >= MODE_TRANSITION_PAINT_MS
      if (due) {
        lastPaintRef.current = now
        setG(next)
      }

      if (t < 1) animRef.current = requestAnimationFrame(tick)
    }

    animRef.current = requestAnimationFrame(tick)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const canvasStyle = useMemo(
    (): CSSProperties => ({
      position: 'fixed',
      inset: 0,
      width: '100%',
      height: '100%',
      ...style,
    }),
    [style],
  )

  return (
    <ShaderGradientCanvas
      lazyLoad={false}
      style={canvasStyle}
      pointerEvents="none"
    >
      <ShaderGradient
        type="waterPlane"
        animate="on"
        color1={g.color1}
        color2={g.color2}
        color3={g.color3}
        uSpeed={g.uSpeed}
        uStrength={g.uStrength}
        uFrequency={g.uFrequency}
        cPolarAngle={75}
        cDistance={5}
        lightType="3d"
        envPreset="city"
        brightness={0.65}
        grain="off"
      />
    </ShaderGradientCanvas>
  )
}

export default memo(WaterBackgroundInner)
