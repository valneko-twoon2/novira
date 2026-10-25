// Reads what the user pastes for a Hugging Face model: a page address of a repository (or of a folder or file in it) or just
// "owner/name". Only the address is read here; nothing is opened or fetched from it.

export interface HuggingFaceTarget {
  /** `owner/name`. */
  repo: string;
  /** A folder of the repository the address points into, without a trailing slash; '' for the whole repository. */
  folder: string;
  /** The file the address points at (a `blob` or `resolve` address), or null. */
  file: string | null;
}

const NAME = /^[\w.-]+$/;
const HOSTS = new Set(['huggingface.co', 'www.huggingface.co', 'hf.co']);
// Pages of the site that are not model repositories.
const OTHER_KINDS = new Set(['datasets', 'spaces', 'docs', 'blog', 'papers', 'collections', 'organizations', 'settings', 'models']);

function decode(part: string): string | null {
  try {
    return decodeURIComponent(part);
  } catch {
    return null;
  }
}

/** The repository, folder and file an address or `owner/name` stands for; null when it is neither. */
export function parseHuggingFaceInput(input: string): HuggingFaceTarget | null {
  let text = input.trim();
  if (!text) return null;
  if (/^(?:https?:\/\/)?(?:www\.)?(?:huggingface\.co|hf\.co)(?:[/?#]|$)/i.test(text)) {
    if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || !HOSTS.has(url.hostname.toLowerCase())) return null;
    text = url.pathname;
  }
  const parts = text.split('/').filter(Boolean).map(decode);
  if (parts.some((p) => p === null)) return null;
  const segs = parts as string[];
  // The old address form "huggingface.co/models/owner/name" is not a model page of today; "models" is not an owner.
  if (segs.length < 2 || OTHER_KINDS.has(segs[0]!) || !NAME.test(segs[0]!) || !NAME.test(segs[1]!)) return null;
  const repo = `${segs[0]}/${segs[1]}`;
  const rest = segs.slice(2);
  if (rest.length === 0) return { repo, folder: '', file: null };
  const [view, , ...path] = rest;
  if (view === 'tree') return path.every((p) => p !== '..' && p !== '.') ? { repo, folder: path.join('/'), file: null } : null;
  if ((view === 'blob' || view === 'resolve') && path.length > 0) {
    if (path.some((p) => p === '..' || p === '.')) return null;
    const file = path.join('/');
    return { repo, folder: path.slice(0, -1).join('/'), file };
  }
  // Other pages of the repository (discussions, commits, ...) still name the repository.
  return { repo, folder: '', file: null };
}
