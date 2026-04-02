/* eslint-disable react-hooks/immutability -- R3F animation: mutable refs */
import { useMemo, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Minimal visitor shape (matches Visitor from visitors.ts) */
export type InkVisitor = { color: string; timestamp?: number }

const DEFAULT_HERO_COLOR = '#38bdf8'
/** Entry animation drop — spec color (independent of stored visitor swatch) */
const ENTRY_DROP_HEX = '#38bdf8'

const FIRST_DROP_DELAY = 0.45
/** Fall from above viewport to y=0 */
const FALL_DURATION_SEC = 1.8
/** After impact, wait before onComplete (water settle) */
const SETTLE_SEC = 1.5
/** addRipple strengthScale: ~3–5× cursor bump (RIPPLE_INTENSITY=5 in useWaterSim) */
const IMPACT_RIPPLE_STRENGTH = 4
const RIPPLE_PULSE_DELAYS_SEC = [0, 0.3, 0.6]


function useDropRadius(): number {
	const { camera, viewport } = useThree()
	return useMemo(() => {
		const top =
			camera instanceof THREE.OrthographicCamera
				? Math.abs(camera.top)
				: viewport.height / 2
		return Math.max(top * 0.04, 15)
	}, [camera, viewport.height])
}

function useFallBounds() {
	const { viewport } = useThree()
	return useMemo(() => {
		const halfH = viewport.height / 2
		const groundY = 0
		const dropStartY = halfH + viewport.height * 0.65
		const fallDistance = Math.max(0.01, dropStartY - groundY)
		const gravity = (2 * fallDistance) / (FALL_DURATION_SEC * FALL_DURATION_SEC)
		return { dropStartY, groundY, gravity }
	}, [viewport.height])
}

function HeroRaindrop({
	radius,
	gravity,
	dropStartY,
	groundY,
	colorHex,
	addRipple,
	onComplete,
}: {
	radius: number
	gravity: number
	dropStartY: number
	groundY: number
	colorHex: string
	addRipple: (screenX: number, screenY: number, strengthScale?: number) => void
	onComplete: () => void
}) {
	const groupRef = useRef<THREE.Group>(null!)
	const phaseRef = useRef<'wait' | 'fall' | 'settle'>('wait')
	const tRef = useRef(0)
	const vyRef = useRef(0)
	const impactAtRef = useRef<number | null>(null)
	const rippleFiredRef = useRef([false, false, false])
	const doneRef = useRef(false)

	const mat = useMemo(
		() =>
			new THREE.MeshStandardMaterial({
				color: colorHex,
				emissive: colorHex,
				emissiveIntensity: 2,
				metalness: 0.9,
				roughness: 0.1,
				toneMapped: true,
			}),
		[colorHex],
	)

	useEffect(() => {
		return () => {
			mat.dispose()
		}
	}, [mat])

	const cx = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 0
	const cy = typeof window !== 'undefined' ? window.innerHeight * 0.5 : 0

	useFrame((_, dt) => {
		console.log('[InkEntryScene] animation tick running')
		if (doneRef.current) return
		tRef.current += dt
		const t = tRef.current
		const g = groupRef.current
		if (!g) return

		if (phaseRef.current === 'wait') {
			if (t < FIRST_DROP_DELAY) return
			phaseRef.current = 'fall'
			vyRef.current = 0
			g.position.set(0, dropStartY, 1)
			g.visible = true
			return
		}

		if (phaseRef.current === 'fall') {
			vyRef.current -= gravity * dt
			const newY = g.position.y + vyRef.current * dt

			if (newY <= groundY) {
				g.visible = false
				phaseRef.current = 'settle'
				impactAtRef.current = t
				rippleFiredRef.current = [false, false, false]
				return
			}
			g.position.y = newY
			return
		}

		if (phaseRef.current === 'settle') {
			const impactT = impactAtRef.current
			if (impactT === null) return
			const since = t - impactT

			for (let p = 0; p < RIPPLE_PULSE_DELAYS_SEC.length; p++) {
				if (!rippleFiredRef.current[p] && since >= RIPPLE_PULSE_DELAYS_SEC[p]!) {
					rippleFiredRef.current[p] = true
					addRipple(cx, cy, IMPACT_RIPPLE_STRENGTH)
				}
			}

			if (since >= SETTLE_SEC) {
				doneRef.current = true
				onComplete()
			}
		}
	})

	return (
		<group ref={groupRef} position={[0, dropStartY, 1]} visible={false} renderOrder={10}>
			<pointLight
				position={[0, 0, 0]}
				color={colorHex}
				intensity={2.2}
				distance={800}
				decay={2}
			/>
			<mesh renderOrder={10}>
				<sphereGeometry args={[radius, 48, 48]} />
				<primitive object={mat} attach="material" />
			</mesh>
		</group>
	)
}

export type InkEntrySceneProps = {
	visitors: InkVisitor[]
	heroColor?: string
	onComplete: () => void
	active: boolean
	addRipple: (screenX: number, screenY: number, strengthScale?: number) => void
}

export default function InkEntryScene({
	visitors: _visitors,
	heroColor: _heroColor = DEFAULT_HERO_COLOR,
	onComplete,
	active,
	addRipple,
}: InkEntrySceneProps) {
	console.log('[InkEntryScene] MOUNTED, phase should be entry')
	const radius = useDropRadius()
	const { dropStartY, groundY, gravity } = useFallBounds()
	const { viewport } = useThree()

	if (!active) return null

	return (
		<group position={[0, 0, 0]} renderOrder={10}>
			<ambientLight intensity={0.55} />
			<directionalLight
				position={[0, viewport.height * 0.5, 4]}
				intensity={0.85}
				color="#ffffff"
			/>
			<HeroRaindrop
				radius={radius}
				gravity={gravity}
				dropStartY={dropStartY}
				groundY={groundY}
				colorHex={ENTRY_DROP_HEX}
				addRipple={addRipple}
				onComplete={onComplete}
			/>
		</group>
	)
}
