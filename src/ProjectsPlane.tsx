import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { BIO_CREATIVE, BIO_PRO, GAP_BELOW_BIO_PX, GAP_BELOW_HERO_PX, MAX_WIDTH } from './bioSpec'
import { buildProjectsTexture, type ProjectRegion } from './buildProjectsTexture'
import { getTextDimensions } from './textRenderer'
import { HERO_CREATIVE, HERO_PRO, type HeroMode } from './heroSpecs'
import { useRegisterWebGLInteraction } from './webglHitContext'

interface ProjectsPlaneProps {
  mode: HeroMode
  visible?: boolean
  materialOpacity?: number
}

export default function ProjectsPlane({ mode, visible = true, materialOpacity = 1 }: ProjectsPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const register = useRegisterWebGLInteraction()

  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [heroDim, setHeroDim] = useState({ w: 0, h: 0 })
  const [bioDim, setBioDim] = useState({ w: 0, h: 0 })
  const regionsRef = useRef<ProjectRegion[]>([])

  const { viewport, size } = useThree()

  const isMobile = size.width < 768
  const padL = isMobile ? 24 : 48
  const padT = isMobile ? 60 : 80

  useEffect(() => {
    const mesh = meshRef.current
    if (mesh) mesh.visible = visible
  }, [visible, texture])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const { texture: tex, cssW, cssH, regions } = await buildProjectsTexture(mode)
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
  }, [mode])

  useEffect(() => {
    let cancelled = false
    const bio = mode === 'pro' ? BIO_PRO : BIO_CREATIVE
    const heroSpec = mode === 'pro' ? HERO_PRO : HERO_CREATIVE
    const heroOpts =
      'letterSpacingEm' in heroSpec ? { letterSpacingEm: heroSpec.letterSpacingEm } : undefined

    void (async () => {
      const [h, b] = await Promise.all([
        getTextDimensions(heroSpec.text, heroSpec.font, heroSpec.maxWidth, heroSpec.lineHeight, heroOpts),
        getTextDimensions(bio.text, bio.font, MAX_WIDTH, bio.lineHeight),
      ])
      if (cancelled) return
      setHeroDim({ w: h.width, h: h.height })
      setBioDim({ w: b.width, h: b.height })
    })()

    return () => {
      cancelled = true
    }
  }, [mode])

  useEffect(() => {
    return () => {
      textureRef.current?.dispose()
      textureRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !texture) return
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.transparent = true
    mat.opacity = materialOpacity
  }, [texture, materialOpacity])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !texture || dims.w < 1 || heroDim.w < 1 || bioDim.w < 1) return

    const sx = viewport.width / size.width
    const sy = viewport.height / size.height

    const heroWorldH = heroDim.h * sy
    const bioWorldH = bioDim.h * sy
    const projectsWorldW = dims.w * sx
    const projectsWorldH = dims.h * sy

    const heroCenterY = viewport.height / 2 - padT * sy - heroWorldH / 2
    const bioCenterY = heroCenterY - heroWorldH / 2 - GAP_BELOW_HERO_PX * sy - bioWorldH / 2
    const bioBottom = bioCenterY - bioWorldH / 2

    const projectsCenterY = bioBottom - GAP_BELOW_BIO_PX * sy - projectsWorldH / 2
    const projectsCenterX = -viewport.width / 2 + padL * sx + projectsWorldW / 2

    mesh.scale.set(projectsWorldW, projectsWorldH, 1)
    mesh.position.set(projectsCenterX, projectsCenterY, 0.014)
  }, [viewport, size, dims, heroDim, bioDim, texture, padL, padT])

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
    <mesh ref={meshRef} renderOrder={4}>
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
