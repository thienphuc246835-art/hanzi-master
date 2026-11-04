// Giáo trình 发展汉语 初级综合 (I) — nằm chung mục "Bài học" với HSK (/coursebook, /coursebook/:n)
// Từ vựng dùng cùng bảng thẻ như bài học HSK: viền màu thanh điệu, ẩn/hiện pinyin & nghĩa, lưới/danh sách
import { h, clear, append } from '../utils/dom.js';
import { icons } from '../utils/icons.js';
import { openModal } from '../utils/ui.js';
import { playText, stopAudio } from '../utils/audio.js';
import { toneOf } from '../utils/pinyin.js';
import { HSK_LEVELS } from '../core/constants.js';
import { state } from '../core/store.js';
import { pinyinOf } from '../core/text.js';
import { displayToggles, viewToggle, toneLegend, renderWords, readBoardPrefs, openWord } from '../components/word-board.js';
import { tonedPinyin } from '../components/word-detail.js';

const BASE = 'src/js/data/coursebook/';
const BOOK_TITLE = '发展汉语 · 初级综合 (I)';
const TAB_LABEL = 'Giáo trình 发展汉语';
const PREFS_KEY = 'hzm.coursebook.prefs';
const LINE_GAP_MS = 350;

// Nhân vật chính xuất hiện xuyên suốt giáo trình (tên riêng không có trong từ điển)
const MAIN_CHARACTERS = Object.freeze({
  马丁: 'Mǎdīng', 林娜: 'Línnà', 山田: 'Shāntián', 阿明: 'Āmíng', 朱云: 'Zhū Yún', 崔浩: 'Cuī Hào', 李一民: 'Lǐ Yīmín',
});
const PUNCT = /[\s，。！？、：；“”‘’（）…—,.!?:;"'()]/;

const cache = new Map();

async function fetchJson(file) {
  if (!cache.has(file)) {
    cache.set(file, fetch(BASE + file).then((r) => { if (!r.ok) throw new Error(file); return r.json(); }));
  }
  return cache.get(file);
}

function readPrefs() {
  try { return { vi: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { vi: true }; }
}
function writePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

const speak = (zh) => playText(zh, { rate: state.settings.tts_rate });
const soundButton = (zh, label = 'Nghe') => h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${label}: ${zh}`, onClick: (e) => { e.stopPropagation(); speak(zh); } }, icons.sound());

// Pinyin builder for one lesson: the book's own readings (words, names) first, dictionary for the rest
function makePinyin(lesson) {
  const lex = new Map(Object.entries(MAIN_CHARACTERS));
  const add = (zh, py) => { if (zh && py && !zh.includes('…')) lex.set(zh, py.split('(')[0].trim()); };
  for (const t of lesson.texts) { t.vocab.forEach((w) => add(w.zh, w.py)); t.names.forEach((n) => add(n.zh, n.py)); }
  lesson.extra.forEach((w) => add(w.zh, w.py));
  const maxLen = Math.max(1, ...[...lex.keys()].map((k) => [...k].length));
  return (text) => {
    const chars = [...text];
    const parts = [];
    let rest = '';
    const flush = () => { if (rest) { parts.push(pinyinOf(rest)); rest = ''; } };
    for (let i = 0; i < chars.length;) {
      if (PUNCT.test(chars[i])) { flush(); parts.push(chars[i]); i += 1; continue; }
      let len = Math.min(maxLen, chars.length - i);
      while (len >= 1 && !lex.has(chars.slice(i, i + len).join(''))) len -= 1;
      if (len >= 1) { flush(); parts.push(lex.get(chars.slice(i, i + len).join(''))); i += len; } else { rest += chars[i]; i += 1; }
    }
    flush();
    return parts.join(' ').replace(/\s+([，。！？、：；,.!?:;”’）])/g, '$1').replace(/（\s+/g, '（').trim();
  };
}

// ---------------- Thẻ từ vựng (cùng cấu trúc với bài học HSK) ----------------
const deckIndex = () => {
  if (!deckIndex.map || deckIndex.map.size !== state.words.length) {
    deckIndex.map = new Map();
    for (const w of state.words) if (!deckIndex.map.has(w.simplified)) deckIndex.map.set(w.simplified, w);
  }
  return deckIndex.map;
};

// Từ giáo trình → đối tượng giống từ HSK để dùng chung wordCard / renderWords
function toBoardWord(w, section) {
  const known = deckIndex().get(w.zh) ?? null;
  const first = w.py.split(/[\s']/)[0];
  return {
    id: known?.id ?? `cb:${w.zh}`,
    simplified: w.zh,
    pinyin: w.py,
    pinyin_tones: [toneOf(first)],
    han_viet: known?.han_viet ?? '',
    meanings: [{ vi: w.vi, pos: w.pos }],
    hsk_level: known?.hsk_level,
    cb: w,
    known,
    section,
  };
}

function openCoursebookWord(word, pinyin) {
  const w = word.cb;
  openModal(h('div', { class: 'stack' },
    h('div', { class: 'row row--between' },
      h('span', { class: 'chip chip--gold' }, word.section ?? 'Giáo trình'),
      word.known ? h('span', { class: 'chip' }, word.known.hsk_level === 7 ? 'HSK 7–9' : `HSK ${word.known.hsk_level}`) : null),
    h('div', { class: 'flashcard__hanzi flashcard__hanzi--md center' }, w.zh),
    h('div', { class: 'center' }, tonedPinyin(word, 'pinyin flashcard__pinyin'),
      word.han_viet ? h('div', { class: 'flashcard__hanviet' }, word.han_viet.toUpperCase()) : null),
    h('div', { class: 'action-row' }, h('button', { class: 'icon-btn', type: 'button', onClick: () => speak(w.zh) }, '🔊 Phát âm')),
    h('ul', { class: 'meanings' }, h('li', {}, h('span', { class: 'chip' }, w.pos), ' ', w.vi)),
    w.ex ? h('div', { class: 'cb-word__ex' },
      h('div', { class: 'hanzi', lang: 'zh-CN' }, w.ex, ' ', soundButton(w.ex, 'Nghe ví dụ')),
      h('div', { class: 'pinyin cb-word__exp' }, pinyin(w.ex)),
      h('div', { class: 'muted' }, w.ex_vi)) : null,
    word.known ? h('button', { class: 'btn btn--small', type: 'button', onClick: () => openWord(word.known) }, 'Xem chi tiết đầy đủ (bộ thủ, nét bút…)') : null),
  { label: `Chi tiết từ ${w.zh}` });
}

// Bảng từ vựng một nhóm (toolbar + lưới/danh sách) giống trang bài học HSK
function vocabBoard(groups, pinyin) {
  const prefs = readBoardPrefs();
  const results = h('div', { 'aria-live': 'polite' });
  const root = h('div', { class: 'board' });
  const paint = () => {
    clear(results);
    groups.forEach(({ title, words }) => {
      if (!words.length) return;
      const box = h('div');
      results.append(h('section', { class: 'stack' }, title ? h('h3', { class: 'card__title', lang: 'zh-CN' }, title) : null, box));
      renderWords(box, words, prefs.view, { onOpen: (w) => openCoursebookWord(w, pinyin) });
    });
  };
  append(root, [
    h('div', { class: 'board__toolbar' }, ...displayToggles(root, prefs), viewToggle(prefs, paint)),
    toneLegend(),
    results,
  ]);
  paint();
  return root;
}

// ---------------- Mục từ chi tiết: từ → pinyin → loại từ → nghĩa → ví dụ ----------------
function wordEntry(w, pinyin) {
  const known = deckIndex().get(w.zh);
  return h('article', { class: 'cb-word' },
    h('div', { class: 'cb-word__head' },
      h('span', { class: 'cb-word__zh hanzi', lang: 'zh-CN' }, w.zh),
      h('span', { class: 'pinyin cb-word__py' }, w.py),
      h('span', { class: 'chip' }, w.pos),
      soundButton(w.zh, 'Nghe từ'),
      known ? h('span', { class: 'cb-word__hsk muted small', title: 'Có trong bộ từ vựng HSK 3.0' }, known.hsk_level === 7 ? 'HSK 7–9' : `HSK ${known.hsk_level}`) : null),
    h('div', { class: 'cb-word__vi' }, w.vi),
    w.ex ? h('div', { class: 'cb-word__ex' },
      h('div', { class: 'hanzi', lang: 'zh-CN' }, w.ex, ' ', soundButton(w.ex, 'Nghe ví dụ')),
      h('div', { class: 'pinyin cb-word__exp' }, pinyin(w.ex)),
      h('div', { class: 'muted' }, w.ex_vi)) : null);
}

function nameEntry(n) {
  return h('li', { class: 'cb-name' },
    h('span', { class: 'hanzi', lang: 'zh-CN' }, n.zh), ' ', soundButton(n.zh, 'Nghe tên'), ' ',
    h('span', { class: 'pinyin' }, n.py), ' — ', h('span', {}, n.vi));
}

// ---------------- Bài khóa ----------------
function textBlock(text, onPlay, pinyin) {
  const lineEls = text.lines.map((line, i) => h('div', { class: 'cb-line', tabindex: '0', role: 'button', 'aria-label': `Nghe: ${line.zh}`,
    onClick: () => onPlay(text, i), onKeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); onPlay(text, i); } } },
  line.s ? h('span', { class: 'cb-line__who' }, line.s) : null,
  h('div', { class: 'cb-line__body' },
    h('div', { class: 'cb-line__zh hanzi', lang: 'zh-CN' }, line.zh),
    h('div', { class: 'cb-line__py pinyin' }, pinyin(line.zh)),
    h('div', { class: 'cb-line__vi' }, line.vi))));
  text.lineEls = lineEls;
  return h('section', { class: 'card stack cb-text' },
    h('div', { class: 'row row--between' }, h('h3', { class: 'card__title', lang: 'zh-CN' }, text.heading),
      h('button', { class: 'btn btn--small', type: 'button', onClick: () => onPlay(text, null) }, icons.sound(), 'Nghe cả đoạn')),
    lineEls);
}

// ---------------- Thanh tab chung với HSK ----------------
function levelTabs(active) {
  const levels = [...new Set(state.lessons.map((l) => l.level))].sort((a, b) => a - b);
  return h('nav', { class: 'level-tabs', 'aria-label': 'Chọn cấp HSK hoặc giáo trình' },
    levels.map((l) => h('a', { class: 'level-tabs__tab', href: `#/lessons/${l}` }, HSK_LEVELS.find((x) => x.level === l)?.label ?? `HSK ${l}`)),
    h('a', { class: 'level-tabs__tab', href: '#/coursebook', 'aria-current': active ? 'page' : null }, TAB_LABEL));
}

