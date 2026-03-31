import * as THREE from 'three'
import { ensureFontsLoaded, layoutLinesFromText } from './textRenderer'

const TITLE_FONT = 'italic 400 28px "Instrument Serif"'
const DESC_FONT = '400 12px "Space Mono"'
const TITLE_COLOR = 'rgba(255,255,255,0.9)'
const DESC_COLOR = 'rgba(255,255,255,0.35)'
const MAX_WIDTH = 550
const BLOCK_GAP = 48
const DESC_LINE_HEIGHT = 18
const TITLE_LINE = 34

const UNT_DESC = 'AI-powered music discovery for DJs'
const WAR_DESC = '4th place, yconic AI Hackathon — multi-agent product analysis'

export type ProjectHitId = 'untracked' | 'warRoom'

export type CssRect = { left: number; top: number; right: number; bottom: number }

export type ProjectRegion = { id: ProjectHitId; rect: CssRect; href: string }

export async function buildProjectsTexture(): Promise<{
  texture: THREE.CanvasTexture
  cssW: number
  cssH: number
  regions: ProjectRegion[]
}> {
  await ensureFontsLoaded()

  const [d1, d2] = await Promise.all([
    layoutLinesFromText(UNT_DESC, DESC_FONT, MAX_WIDTH),
    layoutLinesFromText(WAR_DESC, DESC_FONT, MAX_WIDTH),
  ])

  let y = 0
  const untrackedTitleTop = y
  y += TITLE_LINE
  const untDescTop = y
  y += d1.length * DESC_LINE_HEIGHT
  const untrackedBottom = y

  y += BLOCK_GAP

  const warTitleTop = y
  y += TITLE_LINE
  y += d2.length * DESC_LINE_HEIGHT
  const cssH = Math.max(1, y)
  const cssW = MAX_WIDTH

  const canvas = document.createElement('canvas')
  const dpr =
    typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1
  canvas.width = Math.ceil(cssW * dpr)
  canvas.height = Math.ceil(cssH * dpr)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('buildProjectsTexture: no 2d context')

  ctx.scale(dpr, dpr)
  ctx.textBaseline = 'top'

  y = 0
  ctx.font = TITLE_FONT
  ctx.fillStyle = TITLE_COLOR
  ctx.fillText('Untracked', 0, y)
  y += TITLE_LINE

  ctx.font = DESC_FONT
  ctx.fillStyle = DESC_COLOR
  for (let i = 0; i < d1.length; i++) {
    ctx.fillText(d1[i].text, 0, y + i * DESC_LINE_HEIGHT)
  }
  y += d1.length * DESC_LINE_HEIGHT

  y += BLOCK_GAP

  ctx.font = TITLE_FONT
  ctx.fillStyle = TITLE_COLOR
  ctx.fillText('The War Room', 0, y)
  y += TITLE_LINE

  ctx.font = DESC_FONT
  ctx.fillStyle = DESC_COLOR
  for (let i = 0; i < d2.length; i++) {
    ctx.fillText(d2[i].text, 0, y + i * DESC_LINE_HEIGHT)
  }

  void untDescTop

  const regions: ProjectRegion[] = [
    {
      id: 'untracked',
      rect: { left: 0, top: untrackedTitleTop, right: cssW, bottom: untrackedBottom },
      href: 'https://untrackedmusic.com',
    },
    {
      id: 'warRoom',
      rect: { left: 0, top: warTitleTop, right: cssW, bottom: cssH },
      href: 'https://frontend-pi-seven-13.vercel.app/',
    },
  ]

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true

  return { texture, cssW, cssH, regions }
}
