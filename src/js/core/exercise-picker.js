// Picks an exercise for a card: Recall Ladder (§4.2.1) + interleaving (§4.2.3). Pure.
import {
  STATE, RATING, MODES, FOCUS_MODES, FOCUS_WEIGHT, MAX_SAME_MODE_IN_A_ROW,
} from './constants.js';
import { weightedPick } from '../utils/random.js';

export function recallLevelsFor(card, { lastRating } = {}) {
  let levels;
  if (!card || card.state === STATE.NEW) levels = [1];
  else if (card.state === STATE.LEARNING || card.state === STATE.RELEARNING) levels = [1, 2];
  else if (card.stability < 7) levels = [2];
  else if (card.stability < 21) levels = [2, 3];
  else levels = [3];

  // Vừa quên → lần gặp tiếp theo hạ một bậc
  if (lastRating === RATING.AGAIN && card?.state !== STATE.NEW) {
    levels = [...new Set(levels.map((l) => Math.max(1, l - 1)))];
  }
  return levels;
}

// Mode 3 — which of the 3 example tiers to use (§4.2 Mode 3)
export function exampleTierFor(card) {
  if (!card || card.state !== STATE.REVIEW) return 1;
  return card.stability < 21 ? 2 : 3;
}

export function builderExamples(word) {
  return (word.examples ?? []).filter((e) => e.tier <= 2 && e.seg && e.seg.trim().split(/\s+/).length >= 3);
}

export function modeSupportsWord(modeId, word, ctx = {}) {
  const caps = ctx.capabilities ?? {};
  const mode = MODES[modeId];
  if (!mode) return false;
  if (mode.needs?.some((need) => !caps[need])) return false;
  switch (modeId) {
    case 'cloze':
      return (word.examples ?? []).length > 0;
    case 'sentence_builder':
    case 'translation':
      return builderExamples(word).length > 0;
    case 'tone_drill':
      return (word.characters ?? []).every((c) => c.pinyin);
    case 'radical_assembly':
      return (word.characters ?? []).some((c) => (c.assembly ?? []).length >= 2);
    case 'collocation':
      return ctx.collocationWordIds?.has(word.id) ?? false;
    case 'matching':
      return (ctx.poolSize ?? 0) >= 5;
    case 'multiple_choice':
    case 'listening':
      return (ctx.poolSize ?? 0) >= 4;
    case 'writing':
      return (word.characters ?? []).length > 0;
    default:
      return true;
  }
}

function wouldRepeatTooMuch(modeId, recentModes) {
  const tail = recentModes.slice(-MAX_SAME_MODE_IN_A_ROW);
  return tail.length === MAX_SAME_MODE_IN_A_ROW && tail.every((m) => m === modeId);
}

export function pickMode({
  card,
  word,
  recentModes = [],
  disabledModes = [],
  focus = null,
  lastRating = null,
  rng = Math.random,
  ...ctx
}) {
  if (!card || card.state === STATE.NEW) return { mode: 'flashcard', recallLevel: 1 };

  const levels = recallLevelsFor(card, { lastRating });
  const disabled = new Set(disabledModes);
  const focusModes = new Set(FOCUS_MODES[focus] ?? []);

  const candidates = [];
  for (const [id, def] of Object.entries(MODES)) {
    if (!def.enabled || !def.perCard || def.practiceOnly || disabled.has(id)) continue;
    const shared = def.levels.filter((l) => levels.includes(l));
    if (!shared.length) continue;
    if (!modeSupportsWord(id, word, ctx)) continue;
    if (wouldRepeatTooMuch(id, recentModes)) continue;
    const weight = focusModes.has(id) ? FOCUS_WEIGHT : 1;
    const recallLevel = shared[Math.floor(rng() * shared.length)];
    candidates.push({ value: { mode: id, recallLevel }, weight });
  }

  if (!candidates.length) return { mode: 'flashcard', recallLevel: 1 };
  return weightedPick(candidates, rng);
}
