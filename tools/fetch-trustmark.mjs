// Fetches the files of the export watermark (TrustMark's P models and the ONNX Runtime DLL) into a folder, checking
// each one against the size and SHA-256 pinned in backend/crates/novira-core/src/provenance/files.json.
//
//   node tools/fetch-trustmark.mjs [--dest <folder>]
//
// The default folder is backend/target/resources/trustmark, which the live test (tests/watermark_live.rs) reads. A
// packaged app looks for the same files in <exe folder>/resources/trustmark; without them it downloads them into its
// data folder at start. The files are never committed (target/ is ignored). A file already there with the right hash
// is kept; nothing is written under its own name before its hash matched.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIST = path.join(REPO, 'backend/crates/novira-core/src/provenance/files.json');
// The same hosts as Service::TrustMark and Service::GitHub in backend/crates/novira-core/src/endpoints.rs.
const ORIGINS = { trustmark: 'https://cai-watermark.adobe.net', github: 'https://github.com' };

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function download(url, cap) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  const chunks = [];
  let got = 0;
  for await (const chunk of res.body) {
    got += chunk.length;
    if (got > cap) throw new Error(`${url} is larger than pinned`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** The bytes of `entry` in a zip (stored or deflated), read through the central directory. */
function unzipEntry(zip, entry) {
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('not a zip');
  const count = zip.readUInt16LE(eocd + 10);
  let at = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(at) !== 0x02014b50) throw new Error('broken zip directory');
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLen = zip.readUInt16LE(at + 28);
    const extraLen = zip.readUInt16LE(at + 30);
    const commentLen = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLen);
    if (name === entry) {
      const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
      const data = zip.subarray(start, start + size);
      if (method === 0) return data;
      if (method === 8) return zlib.inflateRawSync(data);
      throw new Error(`unsupported zip method ${method}`);
    }
    at += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${entry} is not in the archive`);
}

async function main() {
  const args = process.argv.slice(2);
  const destAt = args.indexOf('--dest');
  const dest = destAt >= 0 ? path.resolve(args[destAt + 1]) : path.join(REPO, 'backend/target/resources/trustmark');
  fs.mkdirSync(dest, { recursive: true });
  const { files } = JSON.parse(fs.readFileSync(LIST, 'utf8'));
  for (const file of files) {
    const target = path.join(dest, file.name);
    if (fs.existsSync(target) && sha256(fs.readFileSync(target)) === file.sha256) {
      console.log(`${file.name}: already there`);
      continue;
    }
    const origin = ORIGINS[file.service];
    if (!origin) throw new Error(`unknown service ${file.service}`);
    const url = origin + file.path;
    console.log(`${file.name}: downloading ${url}`);
    let bytes = await download(url, file.archive ? file.archive.bytes : file.bytes);
    if (file.archive) {
      if (sha256(bytes) !== file.archive.sha256) throw new Error(`${url} does not match its pinned hash`);
      bytes = unzipEntry(bytes, file.archive.entry);
    }
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) {
      throw new Error(`${file.name} does not match its pinned size and hash`);
    }
    const part = `${target}.part`;
    fs.writeFileSync(part, bytes);
    fs.renameSync(part, target);
    console.log(`${file.name}: ok (${file.bytes} bytes)`);
  }
  console.log(`done: ${dest}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
