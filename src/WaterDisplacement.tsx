import { useEffect, useRef } from 'react'

const REST = 0.5
/** Slightly higher = ripples ring longer (~2–3 s feel at 60fps). */
const DAMPING = 0.982
/** Screen-space Gaussian radius (CSS px); half-res shader uses × HALF */
const GAUSS_RADIUS_PX = 30
const HALF = 0.5

/** Set true to verify canvas mount (red tint over the page). */
const WATER_DEBUG_REDDEN = false

// ─── GLSL (WebGL2 / GLSL 300 es) ─────────────────────────────────────────────

const VS_FULLSCREEN = /* glsl */ `#version 300 es
in vec2 a_pos;
out vec2 v_tex;
void main() {
  v_tex = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

function buildSimFrag(rest: number): string {
  return `#version 300 es
precision highp float;
uniform sampler2D u_curr;
uniform sampler2D u_prev;
uniform vec2 u_texel;
uniform vec2 u_resolution;
uniform float u_damping;
uniform vec2 u_mousePx;
uniform float u_radius;
uniform float u_bump;
in vec2 v_tex;
layout(location = 0) out vec4 fragColor;

void main() {
  float c = texture(u_curr, v_tex).r;
  float p = texture(u_prev, v_tex).r;
  float l = texture(u_curr, v_tex + vec2(-u_texel.x, 0.0)).r;
  float r = texture(u_curr, v_tex + vec2( u_texel.x, 0.0)).r;
  float up = texture(u_curr, v_tex + vec2(0.0, -u_texel.y)).r;
  float dn = texture(u_curr, v_tex + vec2(0.0,  u_texel.y)).r;
  float nbr = 0.25 * (l + r + up + dn);
  float next = 2.0 * c - p + u_damping * (nbr - c);

  float edge = min(min(v_tex.x, 1.0 - v_tex.x), min(v_tex.y, 1.0 - v_tex.y));
  if (edge < u_texel.x * 3.0) next = ${rest};

  if (u_bump > 0.0001) {
    vec2 px = v_tex * u_resolution;
    float dist = length(px - u_mousePx);
    float g = exp(-(dist * dist) / (2.0 * u_radius * u_radius));
    next += u_bump * g;
  }
  next = clamp(next, 0.0, 1.0);
  fragColor = vec4(next, next, next, 1.0);
}
`
}

/** Caustic-style: dFdx/dFdy edge + discrete Laplacian — thin highlights, subtle dark rims (caps 0.10 / 0.04). */
const FS_COMPOSITE = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_height;
in vec2 v_tex;
layout(location = 0) out vec4 fragColor;

void main() {
  ivec2 sz = textureSize(u_height, 0);
  vec2 texel = vec2(1.0 / float(sz.x), 1.0 / float(sz.y));

  float h = texture(u_height, v_tex).r;
  float hL = texture(u_height, v_tex - vec2(texel.x, 0.0)).r;
  float hR = texture(u_height, v_tex + vec2(texel.x, 0.0)).r;
  float hD = texture(u_height, v_tex - vec2(0.0, texel.y)).r;
  float hU = texture(u_height, v_tex + vec2(0.0, texel.y)).r;
  float lap = hL + hR + hU + hD - 4.0 * h;

  float dEdge = abs(dFdx(h) + dFdy(h)) * 40.0;
  float aCaustic = dEdge * 0.12;

  float aLapBright = max(0.0, -lap) * 90.0;
  float aLapDark = max(0.0, lap) * 65.0;

  float aLight = min(0.10, aCaustic + aLapBright);
  float aDark = min(0.04, aLapDark);

  vec4 col = vec4(1.0, 1.0, 1.0, aLight);
  col += vec4(0.0, 0.0, 0.0, aDark);
  fragColor = col;
}
`

// ─── WebGL helpers ───────────────────────────────────────────────────────────

function compile(gl: WebGL2RenderingContext, type: number, src: string, label: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  const info = gl.getShaderInfoLog(sh)
  if (info && info.trim()) {
    console.warn(`[WaterDisplacement] ${label} shader info:\n`, info)
  }
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(`[WaterDisplacement] ${label} compile FAILED:`, info)
    gl.deleteShader(sh)
    throw new Error(`Shader compile (${label}): ${info || 'unknown'}`)
  }
  return sh
}

function linkProgram(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader, label: string): WebGLProgram {
  const p = gl.createProgram()!
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  const info = gl.getProgramInfoLog(p)
  if (info && info.trim()) {
    console.warn(`[WaterDisplacement] ${label} program info:\n`, info)
  }
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(`[WaterDisplacement] ${label} link FAILED:`, info)
    gl.deleteProgram(p)
    throw new Error(`Program link (${label}): ${info || 'unknown'}`)
  }
  return p
}

