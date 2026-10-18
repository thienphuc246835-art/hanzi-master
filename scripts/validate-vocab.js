#!/usr/bin/env node
// Validates vocabulary, characters, lessons, texts, passages, collocations and radicals
// against CLAUDE.md §4.4, §4.5, §6. Usage: node scripts/validate-vocab.js
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { toneOf } from '../src/js/utils/pinyin.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src/js/data');
const AUDIO = path.join(ROOT, 'src/assets/audio');
const HINT_MAX = 60;
const COVERAGE_MIN = 0.95;
const BANDS = { 1: 'elementary', 2: 'elementary', 3: 'elementary', 4: 'intermediate', 5: 'intermediate', 6: 'intermediate', 7: 'advanced' };
const MNEMONIC_TYPES = ['etymology', 'creative', 'structure'];
const PUNCT = /[\s，。！？、：；“”‘’（）《》,.!?:;"'()]/g;
const HANZI = /\p{Script=Han}/u;
const MAX_LISTED = 15;

const errors = [];
const counters = new Map(); // aggregated warnings: message → count
const err = (where, msg) => errors.push(`✗ ${where}: ${msg}`);
const count = (msg) => counters.set(msg, (counters.get(msg) ?? 0) + 1);
const readJson = async (rel) => JSON.parse(await readFile(path.join(DATA, rel), 'utf8'));

function validateWord(w, hanzi, audioFiles) {
  const where = `${w.id} ${w.simplified}`;
  if (w.hsk_version !== '3.0') err(where, 'hsk_version phải là "3.0"');
  if (!(w.hsk_level >= 1 && w.hsk_level <= 7)) err(where, 'hsk_level phải trong 1..7 (7 = nhóm 7–9)');
  if (BANDS[w.hsk_level] !== w.hsk_band) err(where, `hsk_band "${w.hsk_band}" không khớp cấp ${w.hsk_level}`);
  for (const f of ['simplified', 'pinyin', 'han_viet']) if (!w[f]) err(where, `thiếu ${f}`);
  if (!w.meanings?.length || w.meanings.some((m) => !m.vi)) err(where, 'meanings thiếu nghĩa tiếng Việt');

  const chars = [...w.simplified];
  if (w.pinyin_tones?.length !== chars.length) err(where, 'pinyin_tones không khớp số chữ');
  if (w.char_pinyin && w.char_pinyin.some((p, i) => p && toneOf(p) !== w.pinyin_tones[i])) err(where, 'char_pinyin khác pinyin_tones');

  // §4.5 — graded examples (imported deck data usually has 2; the seed set has exactly 3)
  const ex = w.examples ?? [];
  if (!ex.length) err(where, 'không có câu ví dụ');
  if (ex.length < 3) count('từ có ít hơn 3 câu ví dụ (dữ liệu bộ thẻ thường có 2)');
  ex.forEach((e, i) => {
    for (const f of ['zh', 'pinyin', 'vi']) if (!e[f]) err(where, `ví dụ ${i + 1} thiếu ${f}`);
    if (![1, 2, 3].includes(e.tier)) err(where, `ví dụ ${i + 1}: tier phải là 1, 2 hoặc 3`);
    if (e.seg && e.seg.replace(/\s+/g, '') !== e.zh.replace(PUNCT, '')) err(where, `ví dụ ${i + 1}: seg không khớp zh`);
    if (e.audio && audioFiles && !audioFiles.has(e.audio)) count('câu ví dụ thiếu file audio');
  });
  if (w.source !== 'zhvi') {
    const contexts = ex.map((e) => e.context);
    if (new Set(contexts).size !== contexts.length) err(where, `3 ví dụ phải khác ngữ cảnh (${contexts.join(', ')})`);
  }
  if (!w.audio) count('từ không có file phát âm (dùng giọng đọc máy)');
  else if (audioFiles && !audioFiles.has(w.audio)) count('từ có audio nhưng file chưa được chép (chạy lại import-anki)');

  // §4.4 — every character has radical analysis
  for (const c of new Set(chars.filter((x) => HANZI.test(x)))) {
    if (!hanzi[c]) err(where, `chữ ${c} không có trong hanzi.json`);
  }
  const hint = w.mnemonic_summary?.hint_short ?? '';
  if (!hint) err(where, 'thiếu mnemonic_summary.hint_short');
  if ([...hint].length > HINT_MAX) err(where, `hint_short dài ${[...hint].length} > ${HINT_MAX} ký tự`);
  if (!w.mnemonic_summary?.word_link_vi) err(where, 'thiếu mnemonic_summary.word_link_vi');
  if (!w.lesson_id) err(where, 'chưa thuộc bài học nào');
}

function validateHanzi(c, h, radicalsByNo) {
  const where = `hanzi ${c}`;
  if (!h.han_viet) count('chữ Hán thiếu âm Hán Việt');
  if (!h.radical?.char) err(where, 'thiếu radical');
  const rad = radicalsByNo.get(h.radical?.kangxi_no);
  if (rad && rad.char !== h.radical.char && !rad.variants.includes(h.radical.char)) {
    err(where, `bộ #${h.radical.kangxi_no} là ${rad.char}, không phải ${h.radical.char}`);
  }
  if (!h.radical?.kangxi_no) count('chữ Hán có bộ thủ ngoài 214 bộ Khang Hy');
  if (!MNEMONIC_TYPES.includes(h.mnemonic?.type)) err(where, `mnemonic.type phải là ${MNEMONIC_TYPES.join(' | ')}`);
  if (!h.mnemonic?.story_vi) err(where, 'thiếu mnemonic.story_vi');
}

function validatePassage(p, wordsById) {
  const where = p.id;
  const markers = [...p.text.matchAll(/\{\{([^|}]+)\|([^}]+)\}\}/g)];
  if (!markers.length) err(where, 'không có vị trí đục lỗ {{id|chữ}}');
  for (const [, id, surface] of markers) {
    const w = wordsById.get(id);
    if (!w) err(where, `marker trỏ tới từ không tồn tại: ${id}`);
    else if (w.simplified !== surface) err(where, `marker ${id} ghi "${surface}" nhưng từ là "${w.simplified}"`);
  }
  if ((p.vocab_coverage?.at_or_below_level ?? 0) < COVERAGE_MIN) err(where, `độ phủ từ vựng < ${COVERAGE_MIN * 100}%`);
  for (const [i, q] of (p.questions ?? []).entries()) {
    if (q.type === 'multiple_choice' && !(q.answer >= 0 && q.answer < q.options.length)) err(where, `câu hỏi ${i + 1}: answer ngoài phạm vi`);
    if (q.type === 'true_false' && typeof q.answer !== 'boolean') err(where, `câu hỏi ${i + 1}: answer phải là boolean`);
  }
}

