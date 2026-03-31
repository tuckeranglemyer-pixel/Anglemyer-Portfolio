/* eslint-disable react-hooks/immutability -- R3F animation: mutable refs, materials, buffers */
/* eslint-disable react-hooks/purity -- visitor XZ scatter uses RNG once per mount via useMemo(list) */
import { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Minimal visitor shape (matches Visitor from visitors.ts) */
export type InkVisitor = { color: string; timestamp?: number }

const DEFAULT_HERO_COLOR = '#00d4ff'
const GRAVITY = 16
const HERO_DELAY_EMPTY = 0.5
const VISITOR_STAGGER = 1.5
const RING_DUR = 1.2
const RING2_DELAY = 0.1
const SPLASH_COUNT = 10
const SPLASH_LIFE = 0.5
const VISITOR_RING_DUR = 0.7
const SHAKE_AMP = 0.15
const SHAKE_DUR = 0.2
const MAX_VISITOR_DROPS = 15
const MIN_VISITOR_DROPS = 5

/** Dev-only: bright sphere to verify frustum / z-order */
const SHOW_INK_DEBUG_SPHERE = import.meta.env.DEV

function easeOutExpo(x: number): number {
	return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)
}

function fallTimeFromHeight(h: number, g: number): number {
	return Math.sqrt((2 * h) / g)
}

/** Orthographic view: visible Y ∈ [-halfH, +halfH], X ∈ [-halfW, +halfW]. */
export type InkViewportBounds = {
	halfW: number
	halfH: number
	dropStartY: number
	groundY: number
	heroDropRadius: number
	visitorDropRadius: number
	ringMaxScale: number
	scatter: number
}

function useInkBounds(): InkViewportBounds {
	const { viewport } = useThree()
	return useMemo(() => {
		const halfW = viewport.width / 2
		const halfH = viewport.height / 2
		const minDim = Math.min(viewport.width, viewport.height)
		return {
			halfW,
			halfH,
			dropStartY: halfH * 0.82,
			groundY: -halfH * 0.88,
			heroDropRadius: Math.max(0.055, minDim * 0.014),
			visitorDropRadius: Math.max(0.035, minDim * 0.01),
			ringMaxScale: Math.min(halfW, halfH) * 0.55,
			scatter: Math.min(halfW, halfH) * 0.42,
		}
	}, [viewport.width, viewport.height])
}

/** Basic + additive: reliable in ortho without relying on lights. */
function inkBasicMaterial(hex: string, opacity = 1) {
	return new THREE.MeshBasicMaterial({
		color: new THREE.Color(hex),
		transparent: true,
		opacity,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		depthTest: false,
		toneMapped: false,
	})
}

function pickVisitors(visitors: InkVisitor[]): InkVisitor[] {
	const n = visitors.length
	if (n === 0) return []
	if (n < MIN_VISITOR_DROPS) return visitors.slice(0, n)
	return visitors.slice(0, Math.min(MAX_VISITOR_DROPS, n))
}

type VisitorDropState = {
	startDelay: number
	x: number
	z: number
	phase: 'waiting' | 'falling' | 'ring' | 'done'
	dropY: number
	dropVY: number
	ringT: number
}

function VisitorDrops({
	list,
	bounds,
}: {
	list: InkVisitor[]
	bounds: InkViewportBounds
}) {
	const count = list.length
	const mats = useMemo(
		() =>
			list.map(v => ({
				drop: inkBasicMaterial(v.color, 1),
				ring: inkBasicMaterial(v.color, 0),
			})),
		[list],
	)

	useEffect(() => {
		return () =>
			mats.forEach(m => {
				m.drop.dispose()
				m.ring.dispose()
			})
	}, [mats])

	const data = useMemo<VisitorDropState[]>(
		() =>
			list.map((_, i) => ({
				startDelay: count > 1 ? (i / (count - 1)) * VISITOR_STAGGER : 0,
				x: (Math.random() - 0.5) * 2 * bounds.scatter,
				z: (Math.random() - 0.5) * 2 * bounds.scatter,
				phase: 'waiting',
				dropY: bounds.dropStartY,
				dropVY: 0,
				ringT: 0,
			})),
		[list, count, bounds.dropStartY, bounds.scatter],
	)

	const dropMeshes = useRef<(THREE.Mesh | null)[]>([])
	const ringMeshes = useRef<(THREE.Mesh | null)[]>([])
	const elapsed = useRef(0)

	useFrame((_, dt) => {
		elapsed.current += dt
		for (let i = 0; i < count; i++) {
			const d = data[i]
			const dm = dropMeshes.current[i]
			const rm = ringMeshes.current[i]
			if (!dm || !rm || d.phase === 'done') continue

			const t = elapsed.current - d.startDelay
			if (t < 0) continue

			if (d.phase === 'waiting') {
				d.phase = 'falling'
				d.dropY = bounds.dropStartY
				d.dropVY = 0
				dm.visible = true
				dm.position.set(d.x, d.dropY, d.z)
			}

			if (d.phase === 'falling') {
				d.dropVY -= GRAVITY * dt
				d.dropY += d.dropVY * dt
				dm.position.y = d.dropY

				if (d.dropY <= bounds.groundY) {
					d.phase = 'ring'
					dm.visible = false
					rm.visible = true
					rm.position.set(d.x, bounds.groundY + 0.002, d.z)
					d.ringT = 0
				}
			}

			if (d.phase === 'ring') {
				d.ringT += dt
				const rp = Math.min(d.ringT / VISITOR_RING_DUR, 1)
				const r = Math.max(0.001, easeOutExpo(rp) * 1.2)
				rm.scale.set(r, r, 1)
				mats[i].ring.opacity = 0.4 * (1 - rp)

				if (rp >= 1) {
					d.phase = 'done'
					rm.visible = false
				}
			}
		}
	})

	if (count === 0) return null

	return (
		<group renderOrder={10}>
			{list.map((v, i) => (
				<group key={`${v.color}-${i}`}>
					<mesh
						ref={(el: THREE.Mesh | null) => {
							dropMeshes.current[i] = el
						}}
						visible={false}
						renderOrder={10}
					>
						<sphereGeometry args={[bounds.visitorDropRadius, 20, 20]} />
						<primitive object={mats[i].drop} attach="material" />
					</mesh>
					<mesh
						ref={(el: THREE.Mesh | null) => {
							ringMeshes.current[i] = el
						}}
						rotation={[-Math.PI / 2, 0, 0]}
						scale={[0.001, 0.001, 1]}
						visible={false}
						renderOrder={10}
					>
						<ringGeometry args={[0.98, 1.0, 96]} />
						<primitive object={mats[i].ring} attach="material" />
					</mesh>
				</group>
			))}
		</group>
	)
}

