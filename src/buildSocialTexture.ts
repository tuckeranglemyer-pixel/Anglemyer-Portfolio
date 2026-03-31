import * as THREE from 'three'
import type { CssRect } from './buildProjectsTexture'
import { ensureFontsLoaded } from './textRenderer'

const LINK_FONT = '400 11px "Space Mono"'
const EMAIL_FONT = '400 11px "Space Mono"'
const LINK_COLOR = 'rgba(255,255,255,0.35)'
const EMAIL_COLOR = 'rgba(255,255,255,0.25)'
const LINE_GAP = 14
const SPACE_BETWEEN = '  '

export type SocialHitId = 'github' | 'linkedin' | 'tiktok' | 'email'

export type SocialRegion = { id: SocialHitId; rect: CssRect; href: string }

const LINKS: { id: SocialHitId; label: string; href: string }[] = [
  { id: 'github', label: 'GitHub', href: 'https://github.com/tuckeranglemyer-pixel' },
  { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/tucker-anglemyer-42a13a32b' },
  { id: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@untrackedmusic' },
]

export async function buildSocialTexture(): Promise<{
  texture: THREE.CanvasTexture
  cssW: number
  cssH: number
  regions: SocialRegion[]
}> {
  await ensureFontsLoaded()

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('buildSocialTexture: no 2d context')

  ctx.font = LINK_FONT
  const line1Parts: { text: string; hit?: SocialHitId; href?: string }[] = []
  for (let i = 0; i < LINKS.length; i++) {
    line1Parts.push({ text: LINKS[i].label, hit: LINKS[i].id, href: LINKS[i].href })
    if (i < LINKS.length - 1) line1Parts.push({ text: SPACE_BETWEEN })
  }

  const line1 = line1Parts.map(p => p.text).join('')
  const line2 = 'tucker@untrackedmusic.com'

  const w1 = ctx.measureText(line1).width
  ctx.font = EMAIL_FONT
  const w2 = ctx.measureText(line2).width
  const cssW = Math.ceil(Math.max(w1, w2, 1))
  const line1H = 14
  const line2H = 14
  const cssH = line1H + LINE_GAP + line2H

  const dpr =
    typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1
  canvas.width = Math.ceil(cssW * dpr)
  canvas.height = Math.ceil(cssH * dpr)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`

  const ctx2 = canvas.getContext('2d')!
  ctx2.scale(dpr, dpr)
  ctx2.textBaseline = 'top'

  const regions: SocialRegion[] = []

  ctx2.font = LINK_FONT
  ctx2.fillStyle = LINK_COLOR
  let x = 0
  let y = 0
  for (const part of line1Parts) {
    const w = ctx2.measureText(part.text).width
    if (part.hit && part.href) {
      regions.push({
        id: part.hit,
        rect: { left: x, top: y, right: x + w, bottom: y + line1H },
        href: part.href,
      })
    }
    ctx2.fillText(part.text, x, y)
    x += w
  }

  y += line1H + LINE_GAP
  ctx2.font = EMAIL_FONT
  ctx2.fillStyle = EMAIL_COLOR
  ctx2.fillText(line2, 0, y)
  regions.push({
    id: 'email',
    rect: { left: 0, top: y, right: cssW, bottom: y + line2H },
    href: 'mailto:tucker@untrackedmusic.com',
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true

  return { texture, cssW, cssH, regions }
}
