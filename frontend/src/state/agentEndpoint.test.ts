import { describe, expect, it } from 'vitest';
import { addressHost, addressKind, ENDPOINT_PRESETS } from './agentEndpoint';

describe('the address of an OpenAI-compatible server', () => {
  it('tells this PC from another machine and plain http from https', () => {
    expect(addressKind('http://127.0.0.1:11434/v1')).toBe('local');
    expect(addressKind('http://localhost:1234/v1')).toBe('local');
    expect(addressKind(' http://LOCALHOST/v1 ')).toBe('local');
    expect(addressKind('http://[::1]:8080/v1')).toBe('local');
    expect(addressKind('http://127.1/v1')).toBe('local');
    expect(addressKind('http://192.168.1.5:11434/v1')).toBe('remote-http');
    expect(addressKind('http://ollama.lan/v1')).toBe('remote-http');
    expect(addressKind('https://api.example.com/v1')).toBe('remote-https');
    // A name that only starts like localhost is another machine.
    expect(addressKind('http://localhost.evil.example/v1')).toBe('remote-http');
    expect(addressKind('http://127.0.0.1.evil.example/v1')).toBe('remote-http');
  });

  it('refuses what is not an http(s) address', () => {
    for (const bad of ['', '  ', 'localhost:11434', '127.0.0.1:11434/v1', 'ftp://host/v1', 'file:///C:/x', `${'java'}script:alert(1)`, 'not a url']) {
      expect(addressKind(bad), bad).toBe('invalid');
    }
  });

  it('names the host for the permission question and has presets that are local', () => {
    expect(addressHost('https://api.example.com:8443/v1')).toBe('api.example.com:8443');
    expect(addressHost('nonsense')).toBe('');
    expect(ENDPOINT_PRESETS.map((p) => p.id)).toContain('ollama');
    expect(ENDPOINT_PRESETS.find((p) => p.id === 'ollama')?.url).toBe('http://127.0.0.1:11434/v1');
    for (const p of ENDPOINT_PRESETS) expect(addressKind(p.url), p.id).toBe('local');
  });
});