// ---------------- Danh sách bài ----------------
function renderIndex(root, index) {
  const words = index.lessons.reduce((s, l) => s + l.words + l.extra, 0);
  append(root, [
    h('div', { class: 'page-head' }, h('div', {},
      h('h1', {}, 'Bài học'),
      h('p', { class: 'page-head__sub' }, `${TAB_LABEL} · ${BOOK_TITLE} · ${index.lessons.length} bài · ${words} từ`))),
    levelTabs(true),
    h('div', { class: 'lesson-grid' }, index.lessons.map((l) => h('article', { class: 'lesson-card' },
      h('div', { class: 'lesson-card__top' },
        h('span', { class: 'lesson-card__badge' }, `BÀI ${String(l.number).padStart(2, '0')}`),
        h('span', { class: 'lesson-card__chevron' }, icons.chevron())),
      h('h3', { class: 'lesson-card__title' }, h('a', { class: 'lesson-card__link', href: `#/coursebook/${l.number}` }, l.title_vi)),
      h('p', { class: 'lesson-card__zh', lang: 'zh-CN' }, l.title_zh),
      h('p', { class: 'lesson-card__meta' }, h('span', {}, icons.book(), `${l.words} từ mới`), h('span', {}, `${l.extra} từ bổ sung · ${l.texts} bài khóa`)),
      h('span', { class: 'lesson-card__num', 'aria-hidden': 'true' }, String(l.number).padStart(2, '0'))))),
  ]);
}

