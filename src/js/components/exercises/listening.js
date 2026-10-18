// Mode 2 — Listening recognition: hear the word, pick the characters
import { h } from '../../utils/dom.js';
import { shuffle } from '../../utils/random.js';
import { pickDistractors } from '../../core/distractors.js';
import { speakWord } from '../word-detail.js';
import { exerciseShell, optionGrid, feedback, answerReveal, now } from './common.js';

export function create(ctx) {
  const { word, pool, onDone } = ctx;
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'listening' });
  const options = shuffle([word, ...pickDistractors(word, pool)]);
  const startedAt = now();
  const play = () => speakWord(word.simplified);

  const grid = optionGrid(options, {
    hanzi: true,
    render: (w) => w.simplified,
    onPick: (i) => {
      const correct = options[i].id === word.id;
      grid.lock(options.findIndex((w) => w.id === word.id), i);
      footer.append(feedback(correct, correct ? '' : `Đáp án: ${word.simplified}`), answerReveal(word));
      onDone({ correct, responseMs: now() - startedAt });
    },
  });

  body.append(
    h('p', { class: 'exercise__prompt' }, 'Nghe và chọn chữ Hán đúng'),
    h('div', { class: 'center' }, h('button', { class: 'btn btn--primary', type: 'button', onClick: play, 'aria-label': 'Phát lại (phím Space)' }, '🔊 Phát âm')),
    grid.el,
  );
  setTimeout(play, 350);

  return {
    el: root,
    onKey(e) {
      if (e.key === ' ') { play(); return true; }
      return grid.onKey(e);
    },
  };
}
