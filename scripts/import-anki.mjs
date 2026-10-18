#!/usr/bin/env node
// Import the ZHVI HSK 3.0 Anki deck (.apkg) into the app's data files.
// Usage: npm run import-anki -- "ZHVI HSK 3.0.apkg" [--no-media]
//
// Outputs (src/js/data/): vocab/hsk*.json, hanzi.json, strokes/*.json, lessons.json, manifest.json
// Media  (src/assets/):   audio/*.mp3 (word + example audio), img/*.webp (word illustrations)
import { writeFile, mkdir, readFile, readdir, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openZip } from './lib/zip.mjs';
import { toneOf } from '../src/js/utils/pinyin.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src/js/data');
const ASSETS = path.join(ROOT, 'src/assets');
const SEED_FILE = path.join(ROOT, 'tests/fixtures/seed-hsk1.json');

const LEVEL_KEYS = ['1', '2', '3', '4', '5', '6', '7-9'];
const LEVEL_NUM = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, '7-9': 7 };
const BAND = { 1: 'elementary', 2: 'elementary', 3: 'elementary', 4: 'intermediate', 5: 'intermediate', 6: 'intermediate', 7: 'advanced' };
const EXTRA_LESSON_SIZE = 20;
const AUTO_LESSON_SIZE = 25;
const HINT_MAX = 60;
const LIUSHU_TO_FORMATION = { 'hình thanh': '形声', 'hội ý': '会意', 'tượng hình': '象形', 'chỉ sự': '指事', 'giả tá': '假借', 'chuyển chú': '转注' };
const IDS_ARITY = { '⿰': 2, '⿱': 2, '⿴': 2, '⿵': 2, '⿶': 2, '⿷': 2, '⿸': 2, '⿹': 2, '⿺': 2, '⿻': 2, '⿲': 3, '⿳': 3 };
const HAN = /\p{Script=Han}/u;

const args = process.argv.slice(2);
const apkg = args.find((a) => !a.startsWith('--'));
const withMedia = !args.includes('--no-media');
if (!apkg) {
  console.error('Cách dùng: npm run import-anki -- "đường/dẫn/ZHVI HSK 3.0.apkg" [--no-media]');
  process.exit(1);
}

const log = (...m) => console.log('•', ...m);
const json = (v) => JSON.stringify(v);
const lines = (arr) => `[\n${arr.map(json).join(',\n')}\n]\n`;
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const pad = (n, w = 2) => String(n).padStart(w, '0');

// ---------- IDS parsing ----------
function parseIds(ids) {
  const chars = [...(ids ?? '')];
  let i = 0;
  const node = () => {
    const c = chars[i++];
    if (c === undefined) return null;
    const arity = IDS_ARITY[c];
    if (!arity) return { leaf: c };
    const kids = [];
    for (let k = 0; k < arity; k++) kids.push(node());
    return { op: c, kids: kids.filter(Boolean) };
  };
  return node();
}
const leaves = (n) => (!n ? [] : n.leaf ? [n.leaf] : n.kids.flatMap(leaves));
// Han ideographs and CJK radical forms only — excludes ①…⑳ placeholders and CJK stroke characters
const isComponent = (p) => /\p{Script=Han}/u.test(p) && !/[㇀-㇯]/u.test(p);
const topParts = (n) => (!n || n.leaf ? [] : n.kids.map((k) => (k.leaf ? k.leaf : leaves(k).join(''))));

