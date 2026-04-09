import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { LayoutLine } from '@chenglou/pretext'
import { layoutLinesFromText, getTextDimensions } from './textRenderer'
import { BIO_CREATIVE, BIO_PRO, GAP_BELOW_HERO_PX, MAX_WIDTH } from './bioSpec'
import { HERO_CREATIVE, HERO_PRO, type HeroMode } from './heroSpecs'

const BIO_COLOR = 'rgba(255,255,255,0.45)'

const RADIUS_PX = 45
const MAX_DISPLACE = 16
const LERP_IN = 0.4
const LERP_OUT = 0.35
function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t)
}

function pushMagnitudeAtDistance(dist: number): number {
  if (dist <= 1e-4 || dist > RADIUS_PX) return 0
  const t = dist / RADIUS_PX
  return MAX_DISPLACE * easeOutQuad(1 - t)
}

function countChars(lines: LayoutLine[]): number {
  return lines.reduce((n, l) => n + l.text.length, 0)
}

function computeTargetDx(
  ctx: CanvasRenderingContext2D,
  lines: LayoutLine[],
  lineHeight: number,
  fontSizePx: number,
  mx: number,
  my: number,
  targets: Float32Array,
): void {
  let charIdx = 0
  for (let i = 0; i < lines.length; i++) {
    let charX = 0
    for (const ch of lines[i].text) {
      const cw = ctx.measureText(ch).width
      const ccx = charX + cw * 0.5
      const ccy = i * lineHeight + fontSizePx * 0.5
      const ox = ccx - mx
      const oy = ccy - my
      const dist = Math.hypot(ox, oy)
      const push = pushMagnitudeAtDistance(dist)
      let tdx = 0
      if (push > 0 && dist > 1e-4) {
        tdx = (ox / dist) * push
      }
      targets[charIdx] = tdx
      charX += cw
      charIdx++
    }
  }
}

function drawBioCanvas(
  ctx: CanvasRenderingContext2D,
  lines: LayoutLine[],
  lineHeight: number,
  dx: Float32Array,
  cssW: number,
  cssH: number,
  dpr: number,
  font: string,
  color: string,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, cssW, cssH)
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'top'

  let charIdx = 0
  for (let i = 0; i < lines.length; i++) {
    let charX = 0
    for (const ch of lines[i].text) {
      const cw = ctx.measureText(ch).width
      ctx.fillText(ch, charX + dx[charIdx], i * lineHeight)
      charX += cw
      charIdx++
    }
  }
}

interface BioParagraphPlaneProps {
  mode: HeroMode
  visible?: boolean
  materialOpacity?: number
}