function HeroInkScene({
	onComplete,
	heroColor,
	heroDelay,
	bounds,
}: {
	onComplete: () => void
	heroColor: string
	heroDelay: number
	bounds: InkViewportBounds
}) {
	const shakeRef = useRef<THREE.Group>(null!)
	const dropRef = useRef<THREE.Mesh>(null!)
	const ring1Ref = useRef<THREE.Mesh>(null!)
	const ring2Ref = useRef<THREE.Mesh>(null!)
	const splashRefs = useRef<(THREE.Mesh | null)[]>([])

	const dropMat = useMemo(() => inkBasicMaterial(heroColor, 1), [heroColor])
	const ring1Mat = useMemo(() => inkBasicMaterial(heroColor, 0), [heroColor])
	const ring2Mat = useMemo(() => inkBasicMaterial(heroColor, 0), [heroColor])
	const splashMat = useMemo(() => inkBasicMaterial(heroColor, 1), [heroColor])

	useEffect(() => {
		return () => {
			dropMat.dispose()
			ring1Mat.dispose()
			ring2Mat.dispose()
			splashMat.dispose()
		}
	}, [dropMat, ring1Mat, ring2Mat, splashMat])

	const phase = useRef<'delay' | 'falling' | 'ring'>('delay')
	const elapsed = useRef(0)
	const dropY = useRef(bounds.dropStartY)
	const dropVY = useRef(0)
	const ringT = useRef(0)
	const done = useRef(false)

	const splashPos = useMemo(() => new Float32Array(SPLASH_COUNT * 3), [])
	const splashVel = useRef(new Float32Array(SPLASH_COUNT * 3))

	useFrame((_, dt) => {
		elapsed.current += dt

		if (phase.current === 'delay') {
			if (elapsed.current >= heroDelay) {
				phase.current = 'falling'
				dropRef.current.visible = true
				dropY.current = bounds.dropStartY
				dropVY.current = 0
			}
			return
		}

		if (phase.current === 'falling') {
			dropVY.current -= GRAVITY * dt
			dropY.current += dropVY.current * dt
			dropRef.current.position.y = dropY.current

			if (dropY.current <= bounds.groundY) {
				dropRef.current.visible = false
				phase.current = 'ring'
				ringT.current = 0
				ring1Ref.current.visible = true

				for (let i = 0; i < SPLASH_COUNT; i++) {
					const angle = (i / SPLASH_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
					const hSpeed = 3.2 + Math.random() * 3.0
					const vSpeed = 2.0 + Math.random() * 3.5
					const i3 = i * 3
					splashVel.current[i3] = Math.cos(angle) * hSpeed
					splashVel.current[i3 + 1] = vSpeed
					splashVel.current[i3 + 2] = Math.sin(angle) * hSpeed
					splashPos[i3] = 0
					splashPos[i3 + 1] = bounds.groundY + 0.04
					splashPos[i3 + 2] = 0
					const m = splashRefs.current[i]
					if (m) {
						m.visible = true
						m.position.set(0, bounds.groundY + 0.04, 0)
					}
				}
			}
			return
		}

		if (phase.current === 'ring') {
			ringT.current += dt

			const rp1 = Math.min(ringT.current / RING_DUR, 1)
			const r1 = Math.max(0.001, easeOutExpo(rp1) * bounds.ringMaxScale)
			ring1Ref.current.scale.set(r1, r1, 1)
			ring1Mat.opacity = 0.65 * (1 - rp1)

			const t2 = Math.max(0, ringT.current - RING2_DELAY)
			const rp2 = Math.min(t2 / RING_DUR, 1)
			if (ringT.current >= RING2_DELAY) {
				ring2Ref.current.visible = true
				const r2 = Math.max(0.001, easeOutExpo(rp2) * bounds.ringMaxScale)
				ring2Ref.current.scale.set(r2, r2, 1)
				ring2Mat.opacity = 0.3 * (1 - rp2)
			}

			const shakeDecay = Math.max(0, 1 - ringT.current / SHAKE_DUR)
			const amp = SHAKE_AMP * shakeDecay * shakeDecay
			if (amp > 0.0001) {
				shakeRef.current.position.x = (Math.random() - 0.5) * 2 * amp
				shakeRef.current.position.y = (Math.random() - 0.5) * 2 * amp
			} else {
				shakeRef.current.position.x = 0
				shakeRef.current.position.y = 0
			}

			const lifeFrac = Math.max(0, 1 - ringT.current / SPLASH_LIFE)
			splashMat.opacity = lifeFrac * 0.95

			if (lifeFrac > 0) {
				for (let i = 0; i < SPLASH_COUNT; i++) {
					const i3 = i * 3
					splashVel.current[i3 + 1] -= GRAVITY * dt
					splashPos[i3] += splashVel.current[i3] * dt
					splashPos[i3 + 1] += splashVel.current[i3 + 1] * dt
					splashPos[i3 + 2] += splashVel.current[i3 + 2] * dt
					if (splashPos[i3 + 1] < bounds.groundY) {
						splashPos[i3 + 1] = bounds.groundY
						splashVel.current[i3 + 1] *= -0.2
					}
					const m = splashRefs.current[i]
					if (m) m.position.set(splashPos[i3], splashPos[i3 + 1], splashPos[i3 + 2])
				}
			} else {
				for (let i = 0; i < SPLASH_COUNT; i++) {
					const m = splashRefs.current[i]
					if (m) m.visible = false
				}
			}

			if (rp1 >= 1 && !done.current) {
				done.current = true
				shakeRef.current.position.set(0, 0, 0)
				onComplete()
			}
		}
	})

	return (
		<group ref={shakeRef} renderOrder={10}>
			<mesh
				ref={dropRef}
				position={[0, bounds.dropStartY, 0]}
				visible={false}
				renderOrder={10}
			>
				<sphereGeometry args={[bounds.heroDropRadius, 24, 24]} />
				<primitive object={dropMat} attach="material" />
			</mesh>

			<mesh
				ref={ring1Ref}
				position={[0, bounds.groundY + 0.001, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[0.001, 0.001, 1]}
				visible={false}
				renderOrder={10}
			>
				<ringGeometry args={[0.98, 1.0, 128]} />
				<primitive object={ring1Mat} attach="material" />
			</mesh>

			<mesh
				ref={ring2Ref}
				position={[0, bounds.groundY + 0.001, 0]}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[0.001, 0.001, 1]}
				visible={false}
				renderOrder={10}
			>
				<ringGeometry args={[0.98, 1.0, 128]} />
				<primitive object={ring2Mat} attach="material" />
			</mesh>

			{Array.from({ length: SPLASH_COUNT }, (_, i) => (
				<mesh
					key={i}
					ref={(el: THREE.Mesh | null) => {
						splashRefs.current[i] = el
					}}
					visible={false}
					renderOrder={10}
				>
					<sphereGeometry args={[Math.max(0.02, bounds.heroDropRadius * 0.55), 10, 10]} />
					<primitive object={splashMat} attach="material" />
				</mesh>
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
	const fall = fallTimeFromHeight(bounds.dropStartY - bounds.groundY, GRAVITY)
	const heroDelay = useMemo(() => {
		if (vList.length === 0) return HERO_DELAY_EMPTY
		const maxStagger = vList.length > 1 ? VISITOR_STAGGER : 0
		return maxStagger + fall + 0.15
	}, [vList.length, fall])

	if (!active) return null

	return (
		<group position={[0, 0, 0.12]} renderOrder={10}>
			<InkEntryDebugLog />
			<ambientLight intensity={0.55} />
			{SHOW_INK_DEBUG_SPHERE && (
				<mesh position={[0, 0, 0.1]} renderOrder={11}>
					<sphereGeometry args={[0.12, 16, 16]} />
					<meshBasicMaterial color="#ff0000" depthTest={false} depthWrite={false} toneMapped={false} />
				</mesh>
			)}
			<VisitorDrops list={vList} bounds={bounds} />
			<HeroInkScene
				onComplete={onComplete}
				heroColor={heroColor}
				heroDelay={heroDelay}
				bounds={bounds}
			/>
		</group>
	)
}