function validateText(t, lessonsById) {
  const where = `bài khóa ${t.lesson_id}`;
  if (!lessonsById.has(t.lesson_id)) err(where, 'lesson_id không tồn tại trong lessons.json');
  if (!t.sections?.length) err(where, 'cần ít nhất một sections');
  for (const s of t.sections ?? []) {
    for (const [i, l] of (s.lines ?? []).entries()) {
      if (!l.zh) err(where, `dòng ${i + 1} thiếu zh`);
      if (!l.vi) err(where, `dòng ${i + 1} thiếu vi (bản dịch)`);
    }
  }
}

async function main() {
  const manifest = await readJson('manifest.json');
  const radicals = await readJson(manifest.radicals);
  if (radicals.length !== 214) err('radicals.json', `cần 214 bộ thủ (có ${radicals.length})`);
  radicals.forEach((r, i) => { if (r.no !== i + 1) err('radicals.json', `thứ tự sai tại #${i + 1}`); });
  const radicalsByNo = new Map(radicals.map((r) => [r.no, r]));

  const hanzi = await readJson(manifest.hanzi);
  for (const [c, h] of Object.entries(hanzi)) validateHanzi(c, h, radicalsByNo);

  const audioFiles = existsSync(AUDIO) ? new Set(await readdir(AUDIO)) : null;
  const words = (await Promise.all(manifest.vocab.map(readJson))).flat();
  const ids = new Set();
  const hanziSeen = new Map();
  for (const w of words) {
    if (ids.has(w.id)) err(w.id, 'id bị trùng');
    ids.add(w.id);
    if (hanziSeen.has(w.simplified)) err(w.id, `chữ "${w.simplified}" trùng với ${hanziSeen.get(w.simplified)} (cần gộp)`);
    hanziSeen.set(w.simplified, w.id);
    validateWord(w, hanzi, audioFiles);
  }
  const wordsById = new Map(words.map((w) => [w.id, w]));

  const lessons = await readJson(manifest.lessons);
  const lessonsById = new Map(lessons.map((l) => [l.id, l]));
  const inLesson = new Map();
  for (const l of lessons) {
    if (!l.word_ids.length) err(l.id, 'bài không có từ nào');
    for (const id of l.word_ids) {
      if (!wordsById.has(id)) err(l.id, `word_id không tồn tại: ${id}`);
      if (inLesson.has(id)) err(l.id, `từ ${id} đã nằm trong bài ${inLesson.get(id)}`);
      inLesson.set(id, l.id);
    }
  }

  const texts = (await Promise.all((manifest.texts ?? []).map(readJson))).flat();
  texts.forEach((t) => validateText(t, lessonsById));
  const passages = (await Promise.all(manifest.passages.map(readJson))).flat();
  passages.forEach((p) => validatePassage(p, wordsById));
  const collocations = await readJson(manifest.collocations);
  for (const c of collocations) {
    if (c.type === 'collocation' && !c.options.includes(c.answer)) err(c.id, 'answer không nằm trong options');
    if (c.type === 'odd_one_out' && !c.items.includes(c.answer)) err(c.id, 'answer không nằm trong items');
    for (const id of c.word_ids ?? []) if (!wordsById.has(id)) err(c.id, `word_id không tồn tại: ${id}`);
  }

  for (const [msg, n] of counters) console.log(`! ${n.toLocaleString('vi-VN')} ${msg}`);
  errors.slice(0, MAX_LISTED).forEach((e) => console.log(e));
  if (errors.length > MAX_LISTED) console.log(`… và ${errors.length - MAX_LISTED} lỗi khác`);
  const byLevel = {};
  for (const w of words) byLevel[w.hsk_level] = (byLevel[w.hsk_level] ?? 0) + 1;
  console.log(`\n${words.length.toLocaleString('vi-VN')} từ (${Object.entries(byLevel).map(([l, n]) => `HSK${l === '7' ? '7–9' : l}: ${n}`).join(', ')})`);
  console.log(`${Object.keys(hanzi).length} chữ Hán · ${lessons.length} bài học · ${texts.length} bài khóa · ${passages.length} bài đục lỗ · ${collocations.length} bài kết hợp từ · ${radicals.length} bộ thủ${audioFiles ? ` · ${audioFiles.size.toLocaleString('vi-VN')} file audio` : ' · (chưa có thư mục audio)'}`);
  console.log(errors.length ? `✗ ${errors.length} lỗi` : '✓ Hợp lệ');
  process.exitCode = errors.length ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
