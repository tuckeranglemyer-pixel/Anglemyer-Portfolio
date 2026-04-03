import { DEFAULT_WATER_DISPLACEMENT_SCALE } from './WaterDisplacementEffect'

/** Peak multiplier vs normal post-FX displacement (5–10× range). */
const PEAK_MULT = 8
const HOLD_MS = 2000
const EASE_MS = 1000

type Phase = 'idle' | 'hold' | 'ease'

let phase: Phase = 'idle'
let phaseStartMs = 0

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** Call when the identity-cycle tsunami fires: 2s at peak, then 1s ease back to normal. */
export function triggerTsunamiDisplacementBoost(): void {
  phase = 'hold'
  phaseStartMs = typeof performance !== 'undefined' ? performance.now() : 0
}

/** Call every frame from WaterSimPostFx; returns the effect `scale` uniform value. */
export function getTsunamiDisplacementScale(): number {
  const base = DEFAULT_WATER_DISPLACEMENT_SCALE
  if (phase === 'idle') return base

  const now = performance.now()

  if (phase === 'hold') {
    if (now - phaseStartMs >= HOLD_MS) {
      phase = 'ease'
      phaseStartMs = now
    }
    return base * PEAK_MULT
  }

  if (phase === 'ease') {
    const t = Math.min(1, (now - phaseStartMs) / EASE_MS)
    const s = smoothstep(t)
    const mult = PEAK_MULT + (1 - PEAK_MULT) * s
    if (t >= 1) phase = 'idle'
    return base * mult
  }

  return base
}
