// Pinyin helpers — pure functions

const TONE_MARKS = Object.freeze({
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
});

const MARK_TO_TONE = new Map();
for (const marks of Object.values(TONE_MARKS)) marks.forEach((m, i) => MARK_TO_TONE.set(m, i + 1));

// Combining marks for tones 1–4 (macron, acute, caron, grave). U+0308 (ü) is kept.
const TONE_COMBINING = /[̄́̌̀]/g;

export function toneOf(syllable) {
  for (const ch of syllable) {
    const t = MARK_TO_TONE.get(ch);
    if (t) return t;
  }
  return 5;
}

export function stripTones(text) {
  return text.normalize('NFD').replace(TONE_COMBINING, '').normalize('NFC');
}

// Loose comparison form: no tones, no spaces/punctuation, ü → v
export function normalizePinyin(text) {
  return stripTones(text).toLowerCase().replace(/ü/g, 'v').replace(/[^a-zv]/g, '');
}

// Put a tone mark on a toneless syllable following standard placement rules
export function applyTone(base, tone) {
  const syl = stripTones(base);
  if (tone < 1 || tone > 4) return syl;
  const lower = syl.toLowerCase();
  let idx = -1;
  if (lower.includes('a')) idx = lower.indexOf('a');
  else if (lower.includes('e')) idx = lower.indexOf('e');
  else if (lower.includes('ou')) idx = lower.indexOf('o');
  else {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('iouü'.includes(lower[i])) { idx = i; break; }
    }
  }
  if (idx < 0) return syl;
  const vowel = lower[idx];
  let marked = TONE_MARKS[vowel][tone - 1];
  if (syl[idx] !== lower[idx]) marked = marked.toUpperCase();
  return syl.slice(0, idx) + marked + syl.slice(idx + 1);
}

export function toneVariants(syllable) {
  return [1, 2, 3, 4, 5].map((t) => applyTone(syllable, t));
}

export const TONE_NAMES = Object.freeze({ 1: 'Thanh 1 (ngang)', 2: 'Thanh 2 (sắc)', 3: 'Thanh 3 (hỏi)', 4: 'Thanh 4 (huyền-nặng)', 5: 'Thanh nhẹ' });
export const TONE_SYMBOLS = Object.freeze({ 1: 'ˉ', 2: 'ˊ', 3: 'ˇ', 4: 'ˋ', 5: '·' });