type RTFormat = { internal: number; type: number; name: string }

function pickRenderTargetFormat(gl: WebGL2RenderingContext, w: number, h: number): RTFormat {
  const candidates: RTFormat[] = [
    { internal: gl.RGBA32F, type: gl.FLOAT, name: 'RGBA32F+FLOAT' },
    { internal: gl.RGBA16F, type: gl.HALF_FLOAT, name: 'RGBA16F+HALF_FLOAT' },
  ]
  for (const fmt of candidates) {
    const t = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internal, w, h, 0, gl.RGBA, fmt.type, null)
    const testFb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, testFb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0)
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    gl.deleteFramebuffer(testFb)
    gl.deleteTexture(t)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    if (st === gl.FRAMEBUFFER_COMPLETE) {
      console.log(`[WaterDisplacement] render targets: ${fmt.name} (EXT_color_buffer_float may be required for 32F)`)
      return fmt
    }
    console.warn(`[WaterDisplacement] ${fmt.name} incomplete (status ${st})`)
  }
  throw new Error('[WaterDisplacement] No float/half-float color buffer format worked')
}

function createTexWithFormat(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  fmt: RTFormat,
): WebGLTexture {
  const t = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, fmt.internal, w, h, 0, gl.RGBA, fmt.type, null)
  return t
}

function setTexFilter(gl: WebGL2RenderingContext, tex: WebGLTexture, linear: boolean) {
  const f = linear ? gl.LINEAR : gl.NEAREST
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f)
}

// ─── WaterDisplacement ───────────────────────────────────────────────────────

