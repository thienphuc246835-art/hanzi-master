// Handwriting sheets (/writing) — pick words, preview A4 practice pages, print / save as PDF or PNG
import { h, clear } from '../utils/dom.js';
import { toast } from '../utils/ui.js';
import { strokeDataLoader } from '../utils/strokes.js';
import { buildPages, uniqueChars, SHEET } from '../utils/writing-sheet.js';
import { HSK_LEVELS, STATE } from '../core/constants.js';
import { state, isFavorite } from '../core/store.js';
import { matchesQuery } from '../components/word-board.js';

const SEL_KEY = 'hzm.writing.sel';
const OPT_KEY = 'hzm.writing.opts';
const MAX_LIST = 200;
const PNG_SCALE = 3;

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

const loadStroke = (ch) => new Promise((resolve) => strokeDataLoader(ch, resolve, () => resolve(null)));

// Selection keys: a word id, or "c:字" for characters typed in by hand
const keyText = (key) => (key.startsWith('c:') ? key.slice(2) : state.wordsById.get(key)?.simplified ?? '');

function svgToPngBlob(svgText) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = SHEET.width * PNG_SCALE;
      canvas.height = SHEET.height * PNG_SCALE;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('svg')); };
    img.src = url;
  });
}

function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function render(root, { lessonId }) {
  let selection = readJson(SEL_KEY, []).filter((k) => k.startsWith('c:') || state.wordsById.has(k));
  const opts = { guides: true, ghostCells: true, ...readJson(OPT_KEY, {}) };
  let level = 1;
  let lesson = null;
  let query = '';
  let pages = [];
  let renderToken = 0;

  const startLesson = lessonId && state.lessonsById.get(lessonId);
  if (startLesson) {
    level = startLesson.level;
    lesson = startLesson;
    selection = [...new Set([...selection, ...startLesson.word_ids])];
  }

  const save = () => writeJson(SEL_KEY, selection);
  const lessonsOfLevel = () => state.lessons.filter((l) => l.level === level);
  const lessonWords = () => (lesson ? lesson.word_ids.map((id) => state.wordsById.get(id)).filter(Boolean) : []);

  const levelSelect = h('select', { class: 'select', 'aria-label': 'Cấp HSK', onChange: (e) => { level = Number(e.target.value); lesson = lessonsOfLevel()[0] ?? null; paintLessonSelect(); paintWords(); } },
    HSK_LEVELS.map((l) => h('option', { value: String(l.level) }, l.label)));
  const lessonSelect = h('select', { class: 'select', 'aria-label': 'Bài học', onChange: (e) => { lesson = state.lessonsById.get(e.target.value) ?? null; paintWords(); } });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Tìm hanzi, pinyin, nghĩa…', 'aria-label': 'Tìm từ', onInput: (e) => { query = e.target.value; paintWords(); } });
  const wordList = h('div', { class: 'writing-words', lang: 'zh-CN' });
  const tray = h('div', { class: 'writing-tray', lang: 'zh-CN', 'aria-live': 'polite' });
  const summary = h('p', { class: 'muted small' });
  const preview = h('div', { class: 'sheet-preview', 'aria-live': 'polite' });
  const freeInput = h('input', { class: 'input', type: 'text', lang: 'zh-CN', placeholder: 'Gõ hoặc dán chữ Hán…', 'aria-label': 'Thêm chữ Hán tự nhập' });
  const btnPrint = h('button', { class: 'btn btn--primary', type: 'button', onClick: () => window.print() }, 'In / Lưu PDF');
  const btnPng = h('button', { class: 'btn', type: 'button', onClick: downloadPng }, 'Tải ảnh PNG');

  function paintLessonSelect() {
    levelSelect.value = String(level);
    lessonSelect.replaceChildren(...lessonsOfLevel().map((l) => h('option', { value: l.id }, `${l.label} — ${l.title_vi}`)));
    if (lesson) lessonSelect.value = lesson.id;
  }

  function toggleKey(key) {
    const i = selection.indexOf(key);
    if (i >= 0) selection.splice(i, 1); else selection.push(key);
    changed();
  }

  function addKeys(keys) {
    const have = new Set(selection);
    keys.forEach((k) => { if (!have.has(k)) selection.push(k); });
    changed();
  }

  function paintWords() {
    const words = lessonWords().filter((w) => matchesQuery(w, query));
    const picked = new Set(selection);
    clear(wordList);
    if (!words.length) { wordList.append(h('p', { class: 'muted' }, 'Không có từ phù hợp.')); return; }
    words.slice(0, MAX_LIST).forEach((w) => wordList.append(h('button', {
      class: 'writing-word', type: 'button', 'aria-pressed': String(picked.has(w.id)), title: `${w.pinyin} — ${w.meanings[0]?.vi ?? ''}`,
      onClick: (e) => { toggleKey(w.id); e.currentTarget.setAttribute('aria-pressed', String(selection.includes(w.id))); },
    }, h('span', { class: 'writing-word__zh' }, w.simplified), h('span', { class: 'writing-word__py small muted' }, w.pinyin))));
  }

  function paintTray() {
    clear(tray);
    if (!selection.length) { tray.append(h('p', { class: 'muted' }, 'Chưa chọn từ nào. Bấm vào từ bên trên để thêm.')); return; }
    selection.forEach((k) => tray.append(h('button', {
      class: 'chip writing-chip', type: 'button', 'aria-label': `Bỏ ${keyText(k)}`, onClick: () => { toggleKey(k); paintWords(); },
    }, keyText(k), ' ×')));
  }

  function changed() {
    save();
    paintTray();
    schedulePreview();
  }

  let previewTimer = null;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(paintPreview, 250);
  }

  async function paintPreview() {
    const token = ++renderToken;
    const chars = uniqueChars(selection.map(keyText));
    const hasChars = chars.length > 0;
    btnPrint.disabled = btnPng.disabled = !hasChars;
    if (!hasChars) {
      pages = [];
      summary.textContent = '';
      clear(preview).append(h('p', { class: 'muted center' }, 'Chọn từ để xem trước trang tập viết.'));
      return;
    }
    summary.textContent = `${selection.length} từ · ${chars.length} chữ Hán · ${Math.ceil(chars.length / SHEET.charsPerPage)} trang A4`;
    const data = await Promise.all(chars.map(loadStroke));
    if (token !== renderToken) return;
    const items = chars.map((char, i) => ({ char, data: data[i] }));
    pages = buildPages(items, { ...opts, title: startLabel() });
    preview.innerHTML = pages.map((p) => `<div class="sheet-wrap">${p}</div>`).join('');
  }

  // Title printed on the sheet: the lesson when the selection is exactly that lesson's words
  function startLabel() {
    const ids = new Set(selection);
    return lesson && ids.size === lesson.word_ids.length && lesson.word_ids.every((id) => ids.has(id)) ? lesson.label : '';
  }

  async function downloadPng() {
    if (!pages.length) return;
    btnPng.disabled = true;
    try {
      for (let i = 0; i < pages.length; i++) {
        download(await svgToPngBlob(pages[i]), `tap-viet-${i + 1}.png`);
        await new Promise((r) => setTimeout(r, 300));
      }
      toast(`Đã tải ${pages.length} trang`);
    } catch {
      toast('Không tạo được ảnh — hãy dùng In / Lưu PDF');
    } finally {
      btnPng.disabled = false;
    }
  }

  const optionBox = (key, label) => h('label', { class: 'row small' },
    h('input', { type: 'checkbox', checked: opts[key], onChange: (e) => { opts[key] = e.target.checked; writeJson(OPT_KEY, opts); schedulePreview(); } }), label);

  const quick = (label, fn) => h('button', { class: 'btn btn--small', type: 'button', onClick: () => { fn(); paintWords(); } }, label);

  root.append(
    h('header', { class: 'page-head writing-controls' },
      h('div', {},
        h('h1', {}, 'Tập viết chữ Hán'),
        h('p', { class: 'page-head__sub' }, 'Chọn từ, tạo trang tập viết A4 (mẫu → nét hiện dần → tô theo → viết tự do) rồi in hoặc lưu PDF.'))),
    h('div', { class: 'grid grid--2 writing-controls' },
      h('section', { class: 'card stack' },
        h('h2', { class: 'card__title' }, '1. Chọn từ'),
        h('div', { class: 'row' }, levelSelect, lessonSelect),
        h('div', { class: 'row' },
          quick('Chọn cả bài', () => addKeys(lessonWords().map((w) => w.id))),
          quick('Bỏ chọn bài', () => { const ids = new Set(lesson?.word_ids ?? []); selection = selection.filter((k) => !ids.has(k)); changed(); })),
        search,
        wordList,
        h('div', { class: 'row' },
          quick('+ Từ yêu thích', () => addKeys(state.words.filter((w) => isFavorite(w.id)).map((w) => w.id))),
          quick('+ Từ đã học', () => addKeys(state.words.filter((w) => { const c = state.cards.get(w.id); return c && c.state !== STATE.NEW; }).map((w) => w.id)))),
        h('form', { class: 'row', onSubmit: (e) => { e.preventDefault(); addKeys(uniqueChars([freeInput.value]).map((c) => `c:${c}`)); freeInput.value = ''; } },
          freeInput, h('button', { class: 'btn btn--small', type: 'submit' }, 'Thêm'))),
      h('section', { class: 'card stack' },
        h('h2', { class: 'card__title' }, '2. Từ đã chọn'),
        tray,
        h('div', { class: 'row' },
          h('button', { class: 'btn btn--small btn--ghost', type: 'button', onClick: () => { selection = []; changed(); paintWords(); } }, 'Xóa hết')),
        h('h2', { class: 'card__title' }, '3. Tuỳ chọn & tải xuống'),
        optionBox('guides', 'Đường kẻ chữ thập trong ô'),
        optionBox('ghostCells', 'Hàng chữ mờ để tô theo'),
        summary,
        h('div', { class: 'row' }, btnPrint, btnPng),
        h('p', { class: 'muted small' }, 'Mỗi chữ Hán một khối 3 hàng; từ nhiều chữ được tách thành từng chữ, chữ trùng chỉ in một lần. Khi in, chọn khổ A4, lề "Không có", tắt "Đầu trang và chân trang".'))),
    h('div', { class: 'mt-5' }, preview));

  lesson ??= lessonsOfLevel()[0] ?? null;
  paintLessonSelect();
  paintWords();
  paintTray();
  paintPreview();
  return { destroy() { renderToken++; clearTimeout(previewTimer); } };
}
