/* eslint-disable react-hooks/immutability -- R3F animation: mutable refs, materials, buffers */
/* eslint-disable react-hooks/purity -- visitor XZ scatter uses RNG once per mount via useMemo(list) */
import { useMemo, useRef, useEffect, useLayoutEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Minimal visitor shape (matches Visitor from visitors.ts) */
export type InkVisitor = { color: string; timestamp?: number }

const DEFAULT_HERO_COLOR = '#38bdf8'

/** First drop starts falling within this many seconds of mount */
const FIRST_DROP_DELAY = 0.45
/** Stagger between drop *start* times (each drop gets full fall + impact) */
const DROP_STAGGER = 0.4
/** Target time from release to impact (integrate with v += g·dt) */
const TARGET_FALL_DURATION = 0.7

const RING_COUNT = 4
const RING_EXPAND_DURATION = 0.72
const RING_STAGGER = 0.055
const SPLASH_COUNT = 10
const SPLASH_LIFE = 0.48
const SHAKE_AMPLITUDE = 7
const SHAKE_DECAY_SEC = 0.15

const MAX_VISITOR_DROPS = 4
const MIN_VISITOR_DROPS = 5

/** Dev-only: bright sphere to verify frustum / z-order */
const SHOW_INK_DEBUG_SPHERE = import.meta.env.DEV

function easeOutExpo(x: number): number {
	return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)
}

/** Orthographic view: visible Y ∈ [-halfH, +halfH], X ∈ [-halfW, +halfW]. */
export type InkViewportBounds = {
	halfW: number
	halfH: number
	dropStartY: number
	groundY: number
	heroDropRadius: number
	visitorDropRadius: number
	/** Ring outer radius at full expansion (world units) — ~40–50% of viewport width */
	ringMaxScale: number
	scatter: number
	fallDistance: number
	gravity: number
	viewportWidth: number
	viewportHeight: number
}

function useInkBounds(): InkViewportBounds {
	const { viewport } = useThree()
	return useMemo(() => {
		const halfW = viewport.width / 2
		const halfH = viewport.height / 2
		/** ~4% of viewport height (e.g. ~19 units at 475px-tall frustum) */
		const heroDropRadius = viewport.height * 0.04
		const visitorDropRadius = heroDropRadius * 0.92
		const groundY = 0
		/** Above top edge (+halfH); falls to center (y=0) */
		const dropStartY = halfH + viewport.height * 0.65
		const fallDistance = Math.max(0.01, dropStartY - groundY)
		const gravity = (2 * fallDistance) / (TARGET_FALL_DURATION * TARGET_FALL_DURATION)
		/** ~40–50% of full viewport width as outer ring radius */
		const ringMaxScale = viewport.width * 0.25
		return {
			halfW,
			halfH,
			dropStartY,
			groundY,
			heroDropRadius,
			visitorDropRadius,
			ringMaxScale,
			scatter: Math.min(halfW, halfH) * 0.38,
			fallDistance,
			gravity,
			viewportWidth: viewport.width,
			viewportHeight: viewport.height,
		}
	}, [viewport.width, viewport.height])
}

function inkEmissiveMaterial(hex: string, opacity = 1) {
	const c = new THREE.Color(hex)
	return new THREE.MeshStandardMaterial({
		color: c,
		emissive: c,
		emissiveIntensity: 1.35,
		transparent: opacity < 1,
		opacity,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		depthTest: true,
		toneMapped: false,
		metalness: 0.2,
		roughness: 0.35,
	})
}

function pickVisitors(visitors: InkVisitor[]): InkVisitor[] {
	const n = visitors.length
	if (n === 0) return []
	if (n < MIN_VISITOR_DROPS) return visitors.slice(0, n)
	return visitors.slice(0, Math.min(MAX_VISITOR_DROPS, n))
}

type DropPhase = 'wait' | 'fall' | 'impact' | 'done'

type DropRuntime = {
	phase: DropPhase
	startFallAt: number
	dropY: number
	dropVY: number
	impactT: number
	ringT: number
	splashPos: Float32Array
	splashVel: Float32Array
}

type InkDropSpec = {
	color: string
	x: number
	z: number
	radius: number
	startFallAt: number
}

