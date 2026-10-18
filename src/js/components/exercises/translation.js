// Mode 12 — Reverse translation Vietnamese → Chinese (word bank or free typing)
import { h } from '../../utils/dom.js';
import { pickOne, sample } from '../../utils/random.js';
import { isAcceptedAnswer, diffChars } from '../../core/grader.js';
import { builderExamples } from '../../core/exercise-picker.js';
import { tokenBuilder } from './sentence-builder.js';
import { exerciseShell, feedback, sentenceReveal, primaryButton, tokensOf, now } from './common.js';

const EXTRA_TOKENS = 2;

export function create(ctx) {
  const { word, pool, onDone } = ctx;
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'translation' });
  const example = pickOne(builderExamples(word));
  const tokens = tokensOf(example);
  const accepted = [example.zh, ...(example.accepted_answers ?? [])];
  const otherTokens = pool.filter((w) => w.id !== word.id).flatMap((w) => builderExamples(w).flatMap(tokensOf))
    .filter((t) => !tokens.includes(t));
  const builder = tokenBuilder(tokens, { extra: sample([...new Set(otherTokens)], EXTRA_TOKENS) });
  const startedAt = now();
  let freeMode = false;
  let done = false;

  const input = h('input', {
    class: 'input input--hanzi', type: 'text', autocomplete: 'off', spellcheck: false,
    'aria-label': 'Gõ câu tiếng Trung', placeholder: 'Gõ câu tiếng Trung…',
    onKeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } },
  });
  const area = h('div', {}, builder.el);
  const modeBtn = h('button', {
    class: 'icon-btn', type: 'button',
    onClick: () => {
      freeMode = !freeMode;
      area.replaceChildren(freeMode ? input : builder.el);
      modeBtn.textContent = freeMode ? '🧩 Dùng ngân hàng từ' : '⌨️ Gõ tự do';
      if (freeMode) input.focus();
    },
  }, '⌨️ Gõ tự do');

  function check() {
    if (done) return;
    const answer = freeMode ? input.value : builder.answer().join('');
    if (!answer.trim()) return;
    done = true;
    const correct = isAcceptedAnswer(answer, accepted);
    if (!freeMode) builder.markWrong(tokens);
    footer.replaceChildren(
      feedback(correct, ''),
      !correct && freeMode ? h('p', { class: 'diff', lang: 'zh-CN' }, diffChars(example.zh, answer).map((d) => h('span', { class: `diff__${d.status}` }, d.char))) : null,
      sentenceReveal(example),
    );
    onDone({ correct, responseMs: now() - startedAt });
  }

  body.append(
    h('p', { class: 'exercise__prompt' }, 'Dịch sang tiếng Trung'),
    h('p', { class: 'center', style: { fontSize: '1.25rem', fontWeight: 500 } }, example.vi),
    h('p', { class: 'center muted small' }, `Gợi ý: câu có dùng nghĩa «${word.meanings[0].vi}»`),
    area,
  );
  footer.append(h('div', { class: 'row row--between' }, modeBtn, primaryButton('Kiểm tra ↵', check)));

  return {
    el: root,
    onKey(e) {
      if (e.key === 'Enter' && !freeMode && !done) { check(); return true; }
      return false;
    },
  };
}
