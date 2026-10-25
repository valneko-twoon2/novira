// Shader of the start-up screen: a bright summer sky filling the screen, its clouds drifting and changing shape all
// the time, with sunlight from the top left, light dust that glitters and soft orbs of light rising.

export const VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uCloud;
uniform vec3 uCloudShade;
uniform float uGlow;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

// Soft discs of light rising slowly, two sizes, each fading in and out on its own time.
vec3 orbs(vec2 q, float t) {
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    vec2 p = q * (5.0 + fi * 4.0) + vec2(fi * 3.7, 0.0);
    p.y -= t * (0.05 + 0.03 * fi);
    p.x += sin(t * 0.2 + fi) * 0.3;
    vec2 id = floor(p);
    float h = hash(id + fi * 17.0);
    vec2 off = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.5;
    float rad = 0.1 + 0.16 * h;
    float d = length(fract(p) - 0.5 - off);
    float twinkle = 0.5 + 0.5 * sin(t * (0.5 + h * 1.1) + h * 40.0);
    // A bubble: a faint body and a brighter rim, tinted pastel pink, aqua or gold.
    float body = smoothstep(rad, rad * 0.7, d);
    float rim = smoothstep(rad * 0.5, rad * 0.92, d) * body;
    vec3 tint = 0.5 + 0.5 * cos(6.2832 * (fract(h * 7.0) * 0.5 + vec3(0.0, 0.33, 0.67)));
    acc += mix(vec3(1.0), tint, 0.55) * (body * 0.07 + rim * 0.3) * step(0.7, h) * twinkle;
  }
  return acc;
}

// Light over everything: a glow from the top left, slow slanting beams of sun through leaves, and the orbs.
vec3 atmosphere(vec3 col, vec2 uv, float aspect) {
  vec2 q = vec2(uv.x * aspect, uv.y);
  float sun = clamp(1.0 - length((uv - vec2(0.05, 1.05)) * vec2(aspect, 1.0)) * 0.7, 0.0, 1.0);
  float beams = sin((q.x - q.y * 0.7) * 6.0 + uTime * 0.12) * 0.5 + 0.5;
  beams *= sin((q.x - q.y * 0.7) * 2.3 - uTime * 0.07 + 1.0) * 0.5 + 0.5;
  col += vec3(1.0, 0.97, 0.88) * (sun * sun * 0.2 + beams * sun * 0.12) * uGlow;
  col += orbs(q, uTime) * uGlow;
  // High-key haze: lifts the blacks a little so the whole picture looks airy.
  return mix(col, vec3(0.9, 0.99, 1.0), 0.04 * uGlow);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  // A faint swell so the sky is never perfectly still.
  vec2 swell = vec2(sin(uv.y * 11.0 + uTime * 0.6) + sin((uv.x + uv.y) * 7.0 - uTime * 0.45), cos(uv.x * 9.0 - uTime * 0.5)) * 0.0012;
  vec2 p = uv + swell;
  vec2 q = vec2(p.x * aspect, p.y);

  // The sky: deep at one corner, pale towards the other, light towards the horizon.
  float g = clamp(0.65 * (1.0 - p.y) + 0.45 * p.x - 0.1, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, g);
  // Pastel glow low on the right, like light scattered through clear air.
  col = mix(col, vec3(1.0, 0.86, 0.93), smoothstep(0.55, 1.4, p.x + (1.0 - p.y) * 0.5) * 0.16 * uGlow);

  // Clouds drift with the wind and keep changing shape (the warp moves on its own clock).
  vec2 c = q * 1.4 + vec2(uTime * 0.018, uTime * 0.009);
  vec2 warp = vec2(fbm(c + vec2(0.0, uTime * 0.02)), fbm(c + vec2(5.2, 1.3) - uTime * 0.017));
  float d = fbm(c + warp * 1.4);
  float cover = smoothstep(0.56, 0.9, d);
  float wisp = smoothstep(0.4, 0.62, d) * 0.12;
  float shadow = smoothstep(0.5, 0.9, fbm(c * 1.8 + warp * 2.0 + 3.0));
  vec3 cloud = mix(uCloud, uCloudShade, shadow * 0.7);
  col = mix(col, cloud, clamp(cover + wisp, 0.0, 1.0) * 0.68);

  // Light dust: tiny points that flash on their own clocks.
  vec2 gp = q * 90.0;
  float gh = hash(floor(gp));
  float flash = max(sin(uTime * (2.0 + gh * 3.0) + gh * 60.0), 0.0);
  float spark = step(0.988, gh) * flash * smoothstep(0.5, 0.1, length(fract(gp) - 0.5));
  col += vec3(1.0) * spark * 0.6 * uGlow;

  gl_FragColor = vec4(atmosphere(col, uv, aspect), 1.0);
}
`;
