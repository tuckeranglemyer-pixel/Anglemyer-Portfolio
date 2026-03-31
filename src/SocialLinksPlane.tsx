import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { buildSocialTexture, type SocialRegion } from './buildSocialTexture'
import { useRegisterWebGLInteraction } from './webglHitContext'

interface SocialLinksPlaneProps {
  visible?: boolean
}

export default function SocialLinksPlane({ visible = true }: SocialLinksPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const register = useRegisterWebGLInteraction()

  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const regionsRef = useRef<SocialRegion[]>([])

  const { viewport, size } = useThree()

  const isMobile = size.width < 768
  const padL = isMobile ? 24 : 48
  const bottomPad = isMobile ? 140 : 96

  useEffect(() => {
    const mesh = meshRef.current
    if (mesh) mesh.visible = visible
  }, [visible, texture])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const { texture: tex, cssW, cssH, regions } = await buildSocialTexture()
      if (cancelled) {
        tex.dispose()
        return
      }
      regionsRef.current = regions
      textureRef.current?.dispose()
      textureRef.current = tex
      setTexture(prev => {
        prev?.dispose()
        return tex
      })
      setDims({ w: cssW, h: cssH })
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      textureRef.current?.dispose()
      textureRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !texture || dims.w < 1) return

    const sx = viewport.width / size.width
    const sy = viewport.height / size.height

    const worldW = dims.w * sx
    const worldH = dims.h * sy

    const centerX = -viewport.width / 2 + padL * sx + worldW / 2
    const centerY = -viewport.height / 2 + bottomPad * sy + worldH / 2

    mesh.scale.set(worldW, worldH, 1)
    mesh.position.set(centerX, centerY, 0.015)
  }, [viewport, size, dims, texture, padL, bottomPad])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !texture || dims.w < 1) return

    const regions = regionsRef.current.map(r => ({ rect: r.rect, href: r.href }))
    return register({
      mesh,
      cssW: dims.w,
      cssH: dims.h,
      regions,
    })
  }, [register, texture, dims])

  if (!texture) return null

  return (
    <mesh ref={meshRef} renderOrder={5}>
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