export default function WaterDisplacement() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const surface = canvasRef.current
    if (!surface) return

    let maybeGl = surface.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    })
    console.log('[WaterDisplacement] getContext("webgl2"):', maybeGl ? 'OK' : 'null')

    if (!maybeGl) {
      const gl1 = surface.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
      })
      console.log('[WaterDisplacement] getContext("webgl") fallback:', gl1 ? 'OK (not used — need WebGL2)' : 'null')
      if (!gl1) {
        console.error('[WaterDisplacement] No WebGL context; ripples disabled')
        return
      }
      console.error('[WaterDisplacement] WebGL2 required for float water sim; upgrade browser or GPU drivers')
      return
    }

    const gl: WebGL2RenderingContext = maybeGl as WebGL2RenderingContext
    gl.getExtension('EXT_color_buffer_float')
    gl.getExtension('OES_texture_float_linear')

    let simProgram: WebGLProgram
    let compProgram: WebGLProgram
    let vbo: WebGLBuffer

    try {
      const FS_SIM = buildSimFrag(REST)
      const vs = compile(gl, gl.VERTEX_SHADER, VS_FULLSCREEN, 'sim vs')
      const fsSim = compile(gl, gl.FRAGMENT_SHADER, FS_SIM, 'sim fs')
      const fsComp = compile(gl, gl.FRAGMENT_SHADER, FS_COMPOSITE, 'composite fs')
      simProgram = linkProgram(gl, vs, fsSim, 'sim')
      const vs2 = compile(gl, gl.VERTEX_SHADER, VS_FULLSCREEN, 'composite vs')
      compProgram = linkProgram(gl, vs2, fsComp, 'composite')
      gl.deleteShader(vs)
      gl.deleteShader(vs2)
      gl.deleteShader(fsSim)
      gl.deleteShader(fsComp)
    } catch (e) {
      console.error('[WaterDisplacement] shader pipeline failed:', e)
      return
    }

    vbo = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)

    let bufW = 0
    let bufH = 0
    let formatUsed!: RTFormat
    const tex: [WebGLTexture, WebGLTexture, WebGLTexture] = [null!, null!, null!]
    const fb: [WebGLFramebuffer, WebGLFramebuffer, WebGLFramebuffer] = [null!, null!, null!]
    let curr = 0
    let prev = 1
    let spare = 2

    function allocBuffers() {
      const w = Math.max(2, Math.floor(window.innerWidth * HALF))
      const h = Math.max(2, Math.floor(window.innerHeight * HALF))
      if (w === bufW && h === bufH) return
      bufW = w
      bufH = h

      try {
        formatUsed = pickRenderTargetFormat(gl, w, h)
      } catch (e) {
        console.error('[WaterDisplacement] allocBuffers format check failed:', e)
        return
      }

      for (let i = 0; i < 3; i++) {
        if (tex[i]) gl.deleteTexture(tex[i])
        if (fb[i]) gl.deleteFramebuffer(fb[i])
        tex[i] = createTexWithFormat(gl, w, h, formatUsed)
        fb[i] = gl.createFramebuffer()!
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb[i])
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex[i], 0)
        gl.clearColor(REST, REST, REST, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)
        const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
        if (st !== gl.FRAMEBUFFER_COMPLETE) {
          console.error(`[WaterDisplacement] FBO ${i} incomplete after alloc:`, st)
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      curr = 0
      prev = 1
      spare = 2
    }

    allocBuffers()

    let mousePx = { x: -1000, y: -1000 }
    let bump = 0
    let lastX = 0
    let lastY = 0
    let lastT = performance.now()

    function setPointer(clientX: number, clientY: number, isTouch: boolean) {
      const now = performance.now()
      const dt = Math.max(1 / 120, (now - lastT) / 1000)
      const vx = (clientX - lastX) / dt
      const vy = (clientY - lastY) / dt
      const speed = Math.hypot(vx, vy)
      lastT = now
      lastX = clientX
      lastY = clientY

      mousePx = {
        x: clientX * HALF,
        y: (window.innerHeight - clientY) * HALF,
      }

      const base = isTouch ? 0.1 : 0.08
      const velScale = Math.min(1, speed / 2600)
      bump = base * (0.35 + velScale * 0.65)
    }

    const onMove = (e: MouseEvent) => setPointer(e.clientX, e.clientY, false)
    const onTouch = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      const t = e.touches[0]
      setPointer(t.clientX, t.clientY, true)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('touchstart', onTouch, { passive: true })

    const onResize = () => {
      if (!canvasRef.current) return
      allocBuffers()
      canvasRef.current.width = window.innerWidth
      canvasRef.current.height = window.innerHeight
    }
    window.addEventListener('resize', onResize, { passive: true })
    surface.width = window.innerWidth
    surface.height = window.innerHeight

    let raf = 0
    function tick() {
      bump *= 0.96

      gl.viewport(0, 0, bufW, bufH)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb[spare])
      gl.useProgram(simProgram)

      const aPos = gl.getAttribLocation(simProgram, 'a_pos')
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
      gl.enableVertexAttribArray(aPos)
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

      gl.activeTexture(gl.TEXTURE0)
      setTexFilter(gl, tex[curr], false)
      gl.uniform1i(gl.getUniformLocation(simProgram, 'u_curr'), 0)
      gl.activeTexture(gl.TEXTURE1)
      setTexFilter(gl, tex[prev], false)
      gl.uniform1i(gl.getUniformLocation(simProgram, 'u_prev'), 1)

      gl.uniform2f(gl.getUniformLocation(simProgram, 'u_texel'), 1 / bufW, 1 / bufH)
      gl.uniform2f(gl.getUniformLocation(simProgram, 'u_resolution'), bufW, bufH)
      gl.uniform1f(gl.getUniformLocation(simProgram, 'u_damping'), DAMPING)
      gl.uniform2f(gl.getUniformLocation(simProgram, 'u_mousePx'), mousePx.x, mousePx.y)
      gl.uniform1f(gl.getUniformLocation(simProgram, 'u_radius'), GAUSS_RADIUS_PX * HALF)
      gl.uniform1f(gl.getUniformLocation(simProgram, 'u_bump'), bump)

      gl.drawArrays(gl.TRIANGLES, 0, 6)

      const nextCurr = spare
      const nextPrev = curr
      const nextSpare = prev
      curr = nextCurr
      prev = nextPrev
      spare = nextSpare

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, window.innerWidth, window.innerHeight)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

      gl.useProgram(compProgram)
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
      const aPosC = gl.getAttribLocation(compProgram, 'a_pos')
      gl.enableVertexAttribArray(aPosC)
      gl.vertexAttribPointer(aPosC, 2, gl.FLOAT, false, 0, 0)

      gl.activeTexture(gl.TEXTURE0)
      setTexFilter(gl, tex[curr], true)
      gl.uniform1i(gl.getUniformLocation(compProgram, 'u_height'), 0)

      gl.drawArrays(gl.TRIANGLES, 0, 6)

      gl.disable(gl.BLEND)

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('resize', onResize)
      for (let i = 0; i < 3; i++) {
        if (tex[i]) gl.deleteTexture(tex[i])
        if (fb[i]) gl.deleteFramebuffer(fb[i])
      }
      gl.deleteBuffer(vbo)
      gl.deleteProgram(simProgram)
      gl.deleteProgram(compProgram)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 2,
        pointerEvents: 'none',
        ...(WATER_DEBUG_REDDEN ? { backgroundColor: 'rgba(255,0,0,0.3)' } : {}),
      }}
    />
  )
}
