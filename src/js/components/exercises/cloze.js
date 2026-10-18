// Mode 3 — Cloze deletion: fill the word back into a graded example sentence
import { h } from '../../utils/dom.js';
import { shuffle, pickOne } from '../../utils/random.js';
import { normalizePinyin } from '../../utils/pinyin.js';
import { pickDistractors } from '../../core/distractors.js';
import { exampleTierFor } from '../../core/exercise-picker.js';
import { exerciseShell, optionGrid, feedback, sentenceReveal, splitAround, primaryButton, now } from './common.js';

export function isCorrectWordAnswer(word, answer) {
  const a = answer.trim();
  if (!a) return false;
  return a === word.simplified || normalizePinyin(a) === normalizePinyin(word.pinyin);
}

export function create(ctx) {
  const { word, card, pool, recallLevel, practice, onDone } = ctx;
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'cloze' });
  const tier = practice ? pickOne([1, 2, 3]) : exampleTierFor(card);
  const example = word.examples.find((e) => e.tier === tier) ?? word.examples[0];
  const [before, after] = splitAround(example.zh, word.simplified);
  const blank = h('span', { class: 'blank blank--active' }, ' '.repeat(2));
  const startedAt = now();
  let usedHint = false;
  let answered = false;
  let grid = null;
  let input = null;

  const finish = (correct, shown) => {
    if (answered) return;
    answered = true;
    blank.textContent = word.simplified;
    blank.classList.remove('blank--active');
    blank.classList.add(correct ? 'blank--correct' : 'blank--wrong');
    footer.replaceChildren(feedback(correct, correct ? '' : `Bạn chọn: ${shown || '—'} · Đáp án: ${word.simplified} (${word.pinyin})`), sentenceReveal(example));
    onDone({ correct, usedHint, responseMs: now() - startedAt });
  };

  body.append(
    h('p', { class: 'exercise__prompt' }, `Điền từ còn thiếu · ví dụ tầng ${example.tier}`),
    h('p', { class: 'cloze-sentence', lang: 'zh-CN' }, before, blank, after),
    h('p', { class: 'center muted' }, example.vi),
  );

  if (recallLevel >= 3) {
    // Tự tạo: gõ chữ Hán hoặc pinyin, chỉ biết số chữ
    input = h('input', {
      class: 'input input--hanzi', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: false,
      'aria-label': `Nhập từ còn thiếu (${[...word.simplified].length} chữ) bằng chữ Hán hoặc pinyin`,
      placeholder: `${[...word.simplified].length} chữ · Hán tự hoặc pinyin`,
      onKeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } },
    });
    const hintBtn = h('button', {
      class: 'icon-btn', type: 'button',
      onClick: () => { usedHint = true; hintBtn.textContent = `💡 ${word.pinyin}`; hintBtn.disabled = true; },
    }, '💡 Gợi ý pinyin');
    const check = () => finish(isCorrectWordAnswer(word, input.value), input.value);
    footer.append(input, h('div', { class: 'row row--between' }, hintBtn, primaryButton('Kiểm tra ↵', check)));
    setTimeout(() => input.focus(), 50);
  } else {
    const options = shuffle([word, ...pickDistractors(word, pool)]);
    grid = optionGrid(options, {
      hanzi: true,
      render: (w) => w.simplified,
      onPick: (i) => {
        grid.lock(options.findIndex((w) => w.id === word.id), i);
        finish(options[i].id === word.id, options[i].simplified);
      },
    });
    body.append(grid.el);
  }

  return { el: root, onKey: (e) => grid?.onKey(e) ?? false };
}
