// Mode 5 — Multiple choice with a 10-second timer
import { h } from '../../utils/dom.js';
import { shuffle, pickOne } from '../../utils/random.js';
import { pickDistractors } from '../../core/distractors.js';
import { MC_TIMER_MS } from '../../core/constants.js';
import { state } from '../../core/store.js';
import { primaryMeaning } from '../word-detail.js';
import { exerciseShell, optionGrid, countdown, feedback, answerReveal, now } from './common.js';

const VARIANTS = Object.freeze({
  hanziToMeaning: 'Chọn nghĩa đúng',
  meaningToHanzi: 'Chọn chữ Hán đúng',
});

export function create(ctx) {
  const { word, pool, onDone } = ctx;
  // Recall level 2: recall the characters from the meaning (harder than recognising them)
  const variant = ctx.variant ?? (ctx.recallLevel >= 2 ? 'meaningToHanzi' : pickOne(Object.keys(VARIANTS)));
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'multiple_choice' });
  const options = shuffle([word, ...pickDistractors(word, pool)]);
  const correctIdx = options.findIndex((w) => w.id === word.id);
  const startedAt = now();
  let timer = null;
  let done = false;

  const finish = (chosenIdx, timedOut = false) => {
    if (done) return;
    done = true;
    timer?.stop();
    grid.lock(correctIdx, chosenIdx);
    const correct = !timedOut && chosenIdx === correctIdx;
    footer.append(feedback(correct, timedOut ? 'Hết giờ!' : ''), answerReveal(word));
    onDone({ correct, timedOut, responseMs: now() - startedAt });
  };

  const hanziPrompt = variant === 'hanziToMeaning';
  const grid = optionGrid(options, {
    hanzi: !hanziPrompt,
    oneColumn: hanziPrompt,
    render: (w) => (hanziPrompt ? primaryMeaning(w) : w.simplified),
    onPick: (i) => finish(i),
  });

  body.append(
    h('p', { class: 'exercise__prompt' }, VARIANTS[variant]),
    hanziPrompt
      ? h('div', { class: 'flashcard__hanzi flashcard__hanzi--md', lang: 'zh-CN' }, word.simplified)
      : h('div', { class: 'flashcard__meaning', style: { fontSize: '1.4rem' } }, primaryMeaning(word)),
  );
  if (state.settings.mc_timer) {
    timer = countdown(MC_TIMER_MS, () => finish(-1, true));
    body.append(timer.el);
  }
  body.append(grid.el);

  return { el: root, onKey: (e) => grid.onKey(e), destroy: () => timer?.stop() };
}
