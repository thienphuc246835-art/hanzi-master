// HanziWriter character data served from the app (works offline), CDN as fallback
const STROKES_BASE = 'src/js/data/strokes/';
const CDN = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/';
const cache = new Map();

export function strokeDataLoader(char, onLoad, onError) {
  if (cache.has(char)) return onLoad(cache.get(char));
  const local = `${STROKES_BASE}${char.codePointAt(0).toString(16)}.json`;
  fetch(local)
    .then((r) => (r.ok ? r.json() : fetch(`${CDN}${encodeURIComponent(char)}.json`).then((c) => {
      if (!c.ok) throw new Error(`No stroke data for ${char}`);
      return c.json();
    })))
    .then((data) => { cache.set(char, data); onLoad(data); })
    .catch((e) => onError?.(e));
}
