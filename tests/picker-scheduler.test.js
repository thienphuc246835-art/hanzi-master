import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recallLevelsFor, pickMode, exampleTierFor } from '../src/js/core/exercise-picker.js';
import { adaptiveNewLimit, interleaveQueue, forecast, buildQueue } from '../src/js/core/scheduler.js';
import { MODES } from '../src/js/core/constants.js';
import { seededRng } from '../src/js/utils/random.js';
import { applyTone, toneOf, normalizePinyin } from '../src/js/utils/pinyin.js';

const NOW = new Date('2026-10-18T08:00:00Z');
const card = (state, stability = 0) => ({ word_id: 'w', state, stability, difficulty: 5, due: NOW.toISOString(), review_history: [] });
const word = {
  id: 'w', simplified: '妈妈',
  examples: [{ tier: 1, seg: '我 妈妈 是 医生', zh: '我妈妈是医生。' }],
  characters: [{ char: '妈', pinyin: 'mā', assembly: ['女', '马'] }],
};

test('recall ladder levels per card state (§4.2.1)', () => {
  assert.deepEqual(recallLevelsFor(card('new')), [1]);
  assert.deepEqual(recallLevelsFor(card('learning')), [1, 2]);
  assert.deepEqual(recallLevelsFor(card('review', 3)), [2]);
  assert.deepEqual(recallLevelsFor(card('review', 10)), [2, 3]);
  assert.deepEqual(recallLevelsFor(card('review', 40)), [3]);
  assert.deepEqual(recallLevelsFor(card('review', 40), { lastRating: 1 }), [2], 'Again steps down one level');
});

test('new cards always start with a flashcard', () => {
  assert.equal(pickMode({ card: card('new'), word }).mode, 'flashcard');
});

test('picked mode serves an allowed level and is never practice-only', () => {
  const rng = seededRng(11);
  for (let i = 0; i < 200; i++) {
    const c = card('review', 40);
    const { mode, recallLevel } = pickMode({ card: c, word, rng, poolSize: 30, capabilities: { tts: true, hanziWriter: true } });
    assert.ok(!MODES[mode].practiceOnly);
    assert.ok(recallLevelsFor(c).includes(recallLevel) || mode === 'flashcard');
  }
});

test('no more than 3 identical modes in a row', () => {
  const recent = ['cloze', 'cloze', 'cloze'];
  for (let s = 1; s < 50; s++) {
    const { mode } = pickMode({ card: card('review', 3), word, recentModes: recent, rng: seededRng(s), poolSize: 30, disabledModes: ['tone_drill', 'radical_assembly', 'sentence_builder', 'collocation', 'listening'] });
    assert.notEqual(mode, 'cloze');
  }
});

test('disabled modes are never picked', () => {
  for (let s = 1; s < 50; s++) {
    const { mode } = pickMode({ card: card('review', 3), word, rng: seededRng(s), poolSize: 30, disabledModes: ['cloze'] });
    assert.notEqual(mode, 'cloze');
  }
});

test('example tier for cloze (§4.2 Mode 3)', () => {
  assert.equal(exampleTierFor(card('learning')), 1);
  assert.equal(exampleTierFor(card('review', 10)), 2);
  assert.equal(exampleTierFor(card('review', 30)), 3);
});

test('adaptive new-card limit (§4.3)', () => {
  assert.equal(adaptiveNewLimit(10, [1, 1, 1]).limit, 10, 'too few samples → unchanged');
  assert.equal(adaptiveNewLimit(10, Array(20).fill(1)).limit, 5);
  assert.equal(adaptiveNewLimit(10, Array(20).fill(4)).limit, 15);
  assert.equal(adaptiveNewLimit(10, Array(20).fill(3)).limit, 10);
});

test('interleave spreads new items through reviews', () => {
  const q = interleaveQueue(['r1', 'r2', 'r3', 'r4'], ['n1', 'n2']);
  assert.deepEqual(q, ['r1', 'r2', 'n1', 'r3', 'r4', 'n2']);
});

test('forecast buckets due cards by day', () => {
  const cards = [
    { ...card('review'), due: new Date(NOW.getTime() - 86_400_000).toISOString() },
    { ...card('review'), due: new Date(NOW.getTime() + 2 * 86_400_000).toISOString() },
    card('new'),
  ];
  const f = forecast(cards, NOW, 7);
  assert.equal(f[0].count, 1, 'overdue counted today');
  assert.equal(f[2].count, 1);
  assert.equal(f.reduce((s, b) => s + b.count, 0), 2);
});

test('buildQueue respects new-card limit and level range', () => {
  const words = [1, 2, 3].map((l) => ({ id: `w${l}`, hsk_level: l, frequency_rank: l }));
  const q = buildQueue({ words, cards: [], now: NOW, settings: { daily_new_cards: 2, start_level: 1, target_hsk: 2 } });
  assert.deepEqual(q.fresh.map((w) => w.id), ['w1', 'w2']);
});

test('pinyin helpers', () => {
  assert.equal(applyTone('mai', 3), 'mǎi');
  assert.equal(applyTone('xue', 2), 'xué');
  assert.equal(applyTone('gou', 4), 'gòu');
  assert.equal(applyTone('shui', 3), 'shuǐ');
  assert.equal(applyTone('lü', 4), 'lǜ');
  assert.equal(toneOf('mā'), 1);
  assert.equal(toneOf('ma'), 5);
  assert.equal(normalizePinyin('Wǒ zài xuéxiào.'), 'wozaixuexiao');
  assert.equal(normalizePinyin('lǜ'), 'lv');
});
