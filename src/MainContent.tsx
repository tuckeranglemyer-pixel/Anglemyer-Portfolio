import { useState, useEffect, useRef, type ReactNode } from 'react'

type Mode = 'pro' | 'creative'

function useIsMobile(breakpoint = 768) {
  const [is, setIs] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint,
  )
  useEffect(() => {
    const update = () => setIs(window.innerWidth < breakpoint)
    window.addEventListener('resize', update, { passive: true })
    return () => window.removeEventListener('resize', update)
  }, [breakpoint])
  return is
}

function Reveal({
  children,
  delay = 0,
  active = true,
}: {
  children: ReactNode
  delay?: number
  active?: boolean
}) {
  const ref          = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!active) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setShow(true); io.disconnect() } },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [active])

  return (
    <div
      ref={ref}
      style={{
        opacity:   show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.75s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}ms,
                     transform 0.75s cubic-bezier(0.25,0.46,0.45,0.94) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

interface MainContentProps {
  mode:    Mode
  active?: boolean
}

export default function MainContent({
  mode,
  active = false,
}: MainContentProps) {
  const isMobile = useIsMobile()

  const [displayMode, setDisplayMode] = useState<Mode>(mode)
  const [heroOpacity,  setHeroOpacity]  = useState(1)

  useEffect(() => {
    if (mode === displayMode) return
    queueMicrotask(() => setHeroOpacity(0))
    const t = setTimeout(() => {
      setDisplayMode(mode)
      setHeroOpacity(1)
    }, 220)
    return () => clearTimeout(t)
  }, [mode, displayMode])

  const isPro = displayMode === 'pro'

  const hPad = isMobile ? '24px' : '48px'
  const vPad = isMobile ? '60px' : '80px'

  return (
    <div
      style={{
        maxWidth:      '600px',
        width:         '100%',
        boxSizing:     'border-box',
        overflowX:     'hidden',
        paddingLeft:   hPad,
        paddingRight:  hPad,
        paddingTop:    vPad,
        paddingBottom: isMobile ? '140px' : '96px',
        pointerEvents: 'none',
      }}
    >
      <Reveal delay={0} active={active}>
        <div
          style={{
            opacity:      heroOpacity,
            transition:   'opacity 0.22s ease',
            marginBottom: '72px',
          }}
        >
          {/* Reserve space for WebGL column: hero, bio, projects, social */}
          <div
            aria-hidden
            style={{
              marginBottom: '36px',
              minHeight: isMobile ? '520px' : (isPro ? '720px' : '620px'),
            }}
          />
        </div>
      </Reveal>
    </div>
  )
}
