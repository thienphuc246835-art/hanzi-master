// Reading & translation (/lesson/:id/read) — đọc bài khóa, dịch Trung→Việt, dịch Việt→Trung
import { h, clear, append } from '../utils/dom.js';
import { shuffle, sample } from '../utils/random.js';
import { playText, stopAudio } from '../utils/audio.js';
import { icons } from '../utils/icons.js';
import { isAcceptedAnswer, diffChars } from '../core/grader.js';
import { recordPractice } from '../core/session.js';
import { state } from '../core/store.js';
import { segmentText, wordTokens, pinyinOf, wordsInText } from '../core/text.js';
import { tokenBuilder } from '../components/exercises/sentence-builder.js';
import { primaryMeaning } from '../components/word-detail.js';

const FALLBACK_MAX_LINES = 24;
const MODES = Object.freeze({ read: 'Đọc', zhvi: 'Dịch Trung → Việt', vizh: 'Dịch Việt → Trung' });
const PREFS_KEY = 'hzm.reading.prefs';

function readPrefs() {
  try { return { pinyin: true, meaning: false, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { pinyin: true, meaning: false }; }
}
function writePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

// Lesson text (bài khóa) if provided, otherwise the lesson words' example sentences
function linesFor(lesson) {
  const text = state.textsByLesson.get(lesson.id);
  if (text) {
    return {
      fromText: true,
      title: text.title_zh ?? lesson.title_zh,
      sections: text.sections.map((s) => ({ heading: s.heading, lines: s.lines.map((l) => ({ ...l, pinyin: l.pinyin ?? pinyinOf(l.zh), auto: !l.pinyin })) })),
    };
  }
  const seen = new Set();
  const lines = [];
  for (const id of lesson.word_ids) {
    const w = state.wordsById.get(id);
    const ex = w?.examples.find((e) => !seen.has(e.zh));
    if (!ex) continue;
    seen.add(ex.zh);
    lines.push({ zh: ex.zh, pinyin: ex.pinyin, vi: ex.vi, focus: w.simplified });
    if (lines.length >= FALLBACK_MAX_LINES) break;
  }
  return { fromText: false, title: lesson.title_zh, sections: [{ heading: 'Câu luyện đọc', lines }] };
}

function zhWithFocus(line) {
  if (!line.focus || !line.zh.includes(line.focus)) return line.zh;
  const i = line.zh.indexOf(line.focus);
  return [line.zh.slice(0, i), h('mark', { class: 'focus-word' }, line.focus), line.zh.slice(i + line.focus.length)];
}

export function render(root, { id }) {
  const lesson = state.lessonsById.get(id);
  if (!lesson) {
    root.append(h('div', { class: 'empty' }, h('h2', {}, 'Không tìm thấy bài học'), h('a', { class: 'btn', href: '#/lessons' }, 'Danh sách bài học')));
    return {};
  }
  const data = linesFor(lesson);
  const allLines = data.sections.flatMap((s) => s.lines);
  const prefs = readPrefs();
  let mode = 'read';
  let cancelled = false;
  let keyHandler = null;
  const stage = h('div', { class: 'stack' });

  const tabs = h('div', { class: 'segmented', role: 'tablist', 'aria-label': 'Chế độ luyện' });
  function renderTabs() {
    tabs.replaceChildren(...Object.entries(MODES).map(([k, label]) => h('button', {
      class: 'segmented__opt', type: 'button', role: 'tab', 'aria-selected': String(k === mode), 'aria-pressed': String(k === mode),
      onClick: () => { mode = k; renderTabs(); show(); },
    }, label)));
  }

  append(root, [
    h('nav', { class: 'breadcrumb small' },
      h('a', { href: '#/lessons' }, 'Bài học'), ' › ',
      h('a', { href: `#/lesson/${lesson.id}` }, `${lesson.label} · ${lesson.title_vi}`), ' › ', h('span', {}, 'Đọc & dịch')),
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', { lang: 'zh-CN', class: 'hanzi' }, data.title),
        h('p', { class: 'page-head__sub' }, `${lesson.title_vi} · ${allLines.length} câu`)),
      tabs),
    data.fromText ? null : h('p', { class: 'notice small' }, 'Bài khóa giáo trình của bài này chưa được thêm — đang dùng câu ví dụ (có audio) của các từ trong bài. Xem README để thêm bài khóa.'),
    stage,
  ]);

  function show() {
    cancelled = true;
    stopAudio();
    keyHandler = null;
    clear(stage);
    if (!allLines.length) { stage.append(h('p', { class: 'muted' }, 'Bài này chưa có câu để luyện.')); return; }
    if (mode === 'read') showReading();
    else showTranslation(mode);
  }

  // ---------- Đọc ----------
  function showReading() {
    const rows = [];
    const toggles = h('div', { class: 'row' },
      h('label', { class: 'switch' }, 'Pinyin', h('input', { type: 'checkbox', role: 'switch', checked: prefs.pinyin, onChange: (e) => { prefs.pinyin = e.target.checked; writePrefs(prefs); stage.classList.toggle('hide-pinyin', !prefs.pinyin); } })),
      h('label', { class: 'switch' }, 'Nghĩa', h('input', { type: 'checkbox', role: 'switch', checked: prefs.meaning, onChange: (e) => { prefs.meaning = e.target.checked; writePrefs(prefs); stage.classList.toggle('hide-meaning', !prefs.meaning); } })),
      h('button', { class: 'btn btn--primary btn--small', type: 'button', onClick: playAll }, icons.play(), 'Nghe cả bài'));
    stage.classList.toggle('hide-pinyin', !prefs.pinyin);
    stage.classList.toggle('hide-meaning', !prefs.meaning);
    stage.append(toggles);
    for (const section of data.sections) {
      if (data.sections.length > 1 || section.heading) stage.append(h('h2', { class: 'card__title mt-4' }, section.heading ?? ''));
      stage.append(h('ol', { class: 'reading' }, section.lines.map((line) => {
        const row = h('li', { class: 'reading__line' },
          h('span', { class: 'reading__speaker' }, line.speaker ?? ''),
          h('div', { class: 'reading__body' },
            h('button', { class: 'reading__zh hanzi', type: 'button', lang: 'zh-CN', onClick: () => playText(line.zh, { rate: state.settings.tts_rate }) },
              segmentText(line.zh).map((t) => (t.word ? h('span', { class: 'reading__word', title: `${t.word.pinyin} — ${primaryMeaning(t.word, 2)}` }, t.text) : t.text))),
            h('div', { class: 'reading__pinyin pinyin' }, line.pinyin, line.auto ? h('span', { class: 'muted small' }, ' (tự sinh)') : null),
            h('div', { class: 'reading__vi' }, line.vi)),
          h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Nghe câu', onClick: () => playText(line.zh, { rate: state.settings.tts_rate }) }, icons.sound()));
        rows.push({ row, line });
        return row;
      })));
    }
    async function playAll() {
      cancelled = false;
      for (const { row, line } of rows) {
        if (cancelled) break;
        row.classList.add('reading__line--active');
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        await playText(line.zh, { rate: state.settings.tts_rate });
        row.classList.remove('reading__line--active');
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }

  // ---------- Dịch ----------
  function showTranslation(direction) {
    const order = shuffle(allLines);
    let i = 0;
    let right = 0;
    const scoreEl = h('span', { class: 'muted small' });
    const box = h('div', { class: 'stack' });
    stage.append(h('div', { class: 'row row--between' }, h('span', { class: 'muted small' }, direction === 'zhvi' ? 'Đọc câu tiếng Trung và dịch sang tiếng Việt, rồi tự so với bản dịch mẫu.' : 'Dịch câu tiếng Việt sang tiếng Trung — ghép từ hoặc tự gõ.'), scoreEl), box);

    const update = () => { scoreEl.textContent = `${Math.min(i + 1, order.length)}/${order.length} · đúng ${right}`; };

    const next = () => {
      i++;
      if (i >= order.length) return finish();
      renderItem();
    };

    const finish = () => {
      keyHandler = null;
      box.replaceChildren(h('div', { class: 'summary anim-pop' },
        h('h2', {}, 'Hoàn thành!'),
        h('p', {}, `Bạn dịch đúng ${right}/${order.length} câu.`),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn btn--primary', type: 'button', onClick: () => show() }, 'Làm lại'),
          h('a', { class: 'btn', href: `#/lesson/${lesson.id}` }, 'Về bài học'))));
    };

    const record = (correct) => recordPractice({ word: null, mode: 'translation', recallLevel: 3, result: { correct } });

    function hints(line) {
      const words = wordsInText(line.zh);
      return h('details', { class: 'small' }, h('summary', { class: 'muted' }, 'Gợi ý từ vựng'),
        h('ul', {}, words.map((w) => h('li', {}, h('span', { class: 'hanzi' }, w.simplified), ` ${w.pinyin} — ${primaryMeaning(w, 2)}`))));
    }

    function renderItem() {
      update();
      const line = order[i];
      if (direction === 'zhvi') {
        const input = h('textarea', {
          class: 'input', rows: 2, placeholder: 'Bản dịch của bạn… (Enter để xem bản mẫu)', 'aria-label': 'Bản dịch tiếng Việt',
          onKeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reveal(); input.blur(); } },
        });
        const footer = h('div', { class: 'stack' });
        const reveal = () => {
          footer.replaceChildren(
            h('div', { class: 'verdict' }, h('span', {}, h('strong', {}, 'Bản dịch mẫu: '), line.vi)),
            h('div', { class: 'row', style: { justifyContent: 'center' } },
              h('button', { class: 'btn', type: 'button', onClick: () => { record(false); next(); } }, 'Chưa đúng ý'),
              h('button', { class: 'btn btn--primary', type: 'button', onClick: () => { right++; record(true); next(); } }, 'Dịch đúng ý')));
          keyHandler = (e) => (e.key === '1' ? (record(false), next(), true) : e.key === '2' ? (right++, record(true), next(), true) : false);
        };
        keyHandler = (e) => (e.key === 'Enter' ? (reveal(), true) : false);
        box.replaceChildren(h('section', { class: 'exercise' },
          h('div', { class: 'row row--between' },
            h('p', { class: 'cloze-sentence', lang: 'zh-CN', style: { textAlign: 'left' } }, zhWithFocus(line)),
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Nghe', onClick: () => playText(line.zh) }, icons.sound())),
          h('p', { class: 'pinyin muted' }, line.pinyin),
          hints(line), input,
          h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn btn--primary', type: 'button', onClick: reveal }, 'Xem bản dịch mẫu ↵')),
          footer));
        playText(line.zh);
        input.focus();
      } else {
        const tokens = wordTokens(line.zh);
        const others = allLines.filter((l) => l !== line).flatMap((l) => wordTokens(l.zh)).filter((t) => !tokens.includes(t));
        const builder = tokenBuilder(tokens, { extra: sample([...new Set(others)], 2) });
        let done = false;
        const footer = h('div', { class: 'stack' });
        const check = () => {
          if (done) return;
          const answer = builder.answer().join('');
          if (!answer) return;
          done = true;
          const ok = isAcceptedAnswer(answer, [line.zh]);
          if (ok) right++;
          record(ok);
          builder.markWrong(tokens);
          footer.replaceChildren(
            h('div', { class: `verdict ${ok ? 'verdict--correct' : 'verdict--wrong'}` }, h('span', { class: 'verdict__text' }, ok ? '✓ Chính xác' : '✗ Chưa đúng')),
            ok ? null : h('p', { class: 'diff', lang: 'zh-CN' }, diffChars(line.zh, answer).map((d) => h('span', { class: `diff__${d.status}` }, d.char))),
            h('p', { class: 'center hanzi', lang: 'zh-CN' }, line.zh), h('p', { class: 'center pinyin muted' }, line.pinyin),
            h('div', { class: 'center' }, h('button', { class: 'btn btn--primary', type: 'button', onClick: next }, 'Câu tiếp ↵')));
          playText(line.zh);
          keyHandler = (e) => (e.key === 'Enter' ? (next(), true) : false);
        };
        keyHandler = (e) => (e.key === 'Enter' ? (check(), true) : false);
        box.replaceChildren(h('section', { class: 'exercise' },
          h('p', { style: { fontSize: '1.2rem', fontWeight: 500 } }, line.vi),
          builder.el,
          h('div', { class: 'row row--between' },
            h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => builder.reset() }, 'Làm lại'),
            h('button', { class: 'btn btn--primary', type: 'button', onClick: check }, 'Kiểm tra ↵')),
          footer));
      }
    }
    renderItem();
  }

  renderTabs();
  show();
  return {
    onKey: (e) => keyHandler?.(e) ?? false,
    destroy() { cancelled = true; stopAudio(); },
  };
}
