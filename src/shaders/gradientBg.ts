/**
 * Fullscreen orthographic background: animated gradient + 3D simplex noise.
 * uMode: 0 = pro (navy), 1 = creative (warm dark); lerped in fragment shader.
 */

export const gradientVertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Ashima 3D simplex noise (MIT), compact
export const gradientFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uMode;
varying vec2 vUv;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.12;

  vec3 pro1 = vec3(0.039215686, 0.08627451, 0.156862745);
  vec3 pro2 = vec3(0.050980392, 0.121568627, 0.235294118);
  vec3 pro3 = vec3(0.023529412, 0.054901961, 0.117647059);

  vec3 cre1 = vec3(0.101960784, 0.039215686, 0.039215686);
  vec3 cre2 = vec3(0.121568627, 0.062745098, 0.019607843);
  vec3 cre3 = vec3(0.054901961, 0.039215686, 0.117647059);

  vec3 c1 = mix(pro1, cre1, uMode);
  vec3 c2 = mix(pro2, cre2, uMode);
  vec3 c3 = mix(pro3, cre3, uMode);

  vec3 p = vec3(uv * vec2(1.6, 1.2), t * 0.4);
  float n0 = snoise(p);
  float n1 = snoise(p * 2.1 + vec3(5.2, 1.7, -t * 0.3));
  float n2 = snoise(p * 4.3 + vec3(-2.0, 4.0, t * 0.15));
  float n = n0 * 0.55 + n1 * 0.3 + n2 * 0.15;

  float angle = uv.x * 6.283185307 + n * 0.35 + t * 0.08;
  float radial = length(uv - 0.5) + n * 0.12;
  float flow = uv.y * 0.85 + 0.08 * sin(angle) + 0.06 * cos(radial * 8.0 - t);

  float w1 = smoothstep(0.0, 0.42, flow);
  float w2 = smoothstep(0.35, 0.92, flow);
  vec3 col = mix(c1, c2, w1);
  col = mix(col, c3, w2);

  col += vec3(n * 0.032);
  float vig = 1.0 - radial * 0.35;
  col *= vig;

  gl_FragColor = vec4(col, 1.0);
}
`
