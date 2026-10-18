// Shared building blocks for exercise modes
import { h } from '../../utils/dom.js';
import { MODES, RECALL_LEVEL_LABELS } from '../../core/constants.js';
import { speakWord, tonedPinyin, primaryMeaning } from '../word-detail.js';
import { vibrate } from '../../utils/ui.js';

export function exerciseShell({ mode, recallLevel, practice = false, title }) {
  const def = MODES[mode];
  const body = h('div', { class: 'stack' });
  const footer = h('div', { class: 'exercise__footer' });
  const root = h('section', { class: 'exercise anim-slide-in', 'aria-label': def.name },
    h('div', { class: 'exercise__mode' },
      h('span', {}, title ?? def.name),
      h('span', {}, `${RECALL_LEVEL_LABELS[recallLevel] ?? ''}${practice ? ' · Luyện thêm' : ''}`)),
    body, footer);
  return { root, body, footer };
}

// Grid of answer buttons with 1–4 keyboard shortcuts
export function optionGrid(options, { render, hanzi = false, oneColumn = false, onPick }) {
  let locked = false;
  const buttons = options.map((opt, i) => h('button', {
    class: `option${hanzi ? ' option--hanzi' : ''}`, type: 'button',
    lang: hanzi ? 'zh-CN' : null,
    onClick: () => pick(i),
  }, h('span', { class: 'option__key', 'aria-hidden': 'true' }, i + 1), render(opt)));
  const el = h('div', { class: `options${oneColumn ? ' options--1col' : ''}`, role: 'group' }, buttons);

  function pick(i) {
    if (locked || !buttons[i]) return;
    onPick(i);
  }

  function lock(correctIdx, chosenIdx) {
    locked = true;
    buttons.forEach((b) => { b.disabled = true; });
    if (correctIdx >= 0) buttons[correctIdx].classList.add('option--correct');
    if (chosenIdx !== correctIdx && chosenIdx >= 0) {
      buttons[chosenIdx].classList.add('option--wrong');
      vibrate([10, 40, 10]);
    } else vibrate(10);
  }

  function onKey(e) {
    const n = Number(e.key);
    if (n >= 1 && n <= options.length) { pick(n - 1); return true; }
    return false;
  }

  return { el, buttons, lock, onKey, isLocked: () => locked };
}

// 10-second pressure timer (Mode 5)
export function countdown(ms, onTimeout) {
  const fill = h('div', { class: 'timer__fill', style: { animation: `timer ${ms}ms linear forwards` } });
  const el = h('div', { class: 'timer', role: 'timer', 'aria-label': `${ms / 1000} giây` }, fill);
  const id = setTimeout(onTimeout, ms);
  return {
    el,
    stop() {
      clearTimeout(id);
      fill.style.animationPlayState = 'paused';
    },
  };
}

export function feedback(correct, ...content) {
  return h('div', { class: `verdict ${correct ? 'verdict--correct' : 'verdict--wrong'} anim-pop`, role: 'status' },
    h('span', { class: 'verdict__text' }, correct ? '✓ Chính xác' : '✗ Chưa đúng'),
    h('span', { class: 'small' }, ...content));
}

export function answerReveal(word) {
  return h('div', { class: 'center stack', style: { gap: '0.25rem' } },
    h('div', { class: 'hanzi', style: { fontSize: 'var(--size-hanzi-md)' }, lang: 'zh-CN' }, word.simplified),
    tonedPinyin(word, 'pinyin flashcard__pinyin'),
    h('div', {}, primaryMeaning(word)),
    h('div', { class: 'muted small' }, `💡 ${word.mnemonic_summary.hint_short}`));
}

export function sentenceReveal(example) {
  return h('div', { class: 'center stack', style: { gap: '0.25rem' } },
    h('div', { class: 'hanzi', style: { fontSize: '1.3rem' }, lang: 'zh-CN' }, example.zh),
    h('div', { class: 'pinyin', style: { color: 'var(--color-accent-gold)' } }, example.pinyin),
    h('div', { class: 'muted' }, example.vi));
}

export function speakButton(text, label = '🔊 Nghe', { rate } = {}) {
  return h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => speakWord(text, rate) }, label);
}

export function primaryButton(label, onClick) {
  return h('button', { class: 'btn btn--primary', type: 'button', onClick }, label);
}

export function splitAround(text, target) {
  const idx = text.indexOf(target);
  if (idx < 0) return [text, ''];
  return [text.slice(0, idx), text.slice(idx + target.length)];
}

export function tokensOf(example) {
  return example.seg.trim().split(/\s+/);
}

export const now = () => performance.now();
