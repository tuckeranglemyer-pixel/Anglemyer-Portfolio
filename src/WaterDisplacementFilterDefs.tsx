import { useLayoutEffect } from 'react'

/**
 * SVG filter for MainContent: feDisplacementMap reads R/G as X/Y offset (128 = neutral).
 * feImage href is updated each frame by WaterDisplacement (CPU wave sim).
 */
export default function WaterDisplacementFilterDefs() {
  useLayoutEffect(() => {
    const fe = document.getElementById('water-fe-map')
    if (!fe) return
    const c = document.createElement('canvas')
    c.width = c.height = 1
    const ctx = c.getContext('2d')
    if (!ctx) return
    const d = ctx.createImageData(1, 1)
    d.data[0] = d.data[1] = d.data[2] = 128
    d.data[3] = 255
    ctx.putImageData(d, 0, 0)
    fe.setAttribute('href', c.toDataURL('image/png'))
  }, [])

  return (
    <svg
      aria-hidden
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        <filter
          id="water-distort"
          filterUnits="objectBoundingBox"
          x="0"
          y="0"
          width="1"
          height="1"
          colorInterpolationFilters="sRGB"
        >
          <feImage
            id="water-fe-map"
            result="map"
            x="0"
            y="0"
            width="1"
            height="1"
            preserveAspectRatio="none"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={10}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  )
}
