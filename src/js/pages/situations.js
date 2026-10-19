// Tình huống giao tiếp (/situations) — hội thoại đời thường, mỗi từ liên kết với từ vựng; chạm câu để nghe
import { h, clear } from '../utils/dom.js';
import { icons } from '../utils/icons.js';
import { playText, stopAudio } from '../utils/audio.js';
import { state } from '../core/store.js';
import { HSK_LEVELS } from '../core/constants.js';
import { openWord } from '../components/word-board.js';
import { primaryMeaning } from '../components/word-detail.js';

const DATA_URL = 'src/js/data/situations.json';
const MAX_WORD_LEN = 6;
const LINE_GAP_MS = 450;
const PREFS_KEY = 'hzm.situations.prefs';

let cache = null;
let wordIndex = null;

async function loadSituations() {
  cache ??= fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error('situations'); return r.json(); });
  return cache;
}

// simplified → entry with the lowest HSK level (words with several readings appear more than once)
export function indexWords() {
  if (wordIndex?.size) return wordIndex;
  wordIndex = new Map();
  for (const w of state.words) {
    const prev = wordIndex.get(w.simplified);
    if (!prev || w.hsk_level < prev.hsk_level) wordIndex.set(w.simplified, w);
  }
  return wordIndex;
}

// Greedy longest-match segmentation against the vocabulary: [{ text, word? }]
export function segment(text, index) {
  const chars = [...text];
  const out = [];
  let i = 0;
  while (i < chars.length) {
    let found = null;
    for (let len = Math.min(MAX_WORD_LEN, chars.length - i); len >= 1 && !found; len--) {
      const w = index.get(chars.slice(i, i + len).join(''));
      if (w) found = { text: w.simplified, word: w, len };
    }
    if (found) { out.push(found); i += found.len; } else { out.push({ text: chars[i] }); i += 1; }
  }
  return out;
}

const levelLabel = (level) => HSK_LEVELS.find((l) => l.level === level)?.label ?? `HSK ${level}`;

function readPrefs() {
  try { return { pinyin: true, vi: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { pinyin: true, vi: true }; }
}
function writePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

function renderList(root, situations) {
  root.append(
    h('header', { class: 'page-head' },
      h('div', {},
        h('h1', {}, 'Tình huống giao tiếp'),
        h('p', { class: 'page-head__sub' }, 'Học từ vựng trong hội thoại đời thường: nghe câu nói tự nhiên, chạm từng từ để xem nghĩa và liên kết với từ vựng đã học.'))),
    h('p', {}, h('a', { class: 'btn btn--small', href: '#/talk' }, '🎙️ Luyện nói với trợ lý')),
    h('div', { class: 'grid grid--2' }, situations.map((s) => h('a', { class: 'card situation-card', href: `#/situations/${s.id}` },
      h('span', { class: 'situation-card__icon', 'aria-hidden': 'true' }, s.icon),
      h('div', {},
        h('h2', { class: 'card__title' }, s.title_vi),
        h('p', { class: 'hanzi', lang: 'zh-CN' }, s.title_zh),
        h('p', { class: 'muted small' }, `${levelLabel(s.level)} · ${s.lines.length} câu thoại`))))));
}

function renderDialogue(root, s) {
  const index = indexWords();
  const prefs = readPrefs();
  let cancelled = false;
  const lineEls = [];
  const used = new Map();

  const wordsOf = (zh) => segment(zh, index).map((seg) => {
    if (!seg.word) return seg.text;
    if (!used.has(seg.text)) used.set(seg.text, seg.word);
    return h('button', { class: 'situation-word', type: 'button', lang: 'zh-CN', title: `${seg.word.pinyin} — ${primaryMeaning(seg.word, 1)}`,
      onClick: (e) => { e.stopPropagation(); openWord(seg.word); } }, seg.text);
  });

  const lines = s.lines.map((line, i) => {
    const el = h('div', { class: `bubble bubble--${line.who === 'A' ? 'left' : 'right'}`, tabindex: '0', role: 'button', 'aria-label': `Nghe câu: ${line.zh}`,
      onClick: () => play(i), onKeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); play(i); } } },
    h('div', { class: 'bubble__zh hanzi', lang: 'zh-CN' }, wordsOf(line.zh)),
    h('div', { class: 'bubble__py pinyin' }, line.py),
    h('div', { class: 'bubble__vi' }, line.vi));
    lineEls.push(el);
    return el;
  });

  async function play(i) {
    lineEls.forEach((el, j) => el.classList.toggle('bubble--playing', j === i));
    await playText(s.lines[i].zh, { rate: state.settings.tts_rate });
    lineEls[i]?.classList.remove('bubble--playing');
  }

  async function playAll() {
    cancelled = false;
    for (let i = 0; i < s.lines.length && !cancelled; i++) {
      await play(i);
      await new Promise((r) => setTimeout(r, LINE_GAP_MS));
    }
  }

  const dialogue = h('div', { class: 'dialogue' }, lines);
  const toggle = (key, label) => {
    const btn = h('button', { class: 'toggle-btn', type: 'button' });
    const paint = () => {
      btn.setAttribute('aria-pressed', String(prefs[key]));
      btn.replaceChildren(prefs[key] ? icons.eye() : icons.eyeOff(), `${prefs[key] ? 'Ẩn' : 'Hiện'} ${label}`);
      dialogue.classList.toggle(`hide-${key}`, !prefs[key]);
    };
    btn.addEventListener('click', () => { prefs[key] = !prefs[key]; writePrefs(prefs); paint(); });
    paint();
    return btn;
  };

  const vocab = [...used.values()].filter((w) => w.hsk_level <= 7);
  root.append(
    h('nav', { class: 'breadcrumb small', 'aria-label': 'Đường dẫn' }, h('a', { href: '#/situations' }, 'Tình huống'), ' › ', h('span', {}, s.title_vi)),
    h('header', { class: 'page-head' },
      h('div', {},
        h('h1', {}, `${s.icon} ${s.title_vi}`),
        h('p', { class: 'page-head__sub hanzi', lang: 'zh-CN' }, `${s.title_zh} · ${levelLabel(s.level)}`)),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn--primary', type: 'button', onClick: playAll }, icons.sound(), 'Nghe cả hội thoại'),
        toggle('pinyin', 'pinyin'), toggle('vi', 'nghĩa'))),
    dialogue,
    h('section', { class: 'card stack mt-5' },
      h('h2', { class: 'card__title' }, 'Nói sao cho tự nhiên'),
      h('ul', { class: 'tips' }, s.tips.map((t) => h('li', {}, t)))),
    h('section', { class: 'mt-5' },
      h('h2', { class: 'card__title' }, `Từ vựng trong tình huống (${vocab.length})`),
      h('div', { class: 'row' }, vocab.map((w) => h('button', { class: 'chip chip--gold', type: 'button', onClick: () => openWord(w) },
        h('span', { class: 'hanzi' }, w.simplified), ` ${w.pinyin} · ${primaryMeaning(w, 1)}`)))));

  return { destroy() { cancelled = true; stopAudio(); } };
}

export function render(root, { id }) {
  let view = {};
  root.append(h('p', { class: 'muted center' }, 'Đang tải…'));
  loadSituations().then((list) => {
    clear(root);
    const s = id && list.find((x) => x.id === id);
    if (id && !s) { location.replace('#/situations'); return; }
    if (s) view = renderDialogue(root, s); else renderList(root, list);
  }).catch(() => {
    clear(root).append(h('div', { class: 'empty' }, h('h2', {}, 'Không tải được dữ liệu tình huống')));
  });
  return { destroy() { view.destroy?.(); } };
}
