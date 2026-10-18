// Vocabulary board (layout from vdue.png): tone-coloured cards, pinyin / meaning toggles,
// search, learned filter, grid/list view
import { h, clear } from '../utils/dom.js';
import { openModal } from '../utils/ui.js';
import { icons } from '../utils/icons.js';
import { normalizePinyin, stripTones, TONE_NAMES } from '../utils/pinyin.js';
import { STATE } from '../core/constants.js';
import { state, isFavorite, toggleFavorite } from '../core/store.js';
import { tonedPinyin, primaryMeaning, renderWordDetail, speakWord } from './word-detail.js';

const PREFS_KEY = 'hzm.board.prefs';
const TONE_MARK = Object.freeze({ 1: 'ˉ', 2: 'ˊ', 3: 'ˇ', 4: 'ˋ' });
const FILTERS = Object.freeze({ all: 'Tất cả', new: 'Chưa học', learned: 'Đã học' });

function readPrefs() {
  try { return { pinyin: false, meaning: false, view: 'grid', ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { pinyin: false, meaning: false, view: 'grid' }; }
}
function writePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function isLearned(word) {
  const c = state.cards.get(word.id);
  return !!c && c.state !== STATE.NEW;
}

export function matchesQuery(word, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qPinyin = normalizePinyin(q);
  return word.simplified.includes(q) ||
    (word.traditional ?? '').includes(q) ||
    (qPinyin && normalizePinyin(word.pinyin).includes(qPinyin)) ||
    word.meanings.some((m) => m.vi.toLowerCase().includes(q)) ||
    stripTones(word.han_viet.toLowerCase()).includes(stripTones(q));
}

// Colour of the first syllable's tone (1–4, 5 = neutral)
export function firstTone(word) {
  return word.pinyin_tones?.[0] ?? 5;
}

function heartIcon(filled) {
  const el = icons.heart();
  if (filled) el.setAttribute('fill', 'currentColor');
  return el;
}

export function wordCard(word, { onOpen } = {}) {
  const learned = isLearned(word);
  const fav = isFavorite(word.id);
  const heart = h('button', {
    class: `word-card__fav${fav ? ' word-card__fav--on' : ''}`, type: 'button', 'aria-pressed': String(fav), 'aria-label': 'Đánh dấu yêu thích',
    onClick: (e) => {
      e.stopPropagation();
      const on = toggleFavorite(word.id);
      heart.classList.toggle('word-card__fav--on', on);
      heart.setAttribute('aria-pressed', String(on));
      heart.replaceChildren(heartIcon(on));
    },
  }, heartIcon(fav));
  return h('article', {
    class: 'word-card', dataset: { tone: firstTone(word), word: word.id }, tabindex: '0', role: 'button',
    'aria-label': `${word.simplified} — xem chi tiết`,
    onClick: () => onOpen?.(word),
    onKeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); onOpen?.(word); } },
  },
  learned ? h('span', { class: 'word-card__check', title: 'Đã học' }, icons.check()) : null,
  h('button', {
    class: 'word-card__sound', type: 'button', 'aria-label': `Phát âm ${word.simplified}`,
    onClick: (e) => { e.stopPropagation(); speakWord(word.simplified); },
  }, icons.sound()),
  h('div', { class: 'word-card__hanzi', lang: 'zh-CN' }, word.simplified),
  h('div', { class: 'word-card__pinyin' }, tonedPinyin(word)),
  h('div', { class: 'word-card__meaning' }, primaryMeaning(word, 2)),
  heart);
}

