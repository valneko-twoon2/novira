// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SkyBackdrop } from './SkyBackdrop';

// A fake WebGL context: every call is a spy, and compile/link succeed unless a test says otherwise.
function fakeGl(over: Record<string, unknown> = {}) {
  return {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    RENDERER: 5,
    ARRAY_BUFFER: 6,
    STATIC_DRAW: 7,
    FLOAT: 8,
    TRIANGLE_STRIP: 9,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getExtension: vi.fn(() => null),
    getParameter: vi.fn(() => 'NVIDIA GeForce'),
    useProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn(() => ({})),
    viewport: vi.fn(),
    uniform3f: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    drawArrays: vi.fn(),
    deleteBuffer: vi.fn(),
    deleteProgram: vi.fn(),
    ...over,
  };
}

let gl: ReturnType<typeof fakeGl> | null;
let frames: FrameRequestCallback[];
let disconnect: ReturnType<typeof vi.fn>;
let reduced: boolean;

beforeEach(() => {
  gl = fakeGl();
  frames = [];
  reduced = false;
  disconnect = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => gl) as never);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    },
  );
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SkyBackdrop', () => {
  it('draws a frame, with the sky colours read from the page tokens', () => {
    document.documentElement.style.setProperty('--bg-app', '#ffffff');
    render(<SkyBackdrop />);
    expect(screen.getByTestId('splash-sky').tagName).toBe('CANVAS');
    expect(gl!.useProgram).toHaveBeenCalled();
    frames[0]!(1000);
    expect(gl!.drawArrays).toHaveBeenCalledTimes(1);
    expect(gl!.uniform3f).toHaveBeenCalledTimes(4);
    // A light page gets the full glow.
    expect(gl!.uniform1f).toHaveBeenCalledWith(expect.anything(), 1);
    // The next frame is scheduled.
    expect(frames.length).toBe(2);
    document.documentElement.style.removeProperty('--bg-app');
  });

  it('softens the glow on a dark page', () => {
    document.documentElement.style.setProperty('--bg-app', '#000000');
    render(<SkyBackdrop />);
    frames[0]!(1000);
    expect(gl!.uniform1f).toHaveBeenCalledWith(expect.anything(), 0.5);
    document.documentElement.style.removeProperty('--bg-app');
  });

  it('skips a frame that comes too soon and re-reads the sky only after a second', () => {
    render(<SkyBackdrop />);
    frames[0]!(1000);
    expect(gl!.drawArrays).toHaveBeenCalledTimes(1);
    frames[1]!(1005);
    expect(gl!.drawArrays).toHaveBeenCalledTimes(1);
    frames[2]!(1040);
    expect(gl!.drawArrays).toHaveBeenCalledTimes(2);
    expect(gl!.uniform3f).toHaveBeenCalledTimes(4);
    frames[3]!(2100);
    expect(gl!.drawArrays).toHaveBeenCalledTimes(3);
    expect(gl!.uniform3f).toHaveBeenCalledTimes(8);
  });

  it('draws one still frame with reduced motion', () => {
    reduced = true;
    render(<SkyBackdrop />);
    frames[0]!(1000);
    expect(gl!.drawArrays).toHaveBeenCalledTimes(1);
    expect(frames.length).toBe(1);
  });

  it('renders at a smaller scale when WebGL is software, and reads the debug renderer', () => {
    gl = fakeGl({
      getExtension: vi.fn(() => ({ UNMASKED_RENDERER_WEBGL: 99 })),
      getParameter: vi.fn(() => 'Google SwiftShader'),
    });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => 400 });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => 200 });
    try {
      render(<SkyBackdrop />);
      expect(gl.viewport).toHaveBeenCalledWith(0, 0, 100, 50);
    } finally {
      delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).clientWidth;
      delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).clientHeight;
    }
  });

  it('renders at half scale on a real GPU', () => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => 400 });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => 200 });
    try {
      render(<SkyBackdrop />);
      expect(gl!.viewport).toHaveBeenCalledWith(0, 0, 200, 100);
    } finally {
      delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).clientWidth;
      delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).clientHeight;
    }
  });

  it('releases the GL resources and the observer on unmount', () => {
    const { unmount } = render(<SkyBackdrop />);
    unmount();
    expect(gl!.deleteBuffer).toHaveBeenCalled();
    expect(gl!.deleteProgram).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });

  it('stays an empty canvas without WebGL', () => {
    gl = null;
    render(<SkyBackdrop />);
    expect(screen.getByTestId('splash-sky')).toBeTruthy();
    expect(frames.length).toBe(0);
  });

  it.each([
    ['a shader that does not compile', { getShaderParameter: vi.fn(() => false) }],
    ['a shader that cannot be created', { createShader: vi.fn(() => null) }],
    ['a program that does not link', { getProgramParameter: vi.fn(() => false) }],
    ['no program', { createProgram: vi.fn(() => null) }],
  ])('draws nothing with %s', (_name, over) => {
    gl = fakeGl(over);
    render(<SkyBackdrop />);
    expect(frames.length).toBe(0);
    expect(gl.useProgram).not.toHaveBeenCalled();
  });
});
