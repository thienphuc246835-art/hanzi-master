// Mode 8 — Sentence builder: reorder shuffled word blocks (one retry before the answer)
import { h } from '../../utils/dom.js';
import { shuffle, pickOne } from '../../utils/random.js';
import { makeDraggable } from '../../utils/drag.js';
import { builderExamples } from '../../core/exercise-picker.js';
import { exerciseShell, feedback, sentenceReveal, primaryButton, tokensOf, now } from './common.js';

// Shared by Mode 8 and Mode 12: a word bank that builds an answer line
export function tokenBuilder(tokens, { extra = [] } = {}) {
  const all = shuffle([...tokens.map((t, i) => ({ t, key: `a${i}` })), ...extra.map((t, i) => ({ t, key: `x${i}` }))]);
  const line = h('div', { class: 'answer-line', 'aria-label': 'Câu trả lời', role: 'list' });
  const bank = h('div', { class: 'bank', 'aria-label': 'Ngân hàng từ' });
  const placed = [];

  const render = () => {
    line.replaceChildren(...placed.map((p, idx) => {
      const btn = h('button', { class: 'token', type: 'button', role: 'listitem', lang: 'zh-CN', 'aria-label': `${p.t} — bấm để bỏ ra` }, p.t);
      makeDraggable(btn, {
        dropSelector: '.answer-line .token, .bank',
        onTap: () => { placed.splice(idx, 1); sync(); },
        onDrop: (target) => {
          if (target.classList.contains('bank')) placed.splice(idx, 1);
          else {
            const to = [...line.children].indexOf(target);
            const [item] = placed.splice(idx, 1);
            placed.splice(to, 0, item);
          }
          sync();
        },
      });
      return btn;
    }));
  };

  const bankButtons = all.map((item) => {
    const btn = h('button', { class: 'token', type: 'button', lang: 'zh-CN' }, item.t);
    makeDraggable(btn, {
      dropSelector: '.answer-line',
      onTap: () => { placed.push(item); sync(); },
      onDrop: () => { placed.push(item); sync(); },
    });
    item.btn = btn;
    return btn;
  });
  bank.append(...bankButtons);

  function sync() {
    const used = new Set(placed.map((p) => p.key));
    all.forEach((item) => item.btn.classList.toggle('token--used', used.has(item.key)));
    render();
  }

  return {
    el: h('div', { class: 'stack' }, line, bank),
    answer: () => placed.map((p) => p.t),
    markWrong(expected) {
      [...line.children].forEach((el, i) => el.classList.toggle('token--wrong', placed[i]?.t !== expected[i]));
    },
    markAll(cls) { [...line.children].forEach((el) => el.classList.add(cls)); },
    reset() { placed.length = 0; sync(); },
  };
}

export function create(ctx) {
  const { word, onDone } = ctx;
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'sentence_builder' });
  const example = pickOne(builderExamples(word));
  const tokens = tokensOf(example);
  const builder = tokenBuilder(tokens);
  const startedAt = now();
  let attempts = 0;
  let done = false;

  const check = () => {
    if (done) return;
    const answer = builder.answer();
    if (answer.length !== tokens.length) return;
    attempts++;
    const correct = answer.join('') === tokens.join('');
    if (correct) {
      builder.markAll('token--correct');
      return finish(true);
    }
    builder.markWrong(tokens);
    if (attempts === 1) {
      status.textContent = 'Các khối đỏ đang sai vị trí — thử lại một lần nữa.';
      return;
    }
    finish(false);
  };

  function finish(correct) {
    done = true;
    footer.replaceChildren(feedback(correct, attempts > 1 && correct ? 'Đúng ở lần thử thứ hai' : ''), sentenceReveal(example));
    onDone({ correct, retried: attempts > 1, responseMs: now() - startedAt });
  }

  const status = h('p', { class: 'center small', role: 'status', style: { color: 'var(--color-danger)' } });
  body.append(
    h('p', { class: 'exercise__prompt' }, 'Sắp xếp các khối từ thành câu đúng'),
    h('p', { class: 'center', style: { fontSize: '1.1rem' } }, example.vi),
    builder.el,
    status,
  );
  footer.append(h('div', { class: 'row row--between' },
    h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => builder.reset() }, 'Làm lại'),
    primaryButton('Kiểm tra ↵', check)));

  return {
    el: root,
    onKey(e) {
      if (e.key === 'Enter' && !done) { check(); return true; }
      return false;
    },
  };
}
