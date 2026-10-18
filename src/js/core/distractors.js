// Distractor generation (CLAUDE.md §4.2 Mode 5). Pure functions.
import { normalizePinyin } from '../utils/pinyin.js';
import { shuffle } from '../utils/random.js';

// Characters learners commonly confuse by shape
export const VISUAL_GROUPS = Object.freeze([
  ['已', '己', '巳'], ['未', '末'], ['人', '入', '八'], ['大', '太', '犬', '天', '夫'],
  ['日', '曰', '目'], ['买', '卖'], ['土', '士'], ['午', '牛'], ['王', '玉', '主'],
  ['田', '由', '甲', '申', '电'], ['今', '令'], ['休', '体'], ['问', '间', '向'],
  ['木', '本', '禾', '术'], ['千', '干', '于'], ['贝', '见'], ['认', '队'],
  ['妈', '码', '吗'], ['姐', '组', '租'], ['妹', '昧'], ['喝', '渴'], ['话', '活'],
  ['睡', '锤'], ['明', '朋'], ['说', '税'], ['茶', '荼'], ['作', '昨', '怎'],
]);

const VISUAL_INDEX = new Map();
VISUAL_GROUPS.forEach((group, i) => group.forEach((ch) => VISUAL_INDEX.set(ch, i)));

const SCORE = Object.freeze({ visual: 40, confusable: 35, radical: 30, homophone: 20, pos: 10, level: 5, length: 5 });
// Scoring every word of an 11k vocabulary per question is wasteful; sample a candidate pool
const CANDIDATE_POOL = 400;

export function meaningTokens(word) {
  return (word.meanings ?? [])
    .flatMap((m) => m.vi.split(/[,;，、—()（）]/))
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

// Two words that share any Vietnamese gloss (or are listed as synonyms) could both be "correct"
export function areSynonyms(a, b) {
  if (a.syn?.some((s) => s.hz === b.simplified) || b.syn?.some((s) => s.hz === a.simplified)) return true;
  const ta = new Set(meaningTokens(a));
  return meaningTokens(b).some((t) => ta.has(t));
}

function isConfusable(a, b) {
  return !!(a.confusables?.includes(b.simplified) || b.confusables?.includes(a.simplified));
}

function looksSimilar(a, b) {
  for (const ca of a.simplified) {
    const g = VISUAL_INDEX.get(ca);
    if (g === undefined) continue;
    for (const cb of b.simplified) if (cb !== ca && VISUAL_INDEX.get(cb) === g) return true;
  }
  return false;
}

function sharesRadical(a, b) {
  const ra = new Set((a.characters ?? []).map((c) => c.radical?.char));
  return (b.characters ?? []).some((c) => ra.has(c.radical?.char));
}

function isHomophone(a, b) {
  return a.pinyin !== b.pinyin && normalizePinyin(a.pinyin) === normalizePinyin(b.pinyin);
}

export function scoreDistractor(target, candidate) {
  let score = 0;
  if (looksSimilar(target, candidate)) score += SCORE.visual;
  if (isConfusable(target, candidate)) score += SCORE.confusable;
  if (sharesRadical(target, candidate)) score += SCORE.radical;
  if (isHomophone(target, candidate)) score += SCORE.homophone;
  if (target.meanings?.[0]?.pos === candidate.meanings?.[0]?.pos) score += SCORE.pos;
  if (target.hsk_level === candidate.hsk_level) score += SCORE.level;
  if ([...target.simplified].length === [...candidate.simplified].length) score += SCORE.length;
  return score;
}

export function isValidDistractor(target, candidate) {
  return candidate.id !== target.id &&
    candidate.simplified !== target.simplified &&
    !areSynonyms(target, candidate);
}

// Highest-scoring valid candidates; ties broken randomly so sets vary between rounds
export function pickDistractors(target, pool, { count = 3, rng = Math.random } = {}) {
  let candidates = pool;
  if (pool.length > CANDIDATE_POOL) {
    // Keep same-level words plus anything sharing a character, then sample the rest
    const chars = new Set(target.simplified);
    const related = pool.filter((c) => c.hsk_level === target.hsk_level || [...c.simplified].some((ch) => chars.has(ch)) || isConfusable(target, c));
    candidates = shuffle(related, rng).slice(0, CANDIDATE_POOL);
  }
  const ranked = shuffle(candidates.filter((c) => isValidDistractor(target, c)), rng)
    .map((c) => ({ c, score: scoreDistractor(target, c) }))
    .sort((x, y) => y.score - x.score);
  const picked = [];
  const meanings = new Set([target.meanings?.[0]?.vi]);
  for (const { c } of ranked) {
    // Two distractors with the same gloss would make one of them trivially wrong
    if (meanings.has(c.meanings?.[0]?.vi)) continue;
    if (picked.some((p) => areSynonyms(p, c))) continue;
    picked.push(c);
    meanings.add(c.meanings?.[0]?.vi);
    if (picked.length === count) break;
  }
  return picked;
}

// Extra pieces for Mode 10 — parts of other characters that are not in the target
export function pickAssemblyDistractors(character, pool, { count = 3, rng = Math.random } = {}) {
  const own = new Set(character.assembly ?? []);
  const parts = new Set();
  for (const w of pool) {
    for (const c of w.characters ?? []) {
      for (const p of c.assembly ?? []) if (!own.has(p)) parts.add(p);
    }
  }
  return shuffle([...parts], rng).slice(0, count);
}
