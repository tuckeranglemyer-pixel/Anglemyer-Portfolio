/**
 * Generates public/og.png (1200×630) for social previews.
 * Run: node scripts/generate-og.mjs
 */
import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '../public/og.png')

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0a1628"/>
  <text
    x="600"
    y="340"
    font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    font-size="64"
    font-weight="700"
    fill="#ffffff"
    text-anchor="middle"
    letter-spacing="0.28em"
  >ANGLEMYER</text>
</svg>`

const buf = await sharp(Buffer.from(svg)).png().toBuffer()
writeFileSync(outPath, buf)
console.log('Wrote', outPath)
