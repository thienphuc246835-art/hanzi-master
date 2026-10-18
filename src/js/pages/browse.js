// Dictionary browser (/browse) — tone-coloured word cards, pinyin/meaning toggles,
// filters by HSK level/band/radical/favourites, sort, paging
import { h, clear } from '../utils/dom.js';
import { normalizePinyin } from '../utils/pinyin.js';
import { HSK_LEVELS, HSK_BANDS } from '../core/constants.js';
import { state, isFavorite } from '../core/store.js';
import {
  matchesQuery, renderWords, displayToggles, viewToggle, toneLegend, readBoardPrefs,
} from '../components/word-board.js';

const PAGE_SIZE = 120;
const SORTS = Object.freeze({
  hsk: 'Thứ tự bài học',
  frequency: 'Tần suất xuất hiện',
  alpha: 'Pinyin A→Z',
});

export function render(root) {
  const prefs = readBoardPrefs();
  const filters = { query: '', level: 'all', band: 'all', radical: 'all', sort: 'hsk', favorites: false };
  const results = h('div', { 'aria-live': 'polite' });
  const countEl = h('span', { class: 'muted small' });
  const board = h('div', { class: 'board' });

  const radicalsInData = [...new Map(state.words.flatMap((w) => (w.characters ?? []).filter((c) => c.radical.kangxi_no).map((c) => [c.radical.kangxi_no, c.radical]))).values()]
    .sort((a, b) => a.kangxi_no - b.kangxi_no);

  const select = (label, options, key) => h('select', {
    class: 'select', 'aria-label': label,
    onChange: (e) => { filters[key] = e.target.value; update(); },
  }, options.map(([value, text]) => h('option', { value }, text)));

  const favBtn = h('button', {
    class: 'toggle-btn', type: 'button', 'aria-pressed': 'false',
    onClick: () => { filters.favorites = !filters.favorites; favBtn.setAttribute('aria-pressed', String(filters.favorites)); update(); },
  }, '♥ Yêu thích');

  board.append(
    h('div', { class: 'board__toolbar', role: 'search' },
      h('input', {
        class: 'input', type: 'search', placeholder: 'Tìm hanzi, pinyin, nghĩa, âm Hán Việt…', 'aria-label': 'Tìm kiếm', style: { flex: '1 1 260px', width: 'auto' },
        onInput: (e) => { filters.query = e.target.value; update(); },
      }),
      ...displayToggles(board, prefs),
      favBtn,
      viewToggle(prefs, () => update())),
    h('div', { class: 'toolbar' },
      select('Cấp HSK', [['all', 'Mọi cấp'], ...HSK_LEVELS.map((l) => [String(l.level), l.label])], 'level'),
      select('Giai đoạn', [['all', 'Mọi giai đoạn'], ...Object.entries(HSK_BANDS)], 'band'),
      select('Bộ thủ', [['all', 'Mọi bộ thủ'], ...radicalsInData.map((r) => [String(r.kangxi_no), `${r.char} ${r.name_vi} (#${r.kangxi_no})`])], 'radical'),
      select('Sắp xếp', Object.entries(SORTS), 'sort')),
    toneLegend(),
    results);

  root.append(
    h('div', { class: 'page-head' },
      h('div', {}, h('h1', {}, 'Từ điển HSK 3.0'), h('p', { class: 'page-head__sub' }, `${state.words.length.toLocaleString('vi-VN')} từ · chuẩn GF 0025-2021`)),
      countEl),
    board,
  );

  function update() {
    let list = state.words.filter((w) => matchesQuery(w, filters.query) &&
      (filters.level === 'all' || String(w.hsk_level) === filters.level) &&
      (filters.band === 'all' || w.hsk_band === filters.band) &&
      (filters.radical === 'all' || w.characters?.some((c) => String(c.radical.kangxi_no) === filters.radical)) &&
      (!filters.favorites || isFavorite(w.id)));
    const sorters = {
      hsk: (a, b) => a.hsk_level - b.hsk_level || (a.order ?? 1e9) - (b.order ?? 1e9),
      frequency: (a, b) => (a.frequency_rank ?? 1e9) - (b.frequency_rank ?? 1e9),
      alpha: (a, b) => normalizePinyin(a.pinyin).localeCompare(normalizePinyin(b.pinyin)),
    };
    list = list.sort(sorters[filters.sort]);
    countEl.textContent = `${list.length.toLocaleString('vi-VN')} kết quả`;
    if (!list.length) {
      clear(results).append(h('div', { class: 'empty' }, h('span', { class: 'empty__hanzi', 'aria-hidden': 'true' }, '无'), h('p', {}, 'Không tìm thấy từ phù hợp.')));
      return;
    }
    renderPage(list, PAGE_SIZE);
  }

  // 11k words: render in pages to keep the DOM light
  function renderPage(list, limit) {
    renderWords(results, list.slice(0, limit), prefs.view);
    if (list.length > limit) {
      results.append(h('div', { class: 'center mt-5' }, h('button', {
        class: 'btn', type: 'button', onClick: () => renderPage(list, limit + PAGE_SIZE),
      }, `Xem thêm (${(list.length - limit).toLocaleString('vi-VN')} từ nữa)`)));
    }
  }

  update();
  return {};
}
