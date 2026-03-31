import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { HERO_CREATIVE, HERO_PRO, type HeroMode } from './heroSpecs'
import { renderTextToTexture } from './textRenderer'

export type { HeroMode }

interface HeroPlaneProps {
  mode: HeroMode
  /** Hide the mesh without disposing the texture (e.g. before main phase). */
  visible?: boolean
  /** Multiplied with texture alpha (0–1). */
  materialOpacity?: number
}

export default function HeroPlane({ mode, visible = true, materialOpacity = 1 }: HeroPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const textureForUnmount = useRef<THREE.CanvasTexture | null>(null)
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const [dims, setDims] = useState({ w: 1, h: 1 })
  const { viewport, size } = useThree()

  const isMobile = size.width < 768
  const padL = isMobile ? 24 : 48
  const padT = isMobile ? 60 : 80

  useEffect(() => {
    textureForUnmount.current = texture
  }, [texture])

  useEffect(() => {
    return () => {
      textureForUnmount.current?.dispose()
      textureForUnmount.current = null
    }
  }, [])

  useEffect(() => {
    const mesh = meshRef.current
    if (mesh) mesh.visible = visible
  }, [visible, texture])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const spec = mode === 'pro' ? HERO_PRO : HERO_CREATIVE
      const opts =
        'letterSpacingEm' in spec ? { letterSpacingEm: spec.letterSpacingEm } : undefined

      const tex = await renderTextToTexture(
        spec.text,
        spec.font,
        spec.color,
        spec.maxWidth,
        spec.lineHeight,
        opts,
      )

      if (cancelled) {
        tex.dispose()
        return
      }

      setTexture(prev => {
        prev?.dispose()
        return tex
      })

      const img = tex.image as HTMLCanvasElement
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      setDims({ w: img.width / dpr, h: img.height / dpr })
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [mode])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !texture) return
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.transparent = true
    mat.opacity = materialOpacity
  }, [texture, materialOpacity])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !texture) return

    const sx = viewport.width / size.width
    const sy = viewport.height / size.height
    const worldW = dims.w * sx
    const worldH = dims.h * sy

    mesh.scale.set(worldW, worldH, 1)
    mesh.position.set(
      -viewport.width / 2 + padL * sx + worldW / 2,
      viewport.height / 2 - padT * sy - worldH / 2,
      0.01,
    )
  }, [viewport, size, dims, texture, padL, padT])

  if (!texture) return null

  return (
    <mesh ref={meshRef} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.02}
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
        color={0xffffff}
      />
    </mesh>
  )
}
