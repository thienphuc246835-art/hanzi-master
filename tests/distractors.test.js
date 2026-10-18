import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickDistractors, areSynonyms, scoreDistractor } from '../src/js/core/distractors.js';
import { seededRng } from '../src/js/utils/random.js';

const words = JSON.parse(readFileSync(new URL('./fixtures/seed-hsk1.json', import.meta.url), 'utf8'));
const byHanzi = (h) => words.find((w) => w.simplified === h);

test('never returns the target, duplicates or synonyms', () => {
  for (const target of words) {
    for (let seed = 1; seed <= 5; seed++) {
      const picked = pickDistractors(target, words, { count: 3, rng: seededRng(seed) });
      assert.equal(picked.length, 3, `${target.simplified}: needs 3 distractors`);
      assert.ok(!picked.some((p) => p.id === target.id), 'target excluded');
      assert.equal(new Set(picked.map((p) => p.id)).size, 3, 'no duplicates');
      assert.ok(!picked.some((p) => areSynonyms(target, p)), `${target.simplified}: no synonym of the answer`);
      for (let i = 0; i < picked.length; i++) {
        for (let j = i + 1; j < picked.length; j++) assert.ok(!areSynonyms(picked[i], picked[j]), 'distractors not synonyms of each other');
      }
    }
  }
});

test('汉语 and 中文 are synonyms, so neither is offered as a distractor for the other', () => {
  assert.ok(areSynonyms(byHanzi('汉语'), byHanzi('中文')));
  for (let seed = 1; seed <= 20; seed++) {
    const picked = pickDistractors(byHanzi('汉语'), words, { rng: seededRng(seed) });
    assert.ok(!picked.some((p) => p.simplified === '中文'));
  }
});

test('similar-looking and same-radical words score higher', () => {
  const mai = byHanzi('买');
  assert.ok(scoreDistractor(mai, byHanzi('卖')) > scoreDistractor(mai, byHanzi('朋友')));
  const ma = byHanzi('妈妈');
  assert.ok(scoreDistractor(ma, byHanzi('姐姐')) > scoreDistractor(ma, byHanzi('时间')), 'same radical 女');
});

test('买 picks 卖 first (visual + homophone)', () => {
  const picked = pickDistractors(byHanzi('买'), words, { rng: seededRng(3) });
  assert.equal(picked[0].simplified, '卖');
});