function InkDropsSystem({
	drops,
	bounds,
	onComplete,
}: {
	drops: InkDropSpec[]
	bounds: InkViewportBounds
	onComplete: () => void
}) {
	const shakeRef = useRef<THREE.Group>(null!)
	const count = drops.length

	const dropRefs = useRef<(THREE.Mesh | null)[]>([])
	const ringRefs = useRef<(THREE.Mesh | null)[][]>([])
	const splashRefs = useRef<(THREE.Mesh | null)[][]>([])

	useLayoutEffect(() => {
		dropRefs.current.length = count
		ringRefs.current = drops.map((_, i) => {
			const prev = ringRefs.current[i]
			if (prev && prev.length === RING_COUNT) return prev
			return new Array<THREE.Mesh | null>(RING_COUNT).fill(null)
		})
		splashRefs.current = drops.map((_, i) => {
			const prev = splashRefs.current[i]
			if (prev && prev.length === SPLASH_COUNT) return prev
			return new Array<THREE.Mesh | null>(SPLASH_COUNT).fill(null)
		})
	}, [drops, count])

	const mats = useMemo(
		() =>
			drops.map(d => ({
				drop: inkEmissiveMaterial(d.color, 1),
				rings: Array.from({ length: RING_COUNT }, () => inkEmissiveMaterial(d.color, 0)),
				splash: inkEmissiveMaterial(d.color, 1),
			})),
		[drops],
	)

	useEffect(() => {
		return () =>
			mats.forEach(m => {
				m.drop.dispose()
				m.rings.forEach(r => r.dispose())
				m.splash.dispose()
			})
	}, [mats])

	const state = useMemo<DropRuntime[]>(
		() =>
			drops.map(() => ({
				phase: 'wait',
				startFallAt: 0,
				dropY: bounds.dropStartY,
				dropVY: 0,
				impactT: 0,
				ringT: 0,
				splashPos: new Float32Array(SPLASH_COUNT * 3),
				splashVel: new Float32Array(SPLASH_COUNT * 3),
			})),
		[drops, bounds.dropStartY],
	)

	const elapsed = useRef(0)
	const doneRef = useRef(false)
	const shakeUntil = useRef(0)
	const inkStartLogged = useRef(false)

	const g = bounds.gravity

	useFrame((_, dt) => {
		elapsed.current += dt
		const t = elapsed.current

		let allDone = true

		for (let i = 0; i < count; i++) {
			const d = state[i]
			const spec = drops[i]
			const dm = dropRefs.current[i]

			if (d.phase === 'done') continue
			allDone = false

			if (d.phase === 'wait') {
				if (t >= spec.startFallAt) {
					d.phase = 'fall'
					d.dropY = bounds.dropStartY
					d.dropVY = 0
					d.startFallAt = spec.startFallAt
					if (i === 0 && !inkStartLogged.current) {
						inkStartLogged.current = true
						console.log(
							'[InkDrop] viewport bounds:',
							bounds.viewportWidth,
							bounds.viewportHeight,
							'drop radius:',
							spec.radius,
						)
					}
					if (dm) {
						dm.visible = true
						const zInk = Math.max(spec.z, 0.02)
						dm.position.set(spec.x, d.dropY, zInk)
					}
				}
				continue
			}

			if (d.phase === 'fall') {
				if (!dm) continue
				d.dropVY -= g * dt
				d.dropY += d.dropVY * dt
				dm.position.y = d.dropY
				dm.position.z = Math.max(spec.z, 0.02)

				if (d.dropY <= bounds.groundY) {
					d.phase = 'impact'
					dm.visible = false
					d.ringT = 0
					d.impactT = t
					shakeUntil.current = t + SHAKE_DECAY_SEC

					const zInk = Math.max(spec.z, 0.02)
					for (let r = 0; r < RING_COUNT; r++) {
						const rm = ringRefs.current[i][r]
						if (rm) {
							rm.visible = true
							rm.position.set(spec.x, bounds.groundY + 0.02 + r * 0.12, zInk)
							rm.scale.set(0.001, 0.001, 1)
						}
						mats[i].rings[r].opacity = 0.55
					}

					for (let s = 0; s < SPLASH_COUNT; s++) {
						const angle = (s / SPLASH_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5
						const hSp = 200 + Math.random() * 200
						const vSp = 180 + Math.random() * 220
						const i3 = s * 3
						d.splashVel[i3] = Math.cos(angle) * hSp
						d.splashVel[i3 + 1] = vSp
						d.splashVel[i3 + 2] = Math.sin(angle) * hSp
						d.splashPos[i3] = spec.x
						d.splashPos[i3 + 1] = bounds.groundY + spec.radius * 0.4
						d.splashPos[i3 + 2] = zInk
						const sm = splashRefs.current[i][s]
						if (sm) {
							sm.visible = true
							sm.position.set(spec.x, bounds.groundY + spec.radius * 0.4, zInk)
						}
					}
				}
				continue
			}

			if (d.phase === 'impact') {
				d.ringT += dt

				for (let r = 0; r < RING_COUNT; r++) {
					const localT = Math.max(0, d.ringT - r * RING_STAGGER)
					const rp = Math.min(localT / RING_EXPAND_DURATION, 1)
					const rm = ringRefs.current[i][r]
					if (!rm || !rm.visible) continue
					const scale = Math.max(0.001, easeOutExpo(rp) * bounds.ringMaxScale * (1 - r * 0.04))
					rm.scale.set(scale, scale, 1)
					const fade = 0.5 * (1 - rp * 0.95)
					mats[i].rings[r].opacity = Math.max(0, fade * (1 - r * 0.12))
					if (rp >= 1) rm.visible = false
				}

				const splashAlive = d.ringT < SPLASH_LIFE
				mats[i].splash.opacity = splashAlive ? Math.max(0, 1 - d.ringT / SPLASH_LIFE) * 0.95 : 0

				if (splashAlive) {
					for (let s = 0; s < SPLASH_COUNT; s++) {
						const i3 = s * 3
						d.splashVel[i3 + 1] -= g * dt
						d.splashPos[i3] += d.splashVel[i3] * dt
						d.splashPos[i3 + 1] += d.splashVel[i3 + 1] * dt
						d.splashPos[i3 + 2] += d.splashVel[i3 + 2] * dt
						if (d.splashPos[i3 + 1] < bounds.groundY) {
							d.splashPos[i3 + 1] = bounds.groundY
							d.splashVel[i3 + 1] *= -0.18
						}
						const sm = splashRefs.current[i][s]
						if (sm)
							sm.position.set(
								d.splashPos[i3],
								d.splashPos[i3 + 1],
								d.splashPos[i3 + 2],
							)
					}
				} else {
					for (let s = 0; s < SPLASH_COUNT; s++) {
						const sm = splashRefs.current[i][s]
						if (sm) sm.visible = false
					}
				}

				const ringsFinished = d.ringT >= RING_EXPAND_DURATION + RING_COUNT * RING_STAGGER + 0.05
				if (ringsFinished) {
					d.phase = 'done'
					for (let r = 0; r < RING_COUNT; r++) {
						const rm = ringRefs.current[i][r]
						if (rm) rm.visible = false
					}
				}
			}
		}

		const shakeT = shakeUntil.current - t
		const shakeGroup = shakeRef.current
		if (shakeGroup) {
			if (shakeT > 0) {
				const decay = Math.max(0, shakeT / SHAKE_DECAY_SEC)
				const amp = SHAKE_AMPLITUDE * decay * decay
				shakeGroup.position.x = (Math.random() - 0.5) * 2 * amp
				shakeGroup.position.y = (Math.random() - 0.5) * 2 * amp
			} else {
				shakeGroup.position.set(0, 0, 0)
			}
		}

		if (allDone && !doneRef.current) {
			doneRef.current = true
			shakeRef.current?.position.set(0, 0, 0)
			onComplete()
		}
	})

	if (count === 0) return null

	const splashR = (r: number) => THREE.MathUtils.clamp(r * 0.48, 8, 12)

	return (
		<group ref={shakeRef} renderOrder={10}>
			{drops.map((spec, i) => (
				<group key={`${spec.color}-${i}-${spec.startFallAt}`}>
					<mesh
						ref={(el: THREE.Mesh | null) => {
							dropRefs.current[i] = el
						}}
						position={[spec.x, bounds.dropStartY, Math.max(spec.z, 0.02)]}
						visible={false}
						renderOrder={10}
						castShadow
					>
						<sphereGeometry args={[spec.radius, 28, 28]} />
						<primitive object={mats[i].drop} attach="material" />
					</mesh>

					{Array.from({ length: RING_COUNT }, (_, r) => (
						<mesh
							key={r}
							ref={(el: THREE.Mesh | null) => {
								const row = ringRefs.current[i]
								if (row) row[r] = el
							}}
							rotation={[-Math.PI / 2, 0, 0]}
							scale={[0.001, 0.001, 1]}
							visible={false}
							renderOrder={10}
						>
							<ringGeometry args={[0.96, 1.0, 96]} />
							<primitive object={mats[i].rings[r]} attach="material" />
						</mesh>
					))}

					{Array.from({ length: SPLASH_COUNT }, (_, s) => (
						<mesh
							key={s}
							ref={(el: THREE.Mesh | null) => {
								const row = splashRefs.current[i]
								if (row) row[s] = el
							}}
							position={[spec.x, bounds.groundY, Math.max(spec.z, 0.02)]}
							visible={false}
							renderOrder={10}
						>
							<sphereGeometry args={[splashR(spec.radius), 8, 8]} />
							<primitive object={mats[i].splash} attach="material" />
						</mesh>
					))}
				</group>
			))}
		</group>
	)
}

function InkEntryDebugLog() {
	const { camera } = useThree()
	const frame = useRef(0)
	useFrame(() => {
		frame.current++
		if (frame.current % 120 !== 1) return
		if (camera instanceof THREE.OrthographicCamera) {
			const c = camera
			console.log('[InkEntryScene] camera:', camera.type, {
				left: c.left,
				right: c.right,
				top: c.top,
				bottom: c.bottom,
				near: c.near,
				far: c.far,
				zoom: c.zoom,
				position: camera.position.toArray(),
			})
		} else {
			console.log('[InkEntryScene] camera:', camera.type)
		}
	})
	return null
}

export type InkEntrySceneProps = {
	visitors: InkVisitor[]
	heroColor?: string
	onComplete: () => void
	active: boolean
}

export default function InkEntryScene({
	visitors,
	heroColor = DEFAULT_HERO_COLOR,
	onComplete,
	active,
}: InkEntrySceneProps) {
	const bounds = useInkBounds()
	const vList = useMemo(() => pickVisitors(visitors), [visitors])

	const dropSpecs = useMemo<InkDropSpec[]>(() => {
		const list: InkDropSpec[] = [
			{
				color: heroColor,
				x: 0,
				z: 0,
				radius: bounds.heroDropRadius,
				startFallAt: FIRST_DROP_DELAY,
			},
		]
		for (let i = 0; i < vList.length; i++) {
			const v = vList[i]!
			list.push({
				color: v.color,
				x: (Math.random() - 0.5) * 2 * bounds.scatter,
				z: (Math.random() - 0.5) * 2 * bounds.scatter,
				radius: bounds.visitorDropRadius,
				startFallAt: FIRST_DROP_DELAY + (i + 1) * DROP_STAGGER,
			})
		}
		return list
	}, [heroColor, vList, bounds])

	if (!active) return null

	return (
		<group position={[0, 0, 0.02]} renderOrder={10}>
			<InkEntryDebugLog />
			<ambientLight intensity={0.45} />
			<pointLight position={[0, bounds.halfH, 2]} intensity={0.85} color="#ffffff" />
			{SHOW_INK_DEBUG_SPHERE && (
				<mesh position={[0, 0, 0.02]} renderOrder={11}>
					<sphereGeometry args={[Math.max(bounds.heroDropRadius, 8), 16, 16]} />
					<meshBasicMaterial color="#ff0000" depthTest={false} depthWrite={false} toneMapped={false} />
				</mesh>
			)}
			<InkDropsSystem drops={dropSpecs} bounds={bounds} onComplete={onComplete} />
		</group>
	)
}
