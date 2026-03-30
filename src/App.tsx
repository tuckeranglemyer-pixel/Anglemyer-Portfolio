import { useState } from 'react'
import EntryAnimation from './EntryAnimation'

type Mode = 'pro' | 'creative'

export default function App() {
  const [animationComplete, setAnimationComplete] = useState(false)
  const [mode, setMode] = useState<Mode>('creative')

  if (!animationComplete) {
    return <EntryAnimation onComplete={() => setAnimationComplete(true)} />
  }

  return (
    <div className="w-full min-h-screen bg-black flex items-center justify-center relative">
      <h1
        style={{
          fontFamily:
            mode === 'pro'
              ? '"Instrument Serif", serif'
              : '"Space Mono", monospace',
        }}
        className={`text-white select-none transition-all duration-500 ${
          mode === 'pro'
            ? 'text-5xl font-normal tracking-normal'
            : 'text-6xl font-bold tracking-widest uppercase'
        }`}
      >
        {mode === 'pro' ? 'Tucker Anglemyer' : 'ANGLEMYER'}
      </h1>

      <button
        onClick={() => setMode(m => (m === 'pro' ? 'creative' : 'pro'))}
        className="absolute bottom-8 right-8 text-white/40 hover:text-white/90 transition-colors duration-300 text-xs tracking-widest uppercase border border-white/20 hover:border-white/60 px-4 py-2 cursor-pointer"
        style={{ fontFamily: '"Space Mono", monospace' }}
      >
        {mode === 'pro' ? 'creative' : 'pro'}
      </button>
    </div>
  )
}
