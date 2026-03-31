import { useCallback, useEffect, useRef, useState } from 'react'

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
      {!muted && (
        <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z" />
      )}
      {muted && (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          d="M16 7l6 10M22 7l-6 10"
        />
      )}
    </svg>
  )
}

/**
 * Very quiet Web Audio drone (dual sine + low-pass). Default muted; click toggles.
 */
export default function AmbientPad() {
  const [muted, setMuted] = useState(true)
  const ctxRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  const ensureGraph = useCallback(() => {
    if (ctxRef.current) return ctxRef.current
    const ctx = new AudioContext()
    const osc1 = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    osc1.type = 'sine'
    osc2.type = 'sine'
    osc1.frequency.value = 55
    osc2.frequency.value = 82.4

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 280
    filter.Q.value = 0.6

    const gain = ctx.createGain()
    gain.gain.value = 0

    osc1.connect(filter)
    osc2.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    osc1.start()
    osc2.start()

    ctxRef.current = ctx
    gainRef.current = gain
    return ctx
  }, [])

  useEffect(() => {
    return () => {
      const ctx = ctxRef.current
      if (ctx) void ctx.close().catch(() => {})
    }
  }, [])

  const toggle = async () => {
    const willBeMuted = !muted
    setMuted(willBeMuted)

    const ctx = ensureGraph()
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {})
    }

    const gain = gainRef.current
    if (!gain) return
    const t = ctx.currentTime
    const target = willBeMuted ? 0 : 0.022
    gain.gain.cancelScheduledValues(t)
    gain.gain.setValueAtTime(gain.gain.value, t)
    gain.gain.linearRampToValueAtTime(target, t + 0.12)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={muted ? 'Unmute ambient sound' : 'Mute ambient sound'}
      data-cursor-interactive
      style={{
        position: 'fixed',
        right: '1.25rem',
        bottom: '1.25rem',
        zIndex: 104,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'none',
        color: 'rgba(255,255,255,0.9)',
        opacity: 0.2,
        fontFamily: '"Space Mono", monospace',
        fontSize: '10px',
        lineHeight: 1,
      }}
    >
      <SpeakerIcon muted={muted} />
    </button>
  )
}
