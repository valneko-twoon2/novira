// The OpenAI-compatible server the assistant can use (Ollama, LM Studio, ...): presets for the form, and a light reading
// of the typed address for the warnings. The backend checks the address for real and makes every call (docs/design/security.md).

/** Where an address points, as far as the form's warnings go. */
export type AddressKind = 'invalid' | 'local' | 'remote-https' | 'remote-http';

export interface EndpointPreset {
  id: string;
  /** A product name: not translated. */
  name: string;
  url: string;
}

/** Servers that run on this PC with a known address: one click fills the address and reads the model list. */
export const ENDPOINT_PRESETS: readonly EndpointPreset[] = [
  { id: 'ollama', name: 'Ollama', url: 'http://127.0.0.1:11434/v1' },
  { id: 'lmstudio', name: 'LM Studio', url: 'http://127.0.0.1:1234/v1' },
];

/** The host name part of an address, or '' when it cannot be read. */
export function addressHost(text: string): string {
  try {
    return new URL(text.trim()).host;
  } catch {
    return '';
  }
}

/** Whether the address is an http(s) address on this PC, on another machine over https, or on another machine over plain http. */
export function addressKind(text: string): AddressKind {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return 'invalid';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'invalid';
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host === '::1' || /^127\.\d+\.\d+\.\d+$/.test(host)) return 'local';
  return url.protocol === 'https:' ? 'remote-https' : 'remote-http';
}
