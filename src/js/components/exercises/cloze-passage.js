// Mode 6 — Graded cloze passage: refill learned words in a short level-appropriate text
import { h } from '../../utils/dom.js';
import { shuffle } from '../../utils/random.js';
import { bindTooltip } from '../../utils/ui.js';
import { speakWithBeeps, speak, stopSpeaking } from '../../utils/tts.js';
import { makeDraggable } from '../../utils/drag.js';
import { pickDistractors } from '../../core/distractors.js';
import { STATE } from '../../core/constants.js';
import { state } from '../../core/store.js';
import { isCorrectWordAnswer } from './cloze.js';
import { exerciseShell, feedback, primaryButton, now } from './common.js';

const CHARS_PER_BLANK = 10;
const DIFFICULTIES = Object.freeze({ easy: 'Dễ · ngân hàng từ', medium: 'Vừa · 4 lựa chọn', hard: 'Khó · tự gõ' });

export function parsePassage(passage) {
  const segments = [];
  const re = /\{\{([^|}]+)\|([^}]+)\}\}/g;
  let last = 0;
  for (const m of passage.text.matchAll(re)) {
    if (m.index > last) segments.push({ type: 'text', text: passage.text.slice(last, m.index) });
    segments.push({ type: 'marker', id: m[1], surface: m[2] });
    last = m.index + m[0].length;
  }
  if (last < passage.text.length) segments.push({ type: 'text', text: passage.text.slice(last) });
  return segments;
}

export function plainText(segments) {
  return segments.map((s) => (s.type === 'text' ? s.text : s.surface)).join('');
}

// Chỉ đục lỗ từ đã học, ưu tiên thẻ đến hạn & khó; không đặt hai lỗ liền nhau
export function chooseBlanks(segments, { isEligible, priority, charCount }) {
  const maxBlanks = Math.max(1, Math.floor(charCount / CHARS_PER_BLANK));
  const candidates = segments
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.type === 'marker' && isEligible(s.id))
    .sort((a, b) => priority(b.s.id) - priority(a.s.id));
  const chosen = new Set();
  const usedWords = new Set();
  for (const { s, i } of candidates) {
    if (chosen.size >= maxBlanks) break;
    if (usedWords.has(s.id)) continue;
    const adjacent = [i - 1, i + 1].some((j) => chosen.has(j) && segments[j]?.type === 'marker');
    if (adjacent) continue;
    chosen.add(i);
    usedWords.add(s.id);
  }
  return chosen;
}

// Passage with the most blankable learned words
export function choosePassage(passages, isEligible) {
  let best = null;
  let bestCount = 0;
  for (const p of shuffle(passages)) {
    const count = new Set(parsePassage(p).filter((s) => s.type === 'marker' && isEligible(s.id)).map((s) => s.id)).size;
    if (count > bestCount) { best = p; bestCount = count; }
  }
  return bestCount ? best : null;
}

function isLearned(id) {
  const c = state.cards.get(id);
  return !!c && c.state !== STATE.NEW;
}

function renderText(text, glossary) {
  if (!glossary?.length) return text;
  const words = glossary.map((g) => g.word).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text.split(re).map((part) => {
    const g = glossary.find((x) => x.word === part);
    if (!g) return part;
    const el = h('span', { class: 'gloss', tabindex: '0' }, part);
    bindTooltip(el, () => `${g.word} ${g.pinyin} — ${g.vi}`);
    return el;
  });
}

