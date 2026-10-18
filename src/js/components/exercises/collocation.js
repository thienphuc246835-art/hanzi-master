// Mode 14 — Collocation (verb–object / measure word) and odd-one-out
import { h } from '../../utils/dom.js';
import { shuffle, pickOne } from '../../utils/random.js';
import { state } from '../../core/store.js';
import { exerciseShell, optionGrid, feedback, now } from './common.js';

export function itemsForWord(wordId) {
  return state.collocations.filter((c) => c.word_ids?.includes(wordId));
}

export function create(ctx) {
  const { word, onDone } = ctx;
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'collocation' });
  const item = ctx.item ?? pickOne(word ? itemsForWord(word.id) : state.collocations);
  const startedAt = now();

  if (item.type === 'odd_one_out') {
    const options = shuffle(item.items);
    const grid = optionGrid(options, {
      hanzi: true,
      render: (t) => t,
      onPick: (i) => {
        grid.lock(options.indexOf(item.answer), i);
        const correct = options[i] === item.answer;
        footer.append(feedback(correct, item.reason_vi));
        onDone({ correct, responseMs: now() - startedAt });
      },
    });
    body.append(h('p', { class: 'exercise__prompt' }, 'Chọn từ không cùng nhóm với các từ còn lại'), grid.el);
    return { el: root, onKey: (e) => grid.onKey(e) };
  }

  const options = shuffle(item.options);
  const [before, after] = item.prompt.split('___');
  const blank = h('span', { class: 'blank blank--active' }, '  ');
  const grid = optionGrid(options, {
    hanzi: true,
    render: (t) => t,
    onPick: (i) => {
      const correct = options[i] === item.answer;
      grid.lock(options.indexOf(item.answer), i);
      blank.textContent = item.answer;
      blank.classList.remove('blank--active');
      blank.classList.add(correct ? 'blank--correct' : 'blank--wrong');
      footer.append(feedback(correct, `${item.full} — ${item.vi}`));
      onDone({ correct, responseMs: now() - startedAt });
    },
  });
  body.append(
    h('p', { class: 'exercise__prompt' }, item.kind === 'measure_word' ? 'Chọn lượng từ đúng' : 'Chọn động từ đi kèm đúng'),
    h('p', { class: 'cloze-sentence', lang: 'zh-CN', style: { fontSize: '2.2rem' } }, before, blank, after),
    h('p', { class: 'center muted' }, item.vi),
    grid.el,
  );
  return { el: root, onKey: (e) => grid.onKey(e) };
}
