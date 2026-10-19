import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uniqueChars, chunk, strokesShown, buildPage, buildPages, SHEET } from '../src/js/utils/writing-sheet.js';

test('uniqueChars keeps Han characters once, in order', () => {
  assert.deepEqual(uniqueChars(['学习', '习惯', 'ABC 1']), ['学', '习', '惯']);
});

test('chunk splits into pages', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5, 6, 7], 5), [[1, 2, 3, 4, 5], [6, 7]]);
});

test('strokesShown grows to the full character', () => {
  assert.equal(strokesShown(3, 1, 10), 1);
  assert.equal(strokesShown(3, 10, 10), 3);
  assert.equal(strokesShown(14, 10, 10), 14);
  assert.ok(strokesShown(14, 5, 10) < 14);
});

test('buildPage draws a 11×3 grid per character with the model glyph', () => {
  const data = { strokes: ['M0 0L10 10Z', 'M5 5L9 9Z'] };
  const svg = buildPage([{ char: '二', data }], { page: 1, pages: 1 });
  assert.equal((svg.match(/<rect /g) ?? []).length, 1 + SHEET.cols * SHEET.rowsPerChar); // page bg + cells
  assert.ok(svg.includes('fill="#111"'));
  assert.ok(svg.includes('1/1'));
});

test('buildPage falls back to text when stroke data is missing', () => {
  assert.ok(buildPage([{ char: '龘', data: null }]).includes('龘'));
});

test('buildPages paginates 5 characters per page', () => {
  const chars = Array.from({ length: 6 }, () => ({ char: '一', data: null }));
  assert.equal(buildPages(chars).length, 2);
});