export function create(ctx) {
  const { passage, practice, pool, onDone } = ctx;
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'cloze_passage', title: passage.title });
  const segments = parsePassage(passage);
  const text = plainText(segments);
  const anyLearned = segments.some((s) => s.type === 'marker' && isLearned(s.id));
  const eligible = (id) => state.wordsById.has(id) && (isLearned(id) || (practice && !anyLearned));
  const now0 = new Date();
  const priority = (id) => {
    const c = state.cards.get(id);
    if (!c) return 0;
    const due = new Date(c.due) <= now0 ? 100 : 0;
    return due + c.difficulty;
  };
  const blanks = chooseBlanks(segments, { isEligible: eligible, priority, charCount: [...text].length });
  const blankWords = [...blanks].map((i) => state.wordsById.get(segments[i].id));

  const avgStability = blankWords.reduce((s, w) => s + (state.cards.get(w.id)?.stability ?? 0), 0) / Math.max(1, blankWords.length);
  let difficulty = avgStability < 7 ? 'easy' : avgStability < 21 ? 'medium' : 'hard';
  const startedAt = now();
  let checked = false;
  let listenCancelled = false;
  const answers = new Map(); // segment index → string
  let activeBlank = null;

  const passageEl = h('p', { class: 'passage', lang: 'zh-CN' });
  const bankEl = h('div', { class: 'bank', 'aria-label': 'Ngân hàng từ' });
  const segControl = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': 'Mức độ' });

  function renderSegControl() {
    segControl.replaceChildren(...Object.entries(DIFFICULTIES).map(([key, label]) => h('button', {
      class: 'segmented__opt', type: 'button', role: 'radio', 'aria-checked': String(key === difficulty),
      disabled: checked,
      onClick: () => { difficulty = key; answers.clear(); renderSegControl(); renderPassage(); },
    }, label)));
  }

  function blankButton(i) {
    const value = answers.get(i);
    const btn = h('button', {
      class: `blank${activeBlank === i ? ' blank--active' : ''}`, type: 'button', dataset: { seg: i },
      'aria-label': value ? `Chỗ trống: ${value} — bấm để xoá` : 'Chỗ trống — bấm để chọn',
      onClick: () => {
        if (checked) return;
        if (answers.has(i)) answers.delete(i);
        activeBlank = i;
        renderPassage();
      },
    }, value ?? '   ');
    return btn;
  }

  function blankControl(i) {
    const word = state.wordsById.get(segments[i].id);
    if (difficulty === 'easy') return blankButton(i);
    if (difficulty === 'medium') {
      const options = shuffle([word, ...pickDistractors(word, pool)]);
      const select = h('select', { 'aria-label': 'Chọn từ cho chỗ trống', onChange: (e) => answers.set(i, e.target.value) },
        h('option', { value: '' }, '…'), options.map((o) => h('option', { value: o.simplified }, o.simplified)));
      if (answers.has(i)) select.value = answers.get(i);
      return h('span', { class: 'blank' }, select);
    }
    const input = h('input', {
      type: 'text', autocomplete: 'off', spellcheck: false, size: [...word.simplified].length * 2,
      'aria-label': `Chỗ trống (${[...word.simplified].length} chữ)`, placeholder: '＿'.repeat([...word.simplified].length),
      onInput: (e) => answers.set(i, e.target.value),
    });
    if (answers.has(i)) input.value = answers.get(i);
    return h('span', { class: 'blank' }, input);
  }

  function renderPassage() {
    passageEl.replaceChildren(...segments.flatMap((s, i) => {
      if (s.type === 'text') return renderText(s.text, passage.glossary);
      if (!blanks.has(i)) return s.surface;
      if (!checked) return blankControl(i);
      const word = state.wordsById.get(s.id);
      const ok = isCorrectWordAnswer(word, answers.get(i) ?? '');
      const el = h('span', { class: `blank ${ok ? 'blank--correct' : 'blank--wrong'}`, title: ok ? '' : `Bạn điền: ${answers.get(i) || '—'}` }, s.surface);
      return el;
    }));
    renderBank();
  }

  function fill(value) {
    const target = activeBlank !== null && !answers.has(activeBlank) ? activeBlank : [...blanks].find((i) => !answers.has(i));
    if (target === undefined || target === null) return;
    answers.set(target, value);
    activeBlank = [...blanks].find((i) => !answers.has(i)) ?? null;
    renderPassage();
  }

  function renderBank() {
    bankEl.hidden = difficulty !== 'easy' || checked;
    if (bankEl.hidden) return;
    const used = [...answers.values()];
    bankEl.replaceChildren(...shuffleOnce().map((w) => {
      const isUsed = used.includes(w.simplified);
      const btn = h('button', { class: `token${isUsed ? ' token--used' : ''}`, type: 'button', lang: 'zh-CN' }, w.simplified);
      makeDraggable(btn, {
        dropSelector: '.passage .blank',
        onTap: () => fill(w.simplified),
        onDrop: (target) => {
          const seg = Number(target.dataset.seg);
          if (Number.isFinite(seg)) { answers.set(seg, w.simplified); renderPassage(); }
        },
      });
      return btn;
    }));
  }

  let bankOrder = null;
  const shuffleOnce = () => (bankOrder ??= shuffle(blankWords));

  function check() {
    if (checked) return;
    checked = true;
    stopSpeaking();
    listenCancelled = true;
    renderSegControl();
    renderPassage();
    const perWord = [...blanks].map((i) => {
      const word = state.wordsById.get(segments[i].id);
      return { wordId: word.id, correct: isCorrectWordAnswer(word, answers.get(i) ?? '') };
    });
    const right = perWord.filter((r) => r.correct).length;
    footer.replaceChildren(
      feedback(right === perWord.length, `${right}/${perWord.length} chỗ trống đúng`),
      renderQuestions(),
      h('details', {}, h('summary', { class: 'muted small' }, 'Bản dịch tiếng Việt'), h('p', {}, passage.translation_vi), h('p', { class: 'pinyin muted small' }, passage.pinyin)),
    );
    onDone({ perWord, correct: right === perWord.length, responseMs: (now() - startedAt) / Math.max(1, perWord.length), difficulty });
  }

  function renderQuestions() {
    if (!passage.questions?.length) return null;
    return h('div', { class: 'stack' }, h('h3', {}, 'Câu hỏi đọc hiểu'),
      passage.questions.map((q) => {
        const resultEl = h('span', { class: 'small', role: 'status' });
        const choose = (value, btns, btn) => {
          btns.forEach((b) => { b.disabled = true; });
          const ok = value === q.answer;
          btn.classList.add(ok ? 'option--correct' : 'option--wrong');
          resultEl.textContent = ok ? ' ✓' : ' ✗';
        };
        const opts = q.type === 'true_false'
          ? [['Đúng', true], ['Sai', false]]
          : q.options.map((o, idx) => [o, idx]);
        const btns = opts.map(([label, value]) => {
          const btn = h('button', { class: 'option', type: 'button', lang: q.type === 'true_false' ? null : 'zh-CN', onClick: () => choose(value, btns, btn) }, label);
          return btn;
        });
        return h('div', { class: 'stack' },
          h('p', {}, h('span', { class: 'hanzi', lang: 'zh-CN' }, q.zh), resultEl, q.vi ? h('span', { class: 'muted small' }, ` — ${q.vi}`) : null),
          h('div', { class: 'options' }, btns));
      }));
  }

  function listenWithBeeps() {
    listenCancelled = false;
    const parts = [];
    let buf = '';
    segments.forEach((s, i) => {
      if (blanks.has(i) && !checked) { parts.push(buf); buf = ''; parts.push(null); }
      else buf += s.type === 'text' ? s.text : s.surface;
    });
    parts.push(buf);
    speakWithBeeps(parts, { rate: state.settings.tts_rate, isCancelled: () => listenCancelled });
  }

  renderSegControl();
  renderPassage();
  body.append(
    h('p', { class: 'passage__title', lang: 'zh-CN' }, passage.title),
    h('div', { class: 'row row--between' }, segControl,
      h('div', { class: 'row' },
        state.capabilities.tts ? h('button', { class: 'icon-btn', type: 'button', onClick: listenWithBeeps }, '🎧 Nghe bài đục lỗ') : null,
        state.capabilities.tts ? h('button', { class: 'icon-btn', type: 'button', onClick: () => speak(text, { rate: state.settings.tts_rate }) }, '🔊 Cả bài') : null)),
    passageEl,
    bankEl,
  );
  footer.append(h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, primaryButton('Kiểm tra', check)));

  return {
    el: root,
    destroy: () => { listenCancelled = true; stopSpeaking(); },
    blankCount: blanks.size,
  };
}
