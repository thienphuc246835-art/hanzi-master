// Mode 10 — Radical assembly: build a character from its components (reinforces §4.4)
import { h } from '../../utils/dom.js';
import { shuffle, pickOne } from '../../utils/random.js';
import { vibrate } from '../../utils/ui.js';
import { pickAssemblyDistractors } from '../../core/distractors.js';
import { primaryMeaning } from '../word-detail.js';
import { toneOf } from '../../utils/pinyin.js';
import { exerciseShell, feedback, now } from './common.js';

const EXTRA_PIECES = 3;

export function create(ctx) {
  const { word, pool, onDone } = ctx;
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'radical_assembly' });
  const character = pickOne(word.characters.filter((c) => (c.assembly ?? []).length >= 2));
  const needed = character.assembly;
  const pieces = shuffle([...needed, ...pickAssemblyDistractors(character, pool, { count: EXTRA_PIECES })]);
  const slots = needed.map(() => null);
  const startedAt = now();
  let attempts = 0;
  let done = false;

  const slotEls = needed.map((_, i) => h('button', {
    class: 'assembly-slot', type: 'button', 'aria-label': `Ô ${i + 1}`,
    onClick: () => { slots[i] = null; render(); },
  }));
  const pieceEls = pieces.map((p, pi) => h('button', {
    class: 'token', type: 'button', lang: 'zh-CN', 'aria-label': `Mảnh ${p}`,
    onClick: () => place(pi),
  }, p));
  const result = h('div', { class: 'assembly-result', 'aria-live': 'polite' });

  function place(pi) {
    if (done) return;
    const free = slots.indexOf(null);
    if (free < 0 || slots.includes(pi)) return;
    slots[free] = pi;
    render();
    if (!slots.includes(null)) check();
  }

  function render() {
    slotEls.forEach((el, i) => {
      el.textContent = slots[i] === null ? '' : pieces[slots[i]];
      el.classList.toggle('assembly-slot--filled', slots[i] !== null);
    });
    pieceEls.forEach((el, pi) => el.classList.toggle('token--used', slots.includes(pi)));
  }

  // Order-insensitive: 女+马 and 马+女 both name the same components
  function check() {
    attempts++;
    const chosen = slots.map((pi) => pieces[pi]).sort().join('');
    const correct = chosen === [...needed].sort().join('');
    if (correct) return finish(true);
    vibrate([10, 40, 10]);
    slotEls.forEach((el) => el.classList.add('anim-shake'));
    setTimeout(() => slotEls.forEach((el) => el.classList.remove('anim-shake')), 300);
    if (attempts === 1) {
      status.textContent = 'Chưa đúng — thử lại một lần nữa.';
      slots.fill(null);
      render();
    } else finish(false);
  }

  function finish(correct) {
    done = true;
    result.textContent = character.char;
    footer.replaceChildren(
      feedback(correct, `${needed.join(' + ')} = ${character.char}`),
      h('p', {}, h('strong', {}, `${character.han_viet} · `), character.mnemonic.story_vi),
    );
    onDone({ correct, retried: attempts > 1, responseMs: now() - startedAt });
  }

  const status = h('p', { class: 'center small', role: 'status', style: { color: 'var(--color-danger)' } });
  const wordHint = [...word.simplified].map((ch) => (ch === character.char ? '＿' : ch)).join('');
  body.append(
    h('p', { class: 'exercise__prompt' }, 'Ghép các bộ phận thành chữ Hán'),
    h('div', { class: 'center' },
      h('div', { style: { fontSize: '1.2rem' } }, primaryMeaning(word)),
      h('div', { class: 'muted' }, `Chữ cần ghép: ${character.han_viet} · `, h('span', { class: `pinyin tone-${toneOf(character.pinyin)}` }, character.pinyin),
        word.simplified.length > 1 ? ` · trong từ ${wordHint}` : '')),
    h('div', { class: 'assembly-slots' }, slotEls),
    result,
    h('div', { class: 'bank' }, pieceEls),
    status,
  );
  footer.append(h('div', { class: 'row', style: { justifyContent: 'center' } },
    h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => { if (!done) { slots.fill(null); render(); } } }, 'Xoá ô')));

  return { el: root };
}
