import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inferRating, median, diffChars, similarity, isAcceptedAnswer } from '../src/js/core/grader.js';

test('wrong, timed out or skipped → Again', () => {
  assert.equal(inferRating({ correct: false }), 1);
  assert.equal(inferRating({ correct: true, timedOut: true }), 1);
  assert.equal(inferRating({ correct: true, skipped: true }), 1);
});

test('hint, retry or slow answer → Hard', () => {
  assert.equal(inferRating({ correct: true, usedHint: true }), 2);
  assert.equal(inferRating({ correct: true, retried: true }), 2);
  assert.equal(inferRating({ correct: true, responseMs: 9000, medianMs: 4000 }), 2);
});

test('normal correct answer → Good', () => {
  assert.equal(inferRating({ correct: true, responseMs: 4000, medianMs: 4000 }), 3);
  assert.equal(inferRating({ correct: true }), 3, 'no timing data → Good');
});

test('fast correct answer → Easy only at recall level 3', () => {
  assert.equal(inferRating({ correct: true, responseMs: 1000, medianMs: 4000, recallLevel: 3 }), 4);
  assert.equal(inferRating({ correct: true, responseMs: 1000, medianMs: 4000, recallLevel: 1 }), 3);
  assert.equal(inferRating({ correct: true, responseMs: 1000, medianMs: 4000, recallLevel: 2 }), 3);
});

test('median handles odd, even and empty input', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('diffChars marks wrong and missing characters', () => {
  const d = diffChars('我在学校', '我再学校');
  assert.deepEqual(d.map((x) => x.status).filter((s) => s !== 'ok').sort(), ['bad', 'miss']);
  assert.ok(diffChars('你好', '你好').every((x) => x.status === 'ok'));
});

test('similarity ignores punctuation', () => {
  assert.equal(similarity('你好！', '你好'), 1);
  assert.ok(similarity('我学习汉语', '我学汉语') < 1);
});

test('isAcceptedAnswer compares without punctuation or spaces', () => {
  assert.ok(isAcceptedAnswer('我 学习 汉语', ['我学习汉语。']));
  assert.ok(!isAcceptedAnswer('汉语学习我', ['我学习汉语。']));
});
