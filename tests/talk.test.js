import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt, parseTurn, buildMessages, scriptedTurns, scenariosForLevel, clampLevel, TALK_LEVELS } from '../src/js/core/talk.js';

const GOOD = '{"reply":{"zh":"你好！你叫什么名字？","vi":"Chào! Bạn tên gì?"},"suggestions":[{"zh":"我叫小明。","pinyin":"Wǒ jiào Xiǎo Míng.","vi":"Tôi tên Tiểu Minh."},{"zh":"你好，你呢？","pinyin":"","vi":""}],"feedback":{"ok":false,"note_vi":"Thiếu 了","better_zh":"我吃了。"}}';

test('prompt carries level limits, topic and known words', () => {
  const p = buildSystemPrompt({ level: 2, topic: 'food', knownWords: ['吃饭', '喝茶'] });
  assert.match(p, /HSK 2/);
  assert.match(p, new RegExp(`at most ${TALK_LEVELS[2].maxChars} `));
  assert.match(p, /Topic: food/);
  assert.match(p, /吃饭、喝茶/);
  assert.match(buildSystemPrompt({ level: 9 }), /HSK 7–9/);
});

test('parseTurn reads JSON, also inside code fences or chatter', () => {
  const t = parseTurn('Sure!\n```json\n' + GOOD + '\n```');
  assert.equal(t.reply.zh, '你好！你叫什么名字？');
  assert.equal(t.suggestions.length, 2);
  assert.deepEqual(t.feedback, { ok: false, note: 'Thiếu 了', better: '我吃了。' });
});

test('parseTurn rejects unusable output and defaults feedback to ok', () => {
  assert.equal(parseTurn('không phải json'), null);
  assert.equal(parseTurn('{"reply":{"zh":""}}'), null);
  assert.equal(parseTurn('{"reply":{"zh":"嗯"}}').feedback.ok, true);
});

test('buildMessages starts with system + opener and keeps the recent turns', () => {
  const hist = Array.from({ length: 20 }, (_, i) => (i % 2 ? { role: 'user', zh: `u${i}` } : { role: 'assistant', raw: `a${i}` }));
  const m = buildMessages('SYS', hist, 6);
  assert.equal(m[0].role, 'system');
  assert.equal(m[1].role, 'user');
  assert.equal(m.length, 2 + 6);
  assert.equal(m.at(-1).content, 'u19');
});

test('scripted turns and level filter', () => {
  const s = { level: 2, lines: [{ who: 'A' }, { who: 'B' }] };
  assert.deepEqual(scriptedTurns(s, 'B').map((t) => t.mine), [false, true]);
  assert.equal(scenariosForLevel([{ level: 1 }, { level: 3 }], 2).length, 1);
  assert.equal(clampLevel(0), 1);
  assert.equal(clampLevel(12), 7);
});

import { buildSuggestionMessages, parseSuggestions } from '../src/js/core/talk.js';

test('suggestion request is level-limited and includes the speaker line', () => {
  const m = buildSuggestionMessages({ level: 1, topic: 'food', replyZh: '你吃了吗？' });
  assert.match(m[0].content, /HSK 1/);
  assert.match(m[0].content, /at most 12 /);
  assert.match(m[1].content, /你吃了吗？/);
});

test('parseSuggestions keeps only real, unique, short Chinese answers', () => {
  const raw = JSON.stringify({ suggestions: [
    { zh: '我吃了。', vi: 'Tôi ăn rồi.' },
    { zh: '我吃了。', vi: 'trùng' },
    { zh: 'Tôi ăn rồi', vi: 'không có chữ Hán' },
    { zh: '这是一个非常非常长的回答，已经超过了第一级允许的长度很多很多。', vi: 'quá dài' },
    { zh: '你呢？', vi: 'Còn bạn?' },
  ] });
  assert.deepEqual(parseSuggestions(raw, 1).map((s) => s.zh), ['我吃了。', '你呢？']);
  assert.deepEqual(parseSuggestions('lỗi', 1), []);
  assert.deepEqual(parseSuggestions('{"suggestions":"x"}', 1), []);
});