async function main() {
  const t0 = Date.now();
  log(`Đọc ${apkg}`);
  const zip = await openZip(apkg);
  const media = JSON.parse((await zip.readEntry('media')).toString('utf8'));
  const mediaByName = new Map(Object.entries(media).map(([idx, name]) => [name, idx]));
  log(`${zip.entries.size} mục trong gói, ${mediaByName.size} file media`);

  // ---------- SQLite collection ----------
  const tmp = path.join(tmpdir(), `hzm-import-${process.pid}.anki2`);
  await writeFile(tmp, await zip.readEntry('collection.anki2'));
  const db = new DatabaseSync(tmp, { readOnly: true });
  const col = db.prepare('select models from col').get();
  const model = Object.values(JSON.parse(col.models)).find((m) => m.name.startsWith('ZHVI-HSK'));
  if (!model) throw new Error('Không tìm thấy note type ZHVI-HSK trong bộ thẻ');
  const F = Object.fromEntries(model.flds.map((f, i) => [f.name, i]));
  const notes = db.prepare('select id, flds, tags from notes where mid = ? order by id').all(model.id);
  db.close();
  await rm(tmp, { force: true });
  log(`${notes.length} từ (note type ${model.name})`);

  // ---------- Deck JS data: character dictionary + confusables ----------
  const readJsData = async (name) => {
    const idx = mediaByName.get(name);
    if (idx === undefined) return null;
    const text = (await zip.readEntry(idx)).toString('utf8').replace(/^﻿/, '');
    return text;
  };
  const charDict = {};
  for (const name of mediaByName.keys()) {
    if (!/^_cd\d+_[0-9a-f]{2}\.js$/.test(name)) continue;
    const text = await readJsData(name);
    Object.assign(charDict, JSON.parse(text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'))));
  }
  const discrimName = [...mediaByName.keys()].find((n) => /^_discrim\d+\.js$/.test(n));
  const discrimText = discrimName ? await readJsData(discrimName) : null;
  const confusables = discrimText ? JSON.parse(discrimText.slice(discrimText.indexOf('{'), discrimText.lastIndexOf('}') + 1)) : {};
  log(`${Object.keys(charDict).length} chữ Hán có dữ liệu, ${Object.keys(confusables).length} nhóm từ dễ nhầm`);

  const radicals = JSON.parse(await readFile(path.join(DATA, 'radicals.json'), 'utf8'));
  const radicalByChar = new Map();
  for (const r of radicals) {
    radicalByChar.set(r.char, r);
    for (const v of r.variants) if (!radicalByChar.has(v)) radicalByChar.set(v, r);
  }
  const seed = JSON.parse(await readFile(SEED_FILE, 'utf8'));
  const seedByHanzi = new Map(seed.map((w) => [w.simplified, w]));
  const seedChars = new Map(seed.flatMap((w) => w.characters.map((c) => [c.char, c])));

  // ---------- Notes → words ----------
  const words = [];
  const usedChars = new Set();
  const neededMedia = new Set();
  const singleCharGloss = new Map();
  const mp3Of = (file) => {
    if (!file) return null;
    const mp3 = file.replace(/\.ogg$/, '.mp3');
    return mediaByName.has(mp3) ? mp3 : mediaByName.has(file) ? file : null;
  };

  for (const n of notes) {
    const f = n.flds.split('\x1f');
    const levelKey = f[F.HSK].trim();
    const level = LEVEL_NUM[levelKey];
    if (!level) continue;
    const hanzi = f[F.Hanzi].trim();
    const chars = [...hanzi];
    const meanings = JSON.parse(f[F.MeaningsJSON] || '[]').map((m) => ({ pos: m.pos ?? '', vi: m.gloss, en: '' }));
    const relations = JSON.parse(f[F.RelationsJSON] || '{}');
    const syllables = f[F.Pinyin].trim().split(/\s+/);
    // Erhua and other mismatches: fall back to dictionary readings per character
    const charPinyin = syllables.length === chars.length
      ? syllables
      : chars.map((c) => (c === '儿' ? 'r' : charDict[c]?.py?.split(/[,\s]/)[0] ?? ''));
    const tones = charPinyin.map((s) => toneOf(s));
    const audio = mp3Of(f[F.WordAudio].trim());
    if (audio) neededMedia.add(audio);
    const image = relations.img && mediaByName.has(relations.img) ? relations.img : null;
    if (image) neededMedia.add(image);

    const deckExamples = JSON.parse(f[F.ExamplesJSON] || '[]')
      .filter((e) => e.zh)
      .sort((a, b) => [...a.zh].length - [...b.zh].length)
      .map((e, i, all) => {
        const exAudio = mp3Of(e.audio);
        if (exAudio) neededMedia.add(exAudio);
        return {
          tier: Math.min(3, all.length === 1 ? 1 : i + 1),
          max_level: level,
          context: 'general',
          zh: e.zh,
          pinyin: e.pinyin,
          vi: e.vi,
          audio: exAudio,
        };
      });

    const seedWord = seedByHanzi.get(hanzi);
    const examples = seedWord ? [...seedWord.examples, ...deckExamples.map((e) => ({ ...e, tier: Math.min(2, e.tier) }))] : deckExamples;
    chars.forEach((c) => { if (HAN.test(c)) usedChars.add(c); });
    if (chars.length === 1 && meanings[0]) singleCharGloss.set(hanzi, meanings[0].vi);

    const tags = n.tags.trim().split(/\s+/);
    const bookTag = tags.map((t) => t.match(/^ZHVI::Quyển-(\d)::(Bài-(\d+)|Bổ-sung)$/)).find(Boolean);

    words.push({
      id: `zh${n.id}`,
      hsk_version: '3.0',
      hsk_level: level,
      hsk_band: BAND[level],
      simplified: hanzi,
      traditional: f[F.Traditional].trim() || hanzi,
      pinyin: f[F.Pinyin].trim(),
      char_pinyin: charPinyin,
      pinyin_tones: tones,
      han_viet: f[F.HanViet].trim(),
      meanings: meanings.length ? meanings : [{ pos: '', vi: '', en: '' }],
      frequency_rank: Number(f[F.Freq]) || null,
      audio,
      image,
      examples,
      syn: relations.syn ?? [],
      ant: relations.ant ?? [],
      confusables: confusables[hanzi] ?? [],
      mnemonic_summary: seedWord?.mnemonic_summary ?? null,
      _book: bookTag ? { lesson: bookTag[3] ? Number(bookTag[3]) : null } : null,
      source: 'zhvi',
    });
  }

  // ---------- Merge duplicate hanzi (polyphones split across notes) into one word ----------
  // Keep the entry at the lowest level / earliest lesson; other readings become extra meanings.
  const byHanzi = new Map();
  for (const w of words) {
    if (!byHanzi.has(w.simplified)) byHanzi.set(w.simplified, []);
    byHanzi.get(w.simplified).push(w);
  }
  const lessonRank = (w) => (w._book?.lesson ?? 999);
  let mergedCount = 0;
  for (const group of byHanzi.values()) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.hsk_level - b.hsk_level || lessonRank(a) - lessonRank(b) || a.id.localeCompare(b.id));
    const [primary, ...rest] = group;
    const plain = (p) => p.replace(/\s+/g, '');
    primary.merged_ids = rest.map((w) => w.id);
    primary.other_readings = [];
    const seenZh = new Set(primary.examples.map((e) => e.zh));
    const seenVi = new Set(primary.meanings.map((m) => m.vi));
    for (const w of rest) {
      const otherReading = plain(w.pinyin) !== plain(primary.pinyin);
      if (otherReading) primary.other_readings.push({ pinyin: w.pinyin, hsk_level: w.hsk_level, audio: w.audio });
      for (const m of w.meanings) {
        const vi = otherReading ? `(${w.pinyin}) ${m.vi}` : m.vi;
        if (!seenVi.has(vi)) { seenVi.add(vi); primary.meanings.push({ ...m, vi }); }
      }
      for (const e of w.examples) {
        if (seenZh.has(e.zh)) continue;
        seenZh.add(e.zh);
        primary.examples.push({ ...e, tier: 3, reading: otherReading ? w.pinyin : undefined });
      }
      for (const key of ['syn', 'ant']) {
        const have = new Set(primary[key].map((s) => s.hz));
        for (const s of w[key]) if (!have.has(s.hz)) primary[key].push(s);
      }
      primary.confusables = [...new Set([...primary.confusables, ...w.confusables])];
      if (!primary.image && w.image) primary.image = w.image;
      mergedCount++;
    }
    if (!primary.other_readings.length) delete primary.other_readings;
  }
  const mergedAway = new Set([...byHanzi.values()].flatMap((g) => g.slice(1).map((w) => w.id)));
  for (let i = words.length - 1; i >= 0; i--) if (mergedAway.has(words[i].id)) words.splice(i, 1);
  log(`Gộp ${mergedCount} mục trùng chữ Hán → còn ${words.length} từ duy nhất`);

  // ---------- Example segmentation (for sentence builder / translation) ----------
  const lexicon = new Set(words.map((w) => w.simplified));
  const maxLen = Math.max(...[...lexicon].map((w) => [...w].length));
  const segment = (text) => {
    const chars = [...text.replace(/[\s，。！？、：；“”‘’（）《》…,.!?:;"'()]/g, '')];
    const out = [];
    for (let i = 0; i < chars.length;) {
      let len = Math.min(maxLen, chars.length - i);
      while (len > 1 && !lexicon.has(chars.slice(i, i + len).join(''))) len--;
      out.push(chars.slice(i, i + len).join(''));
      i += len;
    }
    return out;
  };
  for (const w of words) {
    for (const e of w.examples) {
      if (e.seg) continue;
      const tokens = segment(e.zh);
      if (tokens.length >= 3 && tokens.length <= 10) e.seg = tokens.join(' ');
    }
  }

  // ---------- Character dictionary (radical mnemonics §4.4) ----------
  const partDesc = (p) => {
    const r = radicalByChar.get(p);
    if (r) return `${p} (bộ ${r.name_vi} – ${r.meaning_vi})`;
    const d = charDict[p];
    const gloss = singleCharGloss.get(p);
    if (d?.hanviet) return `${p} (${d.hanviet}${gloss ? ` – ${gloss}` : ''})`;
    return p;
  };
  const hanziOut = {};
  const strokesOut = {};
  for (const c of [...usedChars].sort()) {
    const d = charDict[c] ?? {};
    const rad = radicalByChar.get(d.radical);
    const tree = parseIds(d.ids);
    // cjkvi-ids uses placeholders (①②③…) and bare strokes (㇏) for unencodable parts: unusable as hints
    const usable = leaves(tree).every(isComponent);
    const parts = usable ? topParts(tree) : [];
    const simpleParts = parts.filter((p) => [...p].length === 1);
    const hv = (d.hanviet ?? '').split(/[,\s]/)[0].toUpperCase();
    const formation = LIUSHU_TO_FORMATION[d.liushu] ?? null;
    let story;
    if (d.liushu === 'hình thanh' && simpleParts.length === 2) {
      const semIdx = simpleParts.findIndex((p) => radicalByChar.get(p) === rad);
      const sem = simpleParts[semIdx >= 0 ? semIdx : 0];
      const pho = simpleParts[semIdx >= 0 ? 1 - semIdx : 1];
      story = `Chữ hình thanh: ${partDesc(sem)} chỉ nghĩa, ${partDesc(pho)} gợi âm → ${hv}.`;
    } else if (d.liushu === 'hội ý' && simpleParts.length >= 2) {
      story = `Chữ hội ý: ghép nghĩa ${simpleParts.map(partDesc).join(' + ')} → ${hv}.`;
    } else if (d.liushu === 'tượng hình') {
      story = `Chữ tượng hình — vẽ lại hình dạng sự vật → ${hv}.`;
    } else if (d.liushu === 'chỉ sự') {
      story = `Chữ chỉ sự — dùng nét ký hiệu để biểu thị ý → ${hv}.`;
    } else if (parts.length) {
      story = `Cấu tạo ${d.ids}: ${parts.map(partDesc).join(' + ')} → ${hv}.`;
    } else {
      story = rad ? `Thuộc bộ ${rad.char} (bộ ${rad.name_vi} – ${rad.meaning_vi}) → ${hv}.` : `${c} → ${hv}.`;
    }
    const seedC = seedChars.get(c);
    hanziOut[c] = {
      char: c,
      traditional: d.trad || c,
      han_viet: seedC?.han_viet ?? hv,
      py: d.py ?? null,
      stroke_count: d.strokeCount ?? null,
      frequency: d.freq ?? null,
      ids: d.ids ?? null,
      radical: seedC?.radical ?? (rad
        ? { char: rad.char, kangxi_no: rad.no, name_vi: rad.name_vi, meaning_vi: rad.meaning_vi }
        : { char: d.radical ?? c, kangxi_no: null, name_vi: cap(d.radicalHanviet ?? ''), meaning_vi: '' }),
      components: seedC?.components ?? (usable ? leaves(tree) : []).filter((p) => p !== c).map((p) => {
        const r = radicalByChar.get(p);
        return r ? { part: p, name_vi: r.name_vi, meaning_vi: r.meaning_vi } : { part: p, meaning_vi: charDict[p]?.hanviet ?? '' };
      }),
      formation: seedC?.formation ?? formation,
      assembly: seedC?.assembly ?? (tree?.op && simpleParts.length === parts.length && parts.length >= 2 ? parts : []),
      mnemonic: seedC?.mnemonic ?? { type: 'structure', story_vi: story },
    };
    if (d.strokeData?.strokes) strokesOut[c] = d.strokeData;
  }

  // A few deck entries lack Hán Việt: compose it from the characters
  for (const w of words) {
    if (!w.han_viet) w.han_viet = [...w.simplified].map((c) => hanziOut[c]?.han_viet?.toLowerCase() ?? '').filter(Boolean).join(' ');
  }

  // Word-level hint & link (hand-written seed hints are kept)
  for (const w of words) {
    if (w.mnemonic_summary) continue;
    const uniq = [...new Set([...w.simplified].filter((c) => hanziOut[c]))];
    const hintParts = uniq.map((c) => {
      const h = hanziOut[c];
      const ap = h.assembly.length >= 2 ? h.assembly.join('+') : `bộ ${h.radical.char}`;
      return `${ap}→${h.han_viet}`;
    });
    let hint = hintParts.join('; ');
    if ([...hint].length > HINT_MAX) hint = `${[...hint].slice(0, HINT_MAX - 1).join('')}…`;
    w.mnemonic_summary = {
      hint_short: hint || w.han_viet.toUpperCase(),
      word_link_vi: `${uniq.map((c) => hanziOut[c].han_viet).join(' + ')} = ${w.meanings[0].vi}`,
    };
  }

  // ---------- Lessons ----------
  const titles = JSON.parse(await readFile(path.join(DATA, 'lesson-titles.json'), 'utf8'));
  const lessons = [];
  const makeLesson = (level, id, number, kind, list, label) => {
    const t = titles[id];
    lessons.push({
      id, level, number, kind, label,
      title_vi: t?.title_vi ?? `${cap(list.slice(0, 3).map((w) => w.meanings[0].vi.split(/[,;]/)[0].trim()).join(', '))}…`,
      title_zh: t?.title_zh ?? list.slice(0, 4).map((w) => w.simplified).join('、'),
      has_title: !!t,
      word_ids: list.map((w) => w.id),
    });
  };
  const byFreq = (a, b) => (a.frequency_rank ?? 1e9) - (b.frequency_rank ?? 1e9);
  for (const key of LEVEL_KEYS) {
    const level = LEVEL_NUM[key];
    const lvlWords = words.filter((w) => w.hsk_level === level);
    const booked = lvlWords.filter((w) => w._book?.lesson);
    if (booked.length) {
      const nums = [...new Set(booked.map((w) => w._book.lesson))].sort((a, b) => a - b);
      for (const num of nums) makeLesson(level, `hsk${level}-b${pad(num)}`, num, 'lesson', booked.filter((w) => w._book.lesson === num), `Bài ${pad(num)}`);
      const extra = lvlWords.filter((w) => !w._book?.lesson).sort(byFreq);
      for (let i = 0; i < extra.length; i += EXTRA_LESSON_SIZE) {
        const k = i / EXTRA_LESSON_SIZE + 1;
        makeLesson(level, `hsk${level}-bs${pad(k)}`, k, 'extra', extra.slice(i, i + EXTRA_LESSON_SIZE), `Bổ sung ${pad(k)}`);
      }
    } else {
      const sorted = [...lvlWords].sort(byFreq);
      for (let i = 0; i < sorted.length; i += AUTO_LESSON_SIZE) {
        const k = i / AUTO_LESSON_SIZE + 1;
        makeLesson(level, `hsk${level}-b${pad(k, sorted.length > 99 * AUTO_LESSON_SIZE ? 3 : 2)}`, k, 'lesson', sorted.slice(i, i + AUTO_LESSON_SIZE), `Bài ${pad(k, sorted.length > 99 * AUTO_LESSON_SIZE ? 3 : 2)}`);
      }
    }
  }
  const wordsById = new Map(words.map((w) => [w.id, w]));
  lessons.forEach((l, li) => l.word_ids.forEach((id, pos) => {
    const w = wordsById.get(id);
    w.lesson_id = l.id;
    w.order = li * 1000 + pos;
  }));
  for (const w of words) delete w._book;
  log(`${lessons.length} bài học`);

  // ---------- Remap passages & collocations from seed ids ----------
  const seedIdToNew = new Map(seed.map((s) => [s.id, words.find((w) => w.simplified === s.simplified)?.id]));
  const remapText = (text) => text.replace(/\{\{([^|}]+)\|([^}]+)\}\}/g, (m, id, surface) => {
    const next = seedIdToNew.get(id) ?? (wordsById.has(id) ? id : words.find((w) => w.simplified === surface)?.id);
    return next ? `{{${next}|${surface}}}` : surface;
  });
  const passageDir = path.join(DATA, 'passages');
  const passageFiles = (await readdir(passageDir)).filter((f) => f.endsWith('.json'));
  for (const file of passageFiles) {
    const list = JSON.parse(await readFile(path.join(passageDir, file), 'utf8'));
    list.forEach((p) => { p.text = remapText(p.text); });
    await writeFile(path.join(passageDir, file), `${JSON.stringify(list, null, 2)}\n`);
  }
  const collPath = path.join(DATA, 'collocations.json');
  const coll = JSON.parse(await readFile(collPath, 'utf8'));
  coll.forEach((c) => { c.word_ids = (c.word_ids ?? []).map((id) => seedIdToNew.get(id) ?? id).filter((id) => wordsById.has(id)); });
  await writeFile(collPath, lines(coll));

  // ---------- Write data ----------
  await mkdir(path.join(DATA, 'vocab'), { recursive: true });
  const vocabFiles = [];
  for (const key of LEVEL_KEYS) {
    const level = LEVEL_NUM[key];
    const list = words.filter((w) => w.hsk_level === level).sort((a, b) => a.order - b.order);
    const file = `vocab/hsk${key}.json`;
    await writeFile(path.join(DATA, file), lines(list));
    vocabFiles.push(file);
  }
  await writeFile(path.join(DATA, 'hanzi.json'), `{\n${Object.entries(hanziOut).map(([k, v]) => `${json(k)}:${json(v)}`).join(',\n')}\n}\n`);
  await writeFile(path.join(DATA, 'lessons.json'), lines(lessons));
  const strokeDir = path.join(DATA, 'strokes');
  await rm(strokeDir, { recursive: true, force: true });
  await mkdir(strokeDir, { recursive: true });
  for (const [c, data] of Object.entries(strokesOut)) {
    await writeFile(path.join(strokeDir, `${c.codePointAt(0).toString(16)}.json`), json(data));
  }
  const textDir = path.join(DATA, 'texts');
  await mkdir(textDir, { recursive: true });
  const textFiles = (await readdir(textDir)).filter((f) => /^hsk.*\.json$/.test(f)).map((f) => `texts/${f}`);
  const manifest = {
    version: `zhvi-${new Date().toISOString().slice(0, 10)}-${words.length}`,
    source: 'ZHVI HSK 3.0 (Anki) — xem src/js/data/LICENSE-DATA.md',
    vocab: vocabFiles,
    hanzi: 'hanzi.json',
    lessons: 'lessons.json',
    texts: textFiles,
    passages: passageFiles.map((f) => `passages/${f}`),
    collocations: 'collocations.json',
    radicals: 'radicals.json',
  };
  await writeFile(path.join(DATA, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  log(`Đã ghi ${vocabFiles.length} file từ vựng, ${Object.keys(hanziOut).length} chữ Hán, ${Object.keys(strokesOut).length} file nét viết`);

  // ---------- Media ----------
  if (withMedia) {
    await mkdir(path.join(ASSETS, 'audio'), { recursive: true });
    await mkdir(path.join(ASSETS, 'img'), { recursive: true });
    let copied = 0;
    let skipped = 0;
    let bytes = 0;
    let missing = 0;
    for (const name of neededMedia) {
      const entryName = mediaByName.get(name);
      const entry = zip.entries.get(entryName);
      if (!entry) { missing++; continue; }
      const dest = path.join(ASSETS, name.endsWith('.webp') ? 'img' : 'audio', name);
      const existing = await stat(dest).catch(() => null);
      if (existing?.size === entry.uncompressedSize) { skipped++; continue; }
      const data = await zip.readEntry(entryName);
      await writeFile(dest, data);
      copied++;
      bytes += data.length;
      if (copied % 5000 === 0) log(`… đã chép ${copied} file media`);
    }
    log(`Media: chép ${copied} file (${Math.round(bytes / 1048576)} MB), bỏ qua ${skipped} file đã có, thiếu ${missing}`);
  }
  await zip.close();
  log(`Xong trong ${Math.round((Date.now() - t0) / 1000)} giây. Phiên bản dữ liệu: ${manifest.version}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
