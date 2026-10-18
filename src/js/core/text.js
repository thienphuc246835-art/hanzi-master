// Chinese text helpers built on the vocabulary: greedy word segmentation + auto pinyin
import { state } from './store.js';

const PUNCT = /[\s，。！？、：；“”‘’「」（）《》…—,.!?:;"'()]/;
let lexicon = null;
let maxLen = 1;

function ensureLexicon() {
  if (lexicon && lexicon.size === state.words.length) return;
  lexicon = new Map();
  for (const w of state.words) if (!lexicon.has(w.simplified)) lexicon.set(w.simplified, w);
  maxLen = Math.max(1, ...[...lexicon.keys()].map((k) => [...k].length));
}

// → [{ text, word?, punct? }]
export function segmentText(text) {
  ensureLexicon();
  const chars = [...text];
  const out = [];
  for (let i = 0; i < chars.length;) {
    if (PUNCT.test(chars[i])) { out.push({ text: chars[i], punct: true }); i++; continue; }
    let len = Math.min(maxLen, chars.length - i);
    while (len > 1 && !lexicon.has(chars.slice(i, i + len).join(''))) len--;
    const piece = chars.slice(i, i + len).join('');
    out.push({ text: piece, word: lexicon.get(piece) ?? null });
    i += len;
  }
  return out;
}

export function wordTokens(text) {
  return segmentText(text).filter((t) => !t.punct).map((t) => t.text);
}

// Auto pinyin: dictionary reading per word, character reading as fallback
export function pinyinOf(text) {
  return segmentText(text).map((t) => {
    if (t.punct) return t.text;
    if (t.word) return t.word.pinyin.replace(/\s+/g, '');
    return [...t.text].map((c) => state.hanzi[c]?.py?.split(/[,\s]/)[0] ?? c).join('');
  }).join(' ').replace(/\s+([，。！？、：；,.!?:;”’）])/g, '$1');
}

export function wordsInText(text) {
  const seen = new Set();
  return segmentText(text).filter((t) => t.word && !seen.has(t.word.id) && seen.add(t.word.id)).map((t) => t.word);
}
