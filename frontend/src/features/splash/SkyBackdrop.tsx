// The start-up screen's background: a bright summer sky (skyShader.ts) with drifting clouds, sunlight
// and rising light. Without WebGL the canvas stays empty and the plain page colour shows.
import { useEffect, useRef } from 'react';
import { parseHex, type Rgb } from './skyColour';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './skyShader';

/** Canvas pixels per CSS pixel: on a GPU, and when WebGL runs in software (no GPU, a VM, a headless test browser). */
const RENDER_SCALE = 0.5;
const SOFTWARE_RENDER_SCALE = 0.25;
const MAX_FPS = 30;

interface Sky {
  zenith: Rgb;
  horizon: Rgb;
  cloud: Rgb;
  cloudShade: Rgb;
  /** Strength of the sunlight, light dust and light orbs: full by day, softer in the dark theme. */
  glow: number;
}

function readSky(el: Element): Sky {
  const style = getComputedStyle(el);
  const get = (name: string, fallback: Rgb) => parseHex(style.getPropertyValue(name), fallback);
  const page = get('--bg-app', { r: 0, g: 0, b: 0 });
  const dark = page.r + page.g + page.b < 3 * 128;
  return {
    zenith: get('--sky-zenith', { r: 31, g: 95, b: 196 }),
    horizon: get('--sky-horizon', { r: 169, g: 205, b: 245 }),
    cloud: get('--sky-cloud', { r: 255, g: 255, b: 255 }),
    cloudShade: get('--sky-cloud-shade', { r: 142, g: 163, b: 194 }),
    glow: dark ? 0.5 : 1,
  };
}

/** True when WebGL is drawn by the CPU, where a full-screen shader would slow start-up itself down. */
function isSoftware(gl: WebGLRenderingContext): boolean {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  return /swiftshader|llvmpipe|softpipe|basic render|microsoft basic/i.test(renderer);
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!vs || !fs || !program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

export function SkyBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext('webgl', { antialias: false, alpha: false });
    if (!canvas || !gl) return;
    const program = createProgram(gl);
    if (!program) return;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const scale = isSoftware(gl) ? SOFTWARE_RENDER_SCALE : RENDER_SCALE;

    gl.useProgram(program);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const at = (name: string) => gl.getUniformLocation(program, name);
    const uniforms = {
      res: at('uRes'),
      time: at('uTime'),
      zenith: at('uZenith'),
      horizon: at('uHorizon'),
      cloud: at('uCloud'),
      cloudShade: at('uCloudShade'),
      glow: at('uGlow'),
    };

    const resize = () => {
      // The sky is soft, so it is drawn at a fraction of the screen's size and stretched; this keeps weak GPUs cool.
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const setColour = (location: WebGLUniformLocation | null, c: Rgb) => gl.uniform3f(location, c.r / 255, c.g / 255, c.b / 255);
    let lastSkyRead = -Infinity;
    // The sky starts somewhere different each time, so the clouds are never the same twice.
    const timeOffset = Math.random() * 1000;
    let lastTime = 0;
    let frame = 0;

    const draw = (now: number) => {
      const t = now / 1000;
      // 30 frames a second is smooth enough for drifting clouds and leaves the machine free for start-up itself.
      if (lastTime !== 0 && t - lastTime < 1 / MAX_FPS - 0.004) {
        frame = requestAnimationFrame(draw);
        return;
      }
      if (lastTime === 0) lastTime = t;
      // The theme can change while the screen is up; reading the tokens once a second is enough.
      if (t - lastSkyRead > 1) {
        const sky = readSky(canvas);
        setColour(uniforms.zenith, sky.zenith);
        setColour(uniforms.horizon, sky.horizon);
        setColour(uniforms.cloud, sky.cloud);
        setColour(uniforms.cloudShade, sky.cloudShade);
        gl.uniform1f(uniforms.glow, sky.glow);
        lastSkyRead = t;
      }
      lastTime = t;

      gl.uniform2f(uniforms.res, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, still ? timeOffset : t + timeOffset);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!still) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
    };
  }, []);

  return <canvas ref={ref} className="sp__sky" aria-hidden="true" data-testid="splash-sky" />;
}
