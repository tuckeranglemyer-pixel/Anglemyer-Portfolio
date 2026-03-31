import {
  prepareWithSegments,
  layoutNextLine,
  type LayoutLine,
  type LayoutCursor,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'
import * as THREE from 'three'

async function ensureFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined') return
  const ready = document.fonts?.ready
  if (ready) await ready
}

function layoutTextLines(
  prepared: PreparedTextWithSegments,
  maxWidth: number,
): LayoutLine[] {
  const lines: LayoutLine[] = []
  let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
  for (;;) {
    const line = layoutNextLine(prepared, cursor, maxWidth)
    if (line === null) break
    lines.push(line)
    cursor = line.end
  }
  return lines
}

/** Shared: fonts + prepare + line loop (same as {@link layoutNextLine} walk). */
async function layoutLinesFromText(
  text: string,
  font: string,
  maxWidth: number,
): Promise<LayoutLine[]> {
  await ensureFontsLoaded()
  const prepared = prepareWithSegments(text, font)
  return layoutTextLines(prepared, maxWidth)
}

/**
 * Measures wrapped text without allocating a canvas texture.
 * Awaits `document.fonts.ready` so webfont metrics match drawing.
 */
export async function getTextDimensions(
  text: string,
  font: string,
  maxWidth: number,
  lineHeight: number,
): Promise<{ width: number; height: number }> {
  const lines = await layoutLinesFromText(text, font, maxWidth)
  if (lines.length === 0) return { width: 0, height: 0 }
  const width = Math.max(...lines.map(l => l.width))
  const height = lines.length * lineHeight
  return { width, height }
}

/**
 * Renders wrapped text to a `CanvasTexture` using the same Pretext layout as
 * {@link getTextDimensions}. Uses `devicePixelRatio` for sharp rendering.
 */
export async function renderTextToTexture(
  text: string,
  font: string,
  color: string,
  maxWidth: number,
  lineHeight: number,
): Promise<THREE.CanvasTexture> {
  if (typeof document === 'undefined') {
    throw new Error('renderTextToTexture requires a browser environment')
  }

  const lines = await layoutLinesFromText(text, font, maxWidth)

  const dpr =
    typeof window !== 'undefined' && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1

  let cssW = 0
  let cssH = 0
  if (lines.length === 0) {
    cssW = 1
    cssH = 1
  } else {
    cssW = Math.max(...lines.map(l => l.width))
    cssH = lines.length * lineHeight
  }

  const canvas = document.createElement('canvas')
  const wPx = Math.max(1, Math.ceil(cssW * dpr))
  const hPx = Math.max(1, Math.ceil(cssH * dpr))
  canvas.width = wPx
  canvas.height = hPx
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('textRenderer: could not get 2D context')
  }

  ctx.scale(dpr, dpr)
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'top'

  if (lines.length > 0) {
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i].text, 0, i * lineHeight)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false

  return texture
}