function wordListRow(word, { onOpen } = {}) {
  return h('div', { class: 'word-line', dataset: { tone: firstTone(word) } },
    h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Phát âm ${word.simplified}`, onClick: () => speakWord(word.simplified) }, icons.sound()),
    h('button', { class: 'word-line__hanzi link-btn', type: 'button', lang: 'zh-CN', onClick: () => onOpen?.(word) }, word.simplified),
    h('span', { class: 'word-card__pinyin' }, tonedPinyin(word), h('span', { class: 'muted small' }, ` · ${word.han_viet}`)),
    h('span', { class: 'word-card__meaning' }, primaryMeaning(word)),
    isLearned(word) ? h('span', { class: 'word-card__check word-card__check--inline', title: 'Đã học' }, icons.check()) : h('span'));
}

export function openWord(word) {
  openModal(renderWordDetail(word), { label: `Chi tiết từ ${word.simplified}` });
}

export function toneLegend() {
  return h('p', { class: 'tone-legend small' },
    h('span', { class: 'tone-legend__title' }, 'Màu thanh điệu:'),
    [1, 2, 3, 4].map((t) => h('span', {}, h('span', { class: 'tone-dot', dataset: { tone: t } }), `Thanh ${t} (${TONE_MARK[t]})`)),
    h('span', {}, h('span', { class: 'tone-dot', dataset: { tone: 5 } }), 'Thanh nhẹ'));
}

// Toggle buttons shared by the lesson board and the dictionary
export function displayToggles(target, prefs, onChange) {
  const toggle = (key, label) => {
    const btn = h('button', { class: 'toggle-btn', type: 'button' });
    const paint = () => {
      btn.setAttribute('aria-pressed', String(prefs[key]));
      btn.replaceChildren(prefs[key] ? icons.eye() : icons.eyeOff(), `${prefs[key] ? 'Ẩn' : 'Hiện'} ${label}`);
      target.classList.toggle(`show-${key}`, prefs[key]);
    };
    btn.addEventListener('click', () => { prefs[key] = !prefs[key]; writePrefs(prefs); paint(); onChange?.(); });
    paint();
    return btn;
  };
  return [toggle('pinyin', 'pinyin'), toggle('meaning', 'nghĩa')];
}

export function viewToggle(prefs, onChange) {
  const btn = (v, label, icon) => h('button', {
    class: 'segmented__opt', type: 'button', 'aria-pressed': String(prefs.view === v), 'aria-label': label,
    onClick: (e) => {
      prefs.view = v;
      writePrefs(prefs);
      e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
      onChange();
    },
  }, icon());
  return h('div', { class: 'segmented', role: 'group', 'aria-label': 'Kiểu hiển thị' }, btn('grid', 'Dạng lưới', icons.grid), btn('list', 'Dạng danh sách', icons.list));
}

export function renderWords(container, words, view, { onOpen = openWord } = {}) {
  clear(container);
  container.append(view === 'list'
    ? h('div', { class: 'word-lines' }, words.map((w) => wordListRow(w, { onOpen })))
    : h('div', { class: 'word-board' }, words.map((w) => wordCard(w, { onOpen }))));
}

export { readPrefs as readBoardPrefs };

// Full board with its own toolbar (lesson page)
export function wordBoard(words) {
  const prefs = readPrefs();
  let query = '';
  let filter = 'all';
  const results = h('div', { 'aria-live': 'polite' });
  const root = h('div', { class: 'board' });
  const counts = () => ({ all: words.length, new: words.filter((w) => !isLearned(w)).length, learned: words.filter(isLearned).length });

  const filterGroup = h('div', { class: 'segmented segmented--dark', role: 'radiogroup', 'aria-label': 'Lọc từ' });
  const renderFilters = () => {
    const c = counts();
    filterGroup.replaceChildren(...Object.entries(FILTERS).map(([key, label]) => h('button', {
      class: 'segmented__opt', type: 'button', role: 'radio', 'aria-checked': String(filter === key),
      onClick: () => { filter = key; renderFilters(); update(); },
    }, `${label} · ${c[key]}`)));
  };

  function update() {
    const list = words.filter((w) => matchesQuery(w, query) &&
      (filter === 'all' || (filter === 'learned') === isLearned(w)));
    if (!list.length) {
      clear(results).append(h('p', { class: 'muted center' }, 'Không có từ phù hợp.'));
      return;
    }
    renderWords(results, list, prefs.view);
  }

  root.append(
    h('div', { class: 'board__toolbar' },
      h('label', { class: 'board__search' }, icons.search(),
        h('input', { type: 'search', placeholder: 'Tìm hanzi, pinyin, nghĩa…', 'aria-label': 'Tìm từ trong bài', onInput: (e) => { query = e.target.value; update(); } })),
      filterGroup,
      ...displayToggles(root, prefs),
      viewToggle(prefs, update)),
    toneLegend(),
    results);
  renderFilters();
  update();
  return root;
}
