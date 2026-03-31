/* eslint-disable react-hooks/immutability -- R3F animation: mutable refs, materials, buffers */
/* eslint-disable react-hooks/purity -- visitor XZ scatter uses RNG once per mount via useMemo(list) */
import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/** Minimal visitor shape (matches Visitor from visitors.ts) */
export type InkVisitor = { color: string; timestamp?: number }

const DEFAULT_HERO_COLOR = '#00d4ff'
const DROP_START_Y = 4
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
const VISITOR_DROP_RADIUS = 0.022
const HERO_DROP_RADIUS = 0.034
const MAX_VISITOR_DROPS = 15
const MIN_VISITOR_DROPS = 5

function easeOutExpo(x: number): number {
	return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)
}

function fallTimeFromHeight(h: number, g: number): number {
	return Math.sqrt((2 * h) / g)
}

/** Up to 15 drops when enough visitors exist; if fewer than 5, show all available. */
function pickVisitors(visitors: InkVisitor[]): InkVisitor[] {
	const n = visitors.length
	if (n === 0) return []
	if (n < MIN_VISITOR_DROPS) return visitors.slice(0, n)
	return visitors.slice(0, Math.min(MAX_VISITOR_DROPS, n))
}

function emissiveMaterial(hex: string, opacity = 1) {
	return new THREE.MeshStandardMaterial({
		color: new THREE.Color(0x000000),
		emissive: new THREE.Color(hex),
		emissiveIntensity: 2.8,
		metalness: 0,
		roughness: 0.35,
		transparent: true,
		opacity,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		toneMapped: false,
	})
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

function VisitorDrops({ list }: { list: InkVisitor[] }) {
	const count = list.length
	const mats = useMemo(
		() =>
			list.map(v => ({
				drop: emissiveMaterial(v.color, 1),
				ring: emissiveMaterial(v.color, 0),
			})),
		[list],
	)

	useEffect(() => {
		return () => mats.forEach(m => {
			m.drop.dispose()
			m.ring.dispose()
		})
	}, [mats])

	const data = useMemo<VisitorDropState[]>(
		() =>
			list.map((_, i) => ({
				startDelay: count > 1 ? (i / (count - 1)) * VISITOR_STAGGER : 0,
				x: (Math.random() - 0.5) * 2.4,
				z: (Math.random() - 0.5) * 2.4,
				phase: 'waiting',
				dropY: DROP_START_Y,
				dropVY: 0,
				ringT: 0,
			})),
		[list, count],
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
				d.dropY = DROP_START_Y
				d.dropVY = 0
				dm.visible = true
				dm.position.set(d.x, d.dropY, d.z)
			}

			if (d.phase === 'falling') {
				d.dropVY -= GRAVITY * dt
				d.dropY += d.dropVY * dt
				dm.position.y = d.dropY

				if (d.dropY <= 0) {
					d.phase = 'ring'
					dm.visible = false
					rm.visible = true
					rm.position.set(d.x, 0.002, d.z)
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
		<group>
			{list.map((v, i) => (
				<group key={`${v.color}-${i}`}>
					<mesh
						ref={(el: THREE.Mesh | null) => {
							dropMeshes.current[i] = el
						}}
						visible={false}
					>
						<sphereGeometry args={[VISITOR_DROP_RADIUS, 20, 20]} />
						<primitive object={mats[i].drop} attach="material" />
					</mesh>
					<mesh
						ref={(el: THREE.Mesh | null) => {
							ringMeshes.current[i] = el
						}}
						rotation={[-Math.PI / 2, 0, 0]}
						scale={[0.001, 0.001, 1]}
						visible={false}
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
}: {
	onComplete: () => void
	heroColor: string
	heroDelay: number
}) {
	const shakeRef = useRef<THREE.Group>(null!)
	const dropRef = useRef<THREE.Mesh>(null!)
	const ring1Ref = useRef<THREE.Mesh>(null!)
	const ring2Ref = useRef<THREE.Mesh>(null!)
	const splashRefs = useRef<(THREE.Mesh | null)[]>([])

	const dropMat = useMemo(() => emissiveMaterial(heroColor, 1), [heroColor])
	const ring1Mat = useMemo(() => emissiveMaterial(heroColor, 0), [heroColor])
	const ring2Mat = useMemo(() => emissiveMaterial(heroColor, 0), [heroColor])
	const splashMat = useMemo(() => emissiveMaterial(heroColor, 1), [heroColor])

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
	const dropY = useRef(DROP_START_Y)
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
				dropY.current = DROP_START_Y
				dropVY.current = 0
			}
			return
		}

		if (phase.current === 'falling') {
			dropVY.current -= GRAVITY * dt
			dropY.current += dropVY.current * dt
			dropRef.current.position.y = dropY.current

			if (dropY.current <= 0) {
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
					splashPos[i3 + 1] = 0.04
					splashPos[i3 + 2] = 0
					const m = splashRefs.current[i]
					if (m) {
						m.visible = true
						m.position.set(0, 0.04, 0)
					}
				}
			}
			return
		}

		if (phase.current === 'ring') {
			ringT.current += dt

			const rp1 = Math.min(ringT.current / RING_DUR, 1)
			const r1 = Math.max(0.001, easeOutExpo(rp1) * 3.0)
			ring1Ref.current.scale.set(r1, r1, 1)
			ring1Mat.opacity = 0.65 * (1 - rp1)

			const t2 = Math.max(0, ringT.current - RING2_DELAY)
			const rp2 = Math.min(t2 / RING_DUR, 1)
			if (ringT.current >= RING2_DELAY) {
				ring2Ref.current.visible = true
				const r2 = Math.max(0.001, easeOutExpo(rp2) * 3.0)
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
					if (splashPos[i3 + 1] < 0) {
						splashPos[i3 + 1] = 0
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
		<group ref={shakeRef}>
			<mesh ref={dropRef} position={[0, DROP_START_Y, 0]} visible={false}>
				<sphereGeometry args={[HERO_DROP_RADIUS, 24, 24]} />
				<primitive object={dropMat} attach="material" />
			</mesh>

			<mesh
				ref={ring1Ref}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[0.001, 0.001, 1]}
				visible={false}
			>
				<ringGeometry args={[0.98, 1.0, 128]} />
				<primitive object={ring1Mat} attach="material" />
			</mesh>

			<mesh
				ref={ring2Ref}
				rotation={[-Math.PI / 2, 0, 0]}
				scale={[0.001, 0.001, 1]}
				visible={false}
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
				>
					<sphereGeometry args={[0.018, 10, 10]} />
					<primitive object={splashMat} attach="material" />
				</mesh>
			))}
		</group>
	)
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
	const vList = useMemo(() => pickVisitors(visitors), [visitors])
	const heroDelay = useMemo(() => {
		if (vList.length === 0) return HERO_DELAY_EMPTY
		const maxStagger = vList.length > 1 ? VISITOR_STAGGER : 0
		const fall = fallTimeFromHeight(DROP_START_Y, GRAVITY)
		return maxStagger + fall + 0.15
	}, [vList.length])

	if (!active) return null

	return (
		<group renderOrder={1}>
			<ambientLight intensity={0.45} />
			<VisitorDrops list={vList} />
			<HeroInkScene onComplete={onComplete} heroColor={heroColor} heroDelay={heroDelay} />
		</group>
	)
}
