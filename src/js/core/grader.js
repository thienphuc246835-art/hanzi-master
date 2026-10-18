// Exercise result → FSRS rating (CLAUDE.md §4.2.2). Pure functions.
import { RATING } from './constants.js';

const PUNCTUATION = /[\s，。！？、：；“”‘’「」『』（）《》〈〉…—\-,.!?:;"'()[\]]/g;

export function inferRating({
  correct,
  usedHint = false,
  retried = false,
  timedOut = false,
  skipped = false,
  responseMs = null,
  medianMs = null,
  recallLevel = 2,
}) {
  if (!correct || timedOut || skipped) return RATING.AGAIN;
  const hasMedian = Number.isFinite(medianMs) && medianMs > 0 && Number.isFinite(responseMs);
  const slow = hasMedian && responseMs > 2 * medianMs;
  if (usedHint || retried || slow) return RATING.HARD;
  const fast = hasMedian && responseMs < 0.5 * medianMs;
  // Recognition never earns Easy — it does not prove the word can be produced
  if (fast && recallLevel === 3) return RATING.EASY;
  return RATING.GOOD;
}

export function median(values) {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

export function normalizeHanzi(text) {
  return (text ?? '').replace(PUNCTUATION, '');
}

// Character-level alignment via LCS → [{ char, status: 'ok' | 'bad' | 'miss' }]
export function diffChars(expected, actual) {
  const a = [...normalizeHanzi(expected)];
  const b = [...normalizeHanzi(actual)];
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push({ char: a[i], status: 'ok' }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ char: a[i], status: 'miss' }); i++; }
    else { out.push({ char: b[j], status: 'bad' }); j++; }
  }
  while (i < a.length) out.push({ char: a[i++], status: 'miss' });
  while (j < b.length) out.push({ char: b[j++], status: 'bad' });
  return out;
}

// 0..1 — share of expected characters reproduced in order
export function similarity(expected, actual) {
  const exp = normalizeHanzi(expected);
  if (!exp.length) return 0;
  const ok = diffChars(expected, actual).filter((d) => d.status === 'ok').length;
  const extra = diffChars(expected, actual).filter((d) => d.status === 'bad').length;
  return Math.max(0, (ok - extra * 0.5) / [...exp].length);
}

export function isAcceptedAnswer(answer, accepted) {
  const norm = normalizeHanzi(answer);
  return accepted.some((a) => normalizeHanzi(a) === norm);
}
