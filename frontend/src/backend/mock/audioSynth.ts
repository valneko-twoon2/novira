// Mock audio: short WAV clips made from a seed (a little tune for music, a run of syllable-like bursts for speech),
// and the picture of a clip's waveform used as its gallery thumbnail. Deterministic: the same input gives the same sound.
import { mulberry32 } from './random';

const SAMPLE_RATE = 22050;
/** The mock never makes clips longer than this, whatever length was asked for. */
const MAX_SECONDS = 12;

function wavFile(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s)) * 32767, true));
  return bytes;
}

/** A tune in a pentatonic scale: one note per beat with a soft attack and release. */
export function synthMusic(seed: number, seconds: number, bpm = 120): Uint8Array {
  const rand = mulberry32(seed);
  const length = Math.max(1, Math.min(MAX_SECONDS, seconds)) * SAMPLE_RATE;
  const samples = new Float32Array(length);
  const scale = [0, 2, 4, 7, 9, 12, 14, 16];
  const beat = Math.round((60 / Math.max(40, bpm)) * SAMPLE_RATE);
  const root = 196 * 2 ** ((Math.floor(rand() * 5) - 2) / 12);
  for (let start = 0; start < length; start += beat) {
    const freq = root * 2 ** (scale[Math.floor(rand() * scale.length)]! / 12);
    for (let i = 0; i < beat && start + i < length; i++) {
      const t = i / SAMPLE_RATE;
      const envelope = Math.min(1, i / 400) * Math.exp(-3.2 * (i / beat));
      samples[start + i] = (samples[start + i] ?? 0) + 0.35 * envelope * (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t));
    }
  }
  return wavFile(samples);
}

/** Speech-like sound: a short burst per character, its pitch following the character. */
export function synthSpeech(text: string, seed: number): Uint8Array {
  const rand = mulberry32(seed);
  const chars = [...text.replace(/\s+/g, ' ').slice(0, 160)];
  const burst = Math.round(0.11 * SAMPLE_RATE);
  const length = Math.min(MAX_SECONDS * SAMPLE_RATE, Math.max(1, chars.length) * burst);
  const samples = new Float32Array(length);
  chars.forEach((c, k) => {
    const start = k * burst;
    if (start >= length || c === ' ') return;
    const base = 120 + (c.charCodeAt(0) % 17) * 9 + rand() * 20;
    for (let i = 0; i < burst && start + i < length; i++) {
      const t = i / SAMPLE_RATE;
      const envelope = Math.sin((Math.PI * i) / burst) ** 2;
      samples[start + i] = (samples[start + i] ?? 0) + 0.4 * envelope * (Math.sin(2 * Math.PI * base * t) + 0.5 * Math.sin(2 * Math.PI * base * 2.1 * t));
    }
  });
  return wavFile(samples);
}

/** An object URL for the clip, or a data URL where object URLs do not exist (tests). */
export function audioUrl(wav: Uint8Array): string {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') return URL.createObjectURL(new Blob([wav as BlobPart], { type: 'audio/wav' }));
  let binary = '';
  wav.forEach((b) => (binary += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(binary)}`;
}

/** The thumbnail of a clip: mirrored bars of its loudness, as a PNG data URL (empty where there is no canvas). */
export function waveformThumbnail(wav: Uint8Array): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#10121a';
  ctx.fillRect(0, 0, 256, 144);
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const count = (wav.byteLength - 44) / 2;
  const bars = 48;
  const per = Math.max(1, Math.floor(count / bars));
  ctx.fillStyle = '#4c8dff';
  for (let b = 0; b < bars; b++) {
    let sum = 0;
    for (let i = 0; i < per; i++) sum += (view.getInt16(44 + (b * per + i) * 2, true) / 32768) ** 2;
    const level = Math.max(0.06, Math.min(1, Math.sqrt(sum / per) * 3));
    const half = Math.max(2, level * 60);
    ctx.fillRect(b * (256 / bars) + 1, 72 - half, 256 / bars - 2, half * 2);
  }
  return canvas.toDataURL('image/png');
}
