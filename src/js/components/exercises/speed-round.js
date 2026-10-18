// Mode 15 — 60-second true/false speed round (practice only, never updates FSRS)
import { h } from '../../utils/dom.js';
import { pickOne } from '../../utils/random.js';
import { vibrate } from '../../utils/ui.js';
import { SPEED_ROUND_MS } from '../../core/constants.js';
import { areSynonyms } from '../../core/distractors.js';
import { primaryMeaning } from '../word-detail.js';
import { exerciseShell, countdown, primaryButton } from './common.js';

const SWIPE_PX = 70;

export function create(ctx) {
  const { pool, onDone } = ctx;
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'speed_round', recallLevel: 1 });
  let score = 0;
  let total = 0;
  let current = null;
  let running = false;
  let timer = null;
  const results = [];

  const scoreEl = h('div', { class: 'card__value center', 'aria-live': 'polite' }, '0');
  const hanziEl = h('div', { class: 'flashcard__hanzi flashcard__hanzi--md', lang: 'zh-CN' });
  const meaningEl = h('div', { class: 'flashcard__meaning' });
  const card = h('div', { class: 'speed-card stack center' }, hanziEl, meaningEl);

  function nextPair() {
    const word = pickOne(pool);
    const truthy = Math.random() < 0.5;
    let shown = word;
    if (!truthy) {
      const others = pool.filter((w) => w.id !== word.id && !areSynonyms(w, word));
      shown = pickOne(others) ?? word;
    }
    current = { word, isTrue: shown.id === word.id };
    hanziEl.textContent = word.simplified;
    meaningEl.textContent = primaryMeaning(shown);
    card.className = 'speed-card stack center anim-pop';
  }

  function answer(saysTrue) {
    if (!running) return;
    total++;
    const ok = saysTrue === current.isTrue;
    if (ok) score++;
    results.push({ wordId: current.word.id, correct: ok });
    scoreEl.textContent = String(score);
    vibrate(ok ? 8 : [10, 30, 10]);
    card.classList.add(saysTrue ? 'speed-card--out-right' : 'speed-card--out-left');
    setTimeout(nextPair, 160);
  }

  function start() {
    running = true;
    footer.replaceChildren(
      h('div', { class: 'row row--between' },
        h('button', { class: 'btn', type: 'button', onClick: () => answer(false), 'aria-label': 'Sai (phím mũi tên trái)' }, '← Sai'),
        h('button', { class: 'btn btn--primary', type: 'button', onClick: () => answer(true), 'aria-label': 'Đúng (phím mũi tên phải)' }, 'Đúng →')),
    );
    timer = countdown(SPEED_ROUND_MS, stop);
    body.prepend(timer.el);
    nextPair();
  }

  function stop() {
    running = false;
    timer?.stop();
    card.replaceChildren(h('p', { style: { fontSize: '1.2rem' } }, `Hết giờ! ${score}/${total} câu đúng`));
    footer.replaceChildren();
    onDone({ correct: total > 0 && score / total >= 0.8, score, total, results, practiceOnly: true });
  }

  let touch = null;
  card.addEventListener('pointerdown', (e) => { touch = e.clientX; });
  card.addEventListener('pointerup', (e) => {
    if (touch === null) return;
    const dx = e.clientX - touch;
    touch = null;
    if (Math.abs(dx) > SWIPE_PX) answer(dx > 0);
  });

  body.append(
    h('p', { class: 'exercise__prompt' }, 'Chữ Hán và nghĩa có khớp nhau không? Vuốt phải = Đúng, vuốt trái = Sai'),
    scoreEl, card,
  );
  footer.append(h('div', { class: 'center' }, primaryButton('Bắt đầu 60 giây', start)));

  return {
    el: root,
    onKey(e) {
      if (!running && e.key === 'Enter') { start(); return true; }
      if (e.key === 'ArrowRight') { answer(true); return true; }
      if (e.key === 'ArrowLeft') { answer(false); return true; }
      return false;
    },
    destroy: () => timer?.stop(),
  };
}
