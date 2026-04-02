import { useEffect, useRef } from 'react'

type InkDropOverlayProps = {
	onImpact: () => void
	onComplete: () => void
}

/** CSS cubic-bezier(0.15, 0, 0.65, 1): linear time → eased progress for value interpolation */
function cubicBezierEased(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	linearT: number,
): number {
	const sampleCurveX = (t: number) => {
		const o = 1 - t
		return 3 * o * o * t * x1 + 3 * o * t * t * x2 + t * t * t
	}
	const sampleCurveY = (t: number) => {
		const o = 1 - t
		return 3 * o * o * t * y1 + 3 * o * t * t * y2 + t * t * t
	}
	let lo = 0
	let hi = 1
	for (let i = 0; i < 28; i++) {
		const mid = (lo + hi) * 0.5
		if (sampleCurveX(mid) < linearT) lo = mid
		else hi = mid
	}
	const t = (lo + hi) * 0.5
	return sampleCurveY(t)
}

export default function InkDropOverlay({ onImpact, onComplete }: InkDropOverlayProps) {
	const dropRef = useRef<HTMLDivElement>(null)
	const onImpactRef = useRef(onImpact)
	const onCompleteRef = useRef(onComplete)
	onImpactRef.current = onImpact
	onCompleteRef.current = onComplete

	useEffect(() => {
		let rafId = 0
		let settleId: ReturnType<typeof setTimeout> | undefined
		const startDelayId = window.setTimeout(() => {
			const duration = 1800
			const start = performance.now()
			const startTop = -40
			const endTop = typeof window !== 'undefined' ? window.innerHeight * 0.5 : 0
			console.log('[InkDropOverlay] start top:', startTop, 'end top:', endTop)

			const tick = (now: number) => {
				const elapsed = now - start
				const linearT = Math.min(1, elapsed / duration)
				const eased = cubicBezierEased(0.15, 0, 0.65, 1, linearT)
				const topPx = startTop + (endTop - startTop) * eased
				const el = dropRef.current
				if (el) el.style.top = `${topPx}px`

				if (linearT < 1) {
					rafId = requestAnimationFrame(tick)
					return
				}

				console.log('[InkDropOverlay] HIT center')
				if (el) el.style.opacity = '0'
				onImpactRef.current()
				settleId = window.setTimeout(() => {
					onCompleteRef.current()
				}, 1500)
			}

			rafId = requestAnimationFrame(tick)
		}, 500)

		return () => {
			clearTimeout(startDelayId)
			cancelAnimationFrame(rafId)
			if (settleId !== undefined) clearTimeout(settleId)
		}
	}, [])

	return (
		<div
			aria-hidden
			style={{
				position: 'fixed',
				inset: 0,
				zIndex: 9999,
				pointerEvents: 'none',
			}}
		>
			<div
				ref={dropRef}
				style={{
					position: 'absolute',
					left: '50%',
					transform: 'translateX(-50%)',
					top: -40,
					width: 16,
					height: 24,
					borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
					background:
						'radial-gradient(circle at 35% 25%, rgba(220,240,255,0.95), rgba(56,189,248,0.8), rgba(30,120,200,0.6))',
					boxShadow:
						'0 0 12px rgba(56,189,248,0.8), 0 0 30px rgba(56,189,248,0.4), 0 0 60px rgba(56,189,248,0.15)',
					opacity: 1,
				}}
			>
				<div
					style={{
						position: 'absolute',
						top: 4,
						left: 5,
						width: 4,
						height: 4,
						borderRadius: '50%',
						background: '#ffffff',
						opacity: 0.8,
						pointerEvents: 'none',
					}}
				/>
			</div>
		</div>
	)
}
