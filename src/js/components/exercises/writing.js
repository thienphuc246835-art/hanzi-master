// Mode 4 — Character writing quiz (HanziWriter stroke checking)
import { h } from '../../utils/dom.js';
import { tonedPinyin, primaryMeaning, hanViet, strokeAnimation, strokeColors } from '../word-detail.js';
import { strokeDataLoader } from '../../utils/strokes.js';
import { exerciseShell, feedback, answerReveal, primaryButton, now } from './common.js';

const BOX_SIZE = 200;
const MISSES_BEFORE_HINT = 3;

export function create(ctx) {
  const { word, onDone } = ctx;
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'writing' });
  const chars = [...word.simplified];
  const startedAt = now();
  let totalMistakes = 0;
  let usedHint = false;
  let done = false;

  body.append(
    h('p', { class: 'exercise__prompt' }, 'Viết chữ Hán cho từ sau'),
    h('div', { class: 'flashcard__meaning', style: { fontSize: '1.4rem' } }, primaryMeaning(word)),
    h('div', { class: 'center' }, tonedPinyin(word, 'pinyin flashcard__pinyin'), h('div', { class: 'flashcard__hanviet' }, hanViet(word))),
  );

  const finish = (correct) => {
    if (done) return;
    done = true;
    footer.replaceChildren(feedback(correct, correct && totalMistakes ? `${totalMistakes} nét sai` : ''), answerReveal(word));
    onDone({ correct, usedHint, retried: totalMistakes >= MISSES_BEFORE_HINT, responseMs: now() - startedAt });
  };

  // Fallback without stroke data: write on paper, then self-check
  const selfCheck = () => {
    body.querySelector('.writer')?.remove();
    const reveal = h('div');
    footer.replaceChildren(
      h('p', { class: 'muted center small' }, 'Không tải được dữ liệu nét bút. Hãy viết ra giấy rồi tự kiểm tra.'),
      primaryButton('Hiện đáp án', () => {
        reveal.replaceChildren(answerReveal(word), strokeAnimation(word, 120));
        footer.replaceChildren(reveal, h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn', type: 'button', onClick: () => finish(false) }, '✗ Viết sai'),
          h('button', { class: 'btn btn--primary', type: 'button', onClick: () => finish(true) }, '✓ Viết đúng')));
      }),
    );
  };

  if (!window.HanziWriter) {
    selfCheck();
    return { el: root };
  }

  const writerWrap = h('div', { class: 'writer' });
  body.append(writerWrap);
  const boxes = chars.map(() => h('div', { class: 'writer__box', style: { width: `${BOX_SIZE}px`, height: `${BOX_SIZE}px` } }));
  writerWrap.append(...boxes);
  let failed = false;
  const writers = chars.map((ch, i) => window.HanziWriter.create(boxes[i], ch, {
    width: BOX_SIZE, height: BOX_SIZE, padding: 10,
    showCharacter: false, showOutline: false,
    ...strokeColors(),
    drawingColor: strokeColors().radicalColor, highlightColor: '#6D9EEB',
    charDataLoader: strokeDataLoader,
    drawingWidth: 18,
    onLoadCharDataError: () => { if (!failed) { failed = true; selfCheck(); } },
  }));

  const quizAt = (i) => {
    if (i >= writers.length) return finish(true);
    boxes[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    writers[i].quiz({
      showHintAfterMisses: MISSES_BEFORE_HINT,
      onMistake: () => { totalMistakes++; },
      onComplete: () => { boxes[i].classList.add('writer__box--done'); quizAt(i + 1); },
    });
  };
  quizAt(0);

  footer.append(h('div', { class: 'row row--between' },
    h('button', {
      class: 'icon-btn', type: 'button',
      onClick: () => { usedHint = true; writers.forEach((w) => w.showOutline()); },
    }, '💡 Hiện nét mờ'),
    h('button', {
      class: 'btn btn--ghost', type: 'button',
      onClick: () => { writers.forEach((w) => { w.cancelQuiz(); w.showCharacter(); }); finish(false); },
    }, 'Không nhớ'),
  ));

  return { el: root, destroy: () => writers.forEach((w) => w.cancelQuiz?.()) };
}