// ---------------- Chi tiết một bài ----------------
function renderLesson(root, lesson, index) {
  const prefs = readPrefs();
  const pinyin = makePinyin(lesson);
  let cancelled = false;
  const section = h('div', { class: 'stack' });
  const tabs = { vocab: 'Từ mới', extra: 'Từ bổ sung', texts: 'Bài khóa', detail: 'Từ & ví dụ' };
  let tab = 'vocab';

  async function play(text, only) {
    cancelled = false;
    const indices = only === null ? text.lines.map((_, i) => i) : [only];
    for (const i of indices) {
      if (cancelled) return;
      text.lineEls.forEach((el, j) => el.classList.toggle('cb-line--playing', j === i));
      await speak(text.lines[i].zh.replace(/（.*?）/g, ''));
      await new Promise((r) => setTimeout(r, LINE_GAP_MS));
    }
    text.lineEls.forEach((el) => el.classList.remove('cb-line--playing'));
  }

  const groupsOf = () => lesson.texts.filter((t) => t.vocab.length)
    .map((t) => ({ title: t.heading, words: t.vocab.map((w) => toBoardWord(w, t.heading)) }));
  const views = {
    vocab: () => vocabBoard(groupsOf(), pinyin),
    extra: () => (lesson.extra.length
      ? vocabBoard([{ title: '', words: lesson.extra.map((w) => toBoardWord(w, 'Từ bổ sung')) }], pinyin)
      : h('p', { class: 'muted' }, 'Bài này không có từ bổ sung.')),
    texts: () => h('div', { class: 'stack' }, lesson.texts.map((t) => textBlock(t, play, pinyin))),
    detail: () => h('div', { class: 'stack' },
      lesson.texts.filter((t) => t.vocab.length || t.names.length).map((t) => h('section', { class: 'stack' },
        h('h3', { class: 'card__title', lang: 'zh-CN' }, t.heading),
        h('div', { class: 'cb-words' }, t.vocab.map((w) => wordEntry(w, pinyin))),
        t.names.length ? h('div', {}, h('h4', { class: 'small muted' }, '专名 · Tên riêng'), h('ul', { class: 'cb-names' }, t.names.map(nameEntry))) : null)),
      lesson.extra.length ? h('section', { class: 'stack' }, h('h3', { class: 'card__title' }, '补充词语 · Từ bổ sung'),
        h('div', { class: 'cb-words' }, lesson.extra.map((w) => wordEntry(w, pinyin)))) : null),
  };
  const counts = () => ({
    vocab: lesson.texts.reduce((n, t) => n + t.vocab.length, 0),
    extra: lesson.extra.length,
    texts: lesson.texts.length,
    detail: lesson.texts.reduce((n, t) => n + t.vocab.length, 0) + lesson.extra.length,
  });

  const tabBar = h('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Nội dung bài' });
  const paint = () => {
    cancelled = true;
    stopAudio();
    const c = counts();
    tabBar.replaceChildren(...Object.entries(tabs).map(([key, label]) => h('button', {
      class: 'segmented__opt', type: 'button', role: 'tab', 'aria-selected': String(tab === key), 'aria-pressed': String(tab === key),
      onClick: () => { tab = key; paint(); },
    }, `${label} · ${c[key]}`)));
    clear(section).append(views[tab]());
    section.classList.toggle('hide-vi', !prefs.vi);
  };

  const viToggle = (() => {
    const btn = h('button', { class: 'toggle-btn', type: 'button' });
    const draw = () => { btn.setAttribute('aria-pressed', String(prefs.vi)); btn.replaceChildren(prefs.vi ? icons.eye() : icons.eyeOff(), `${prefs.vi ? 'Ẩn' : 'Hiện'} nghĩa bài khóa`); };
    btn.addEventListener('click', () => { prefs.vi = !prefs.vi; writePrefs(prefs); draw(); section.classList.toggle('hide-vi', !prefs.vi); });
    draw();
    return btn;
  })();

  const prev = index.lessons.find((l) => l.number === lesson.number - 1);
  const next = index.lessons.find((l) => l.number === lesson.number + 1);
  append(root, [
    h('nav', { class: 'breadcrumb small', 'aria-label': 'Đường dẫn' },
      h('a', { href: '#/lessons' }, 'Bài học'), ' › ', h('a', { href: '#/coursebook' }, TAB_LABEL), ' › ', h('span', {}, `Bài ${lesson.number}`)),
    h('section', { class: 'lesson-hero' },
      h('span', { class: 'lesson-card__badge' }, `BÀI ${String(lesson.number).padStart(2, '0')}`),
      h('h1', {}, lesson.title_vi),
      h('p', { class: 'lesson-card__zh', lang: 'zh-CN' }, lesson.title_zh),
      h('p', { class: 'muted small' }, lesson.title_en),
      h('div', { class: 'row' }, viToggle)),
    h('div', { class: 'mt-5' }, tabBar), section,
    h('nav', { class: 'row row--between mt-5', 'aria-label': 'Bài trước / sau' },
      prev ? h('a', { class: 'btn btn--ghost', href: `#/coursebook/${prev.number}` }, `← Bài ${prev.number}`) : h('span'),
      next ? h('a', { class: 'btn btn--ghost', href: `#/coursebook/${next.number}` }, `Bài ${next.number} →`) : h('span')),
  ]);
  paint();
  return { destroy() { cancelled = true; stopAudio(); } };
}

export function render(root, { number }) {
  let view = {};
  root.append(h('p', { class: 'muted center' }, 'Đang tải…'));
  (async () => {
    try {
      const index = await fetchJson('index.json');
      clear(root);
      if (!number) { renderIndex(root, index); return; }
      const entry = index.lessons.find((l) => l.number === Number(number));
      if (!entry) { location.replace('#/coursebook'); return; }
      view = renderLesson(root, await fetchJson(entry.file), index);
    } catch {
      clear(root).append(levelTabs(true), h('div', { class: 'empty' }, h('h2', {}, 'Chưa có dữ liệu giáo trình'),
        h('p', { class: 'muted' }, 'Dữ liệu giáo trình chỉ có trên máy đã nhập sách (không đăng lên bản online).')));
    }
  })();
  return { destroy() { view.destroy?.(); } };
}