export default function BioParagraphPlane({ mode, visible = true, materialOpacity = 1 }: BioParagraphPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const textureRef = useRef<THREE.CanvasTexture | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const linesRef = useRef<LayoutLine[]>([])
  const dxRef = useRef<Float32Array | null>(null)
  const targetRef = useRef<Float32Array | null>(null)
  const cssDimsRef = useRef({ w: 1, h: 1 })
  const dprRef = useRef(1)
  const fontRef = useRef('')
  const lineHeightRef = useRef(31)
  const fontSizePxRef = useRef(18)

  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [heroDim, setHeroDim] = useState({ w: 0, h: 0 })

  const { viewport, size, camera } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const pointerNdc = useRef(new THREE.Vector2())
  const pointerClient = useRef({ x: 0, y: 0 })

  const isMobile = size.width < 768
  const padL = isMobile ? 24 : 48
  const padT = isMobile ? 60 : 80

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      pointerClient.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  useEffect(() => {
    const mesh = meshRef.current
    if (mesh) mesh.visible = visible
  }, [visible, texture])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const bio = mode === 'pro' ? BIO_PRO : BIO_CREATIVE
      const heroSpec = mode === 'pro' ? HERO_PRO : HERO_CREATIVE
      const heroOpts =
        'letterSpacingEm' in heroSpec ? { letterSpacingEm: heroSpec.letterSpacingEm } : undefined

      const [hDim, bioDim, lines] = await Promise.all([
        getTextDimensions(heroSpec.text, heroSpec.font, heroSpec.maxWidth, heroSpec.lineHeight, heroOpts),
        getTextDimensions(bio.text, bio.font, MAX_WIDTH, bio.lineHeight),
        layoutLinesFromText(bio.text, bio.font, MAX_WIDTH),
      ])

      if (cancelled) return

      setHeroDim({ w: Math.max(1, hDim.width), h: Math.max(1, hDim.height) })
      linesRef.current = lines
      fontRef.current = bio.font
      lineHeightRef.current = bio.lineHeight
      fontSizePxRef.current = bio.fontSizePx

      const n = countChars(lines)
      const dx = new Float32Array(n)
      dxRef.current = dx
      targetRef.current = new Float32Array(n)

      const dpr =
        typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1
      dprRef.current = dpr

      const cssW = Math.max(1, bioDim.width)
      const cssH = Math.max(1, bioDim.height)

      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(cssW * dpr)
      canvas.height = Math.ceil(cssH * dpr)
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctxRef.current = ctx

      drawBioCanvas(ctx, lines, bio.lineHeight, dx, cssW, cssH, dpr, bio.font, BIO_COLOR)

      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.minFilter = THREE.LinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.generateMipmaps = false
      tex.needsUpdate = true

      textureRef.current?.dispose()
      textureRef.current = tex
      setTexture(prev => {
        prev?.dispose()
        return tex
      })

      cssDimsRef.current = { w: cssW, h: cssH }
      setDims({ w: cssW, h: cssH })
    }

    void run()

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

  useEffect(() => {
    const mesh = meshRef.current
    if (mesh) mesh.visible = visible
  }, [visible, texture])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !texture) return
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.transparent = true
    mat.opacity = materialOpacity
  }, [texture, materialOpacity])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || !texture || dims.w < 1 || heroDim.w < 1) return

    const sx = viewport.width / size.width
    const sy = viewport.height / size.height

    const heroWorldH = heroDim.h * sy
    const bioWorldW = dims.w * sx
    const bioWorldH = dims.h * sy

    const heroCenterY = viewport.height / 2 - padT * sy - heroWorldH / 2
    const bioCenterY = heroCenterY - heroWorldH / 2 - GAP_BELOW_HERO_PX * sy - bioWorldH / 2
    const bioCenterX = -viewport.width / 2 + padL * sx + bioWorldW / 2

    mesh.scale.set(bioWorldW, bioWorldH, 1)
    mesh.position.set(bioCenterX, bioCenterY, 0.012)
  }, [viewport, size, dims, heroDim, texture, padL, padT])

  useFrame(() => {
    if (!visible) return

    const mesh = meshRef.current
    const ctx = ctxRef.current
    const tex = textureRef.current
    const lines = linesRef.current
    const dx = dxRef.current
    const targets = targetRef.current
    const css = cssDimsRef.current
    const dpr = dprRef.current

    if (!mesh || !ctx || !tex || !lines.length || !dx || !targets) return

    const { x: cx, y: cy } = pointerClient.current
    pointerNdc.current.x = (cx / size.width) * 2 - 1
    pointerNdc.current.y = -(cy / size.height) * 2 + 1

    raycaster.setFromCamera(pointerNdc.current, camera)
    const hits = raycaster.intersectObject(mesh, false)

    const font = fontRef.current
    const lh = lineHeightRef.current
    const fs = fontSizePxRef.current

    ctx.font = font

    if (hits.length > 0) {
      const uv = hits[0].uv
      if (uv) {
        const mx = uv.x * css.w
        const my = (1 - uv.y) * css.h
        computeTargetDx(ctx, lines, lh, fs, mx, my, targets)
        for (let i = 0; i < dx.length; i++) {
          dx[i] += (targets[i] - dx[i]) * LERP_IN
        }
      }
    } else {
      for (let i = 0; i < dx.length; i++) {
        dx[i] += (0 - dx[i]) * LERP_OUT
      }
    }

    drawBioCanvas(ctx, lines, lh, dx, css.w, css.h, dpr, font, BIO_COLOR)
    tex.needsUpdate = true
  })

  if (!texture) return null

  return (
    <mesh ref={meshRef} renderOrder={3}>
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
