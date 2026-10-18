// Mode 1 — Classic flashcard (CLAUDE.md §5.3 layout)
import { h } from '../utils/dom.js';
import { openModal, vibrate } from '../utils/ui.js';
import { RATING, RATING_LABELS, STATE } from '../core/constants.js';
import { state } from '../core/store.js';
import {
  tonedPinyin, hanViet, primaryMeaning, renderMnemonic, renderExamples, renderRadicalHint,
  renderRelated, strokeAnimation, favoriteButton, speakWord, wordImage,
} from './word-detail.js';

const AUTO_PLAY_DELAY_MS = 250;

const SWIPE_PX = 80;

export function createFlashcard({ word, card, headerText, intervalLabels, onRate }) {
  const isNew = !card || card.state === STATE.NEW;
  let flipped = false;
  let usedHint = false;
  const shownAt = performance.now();

  const hintSlot = h('div');
  const hintBtn = h('button', {
    class: 'icon-btn', type: 'button', 'aria-pressed': 'false',
    onClick: () => {
      usedHint = true;
      hintBtn.setAttribute('aria-pressed', 'true');
      hintSlot.replaceChildren(renderRadicalHint(word));
      highlightSuggested();
    },
  }, '💡 Gợi ý bộ thủ');

  const ratingButtons = [1, 2, 3, 4].map((r) => h('button', {
    class: 'rating__btn', type: 'button', dataset: { rating: r },
    'aria-label': `${RATING_LABELS[r]} — ôn lại sau ${intervalLabels[r]} (phím ${r})`,
    onClick: () => rate(r),
  }, h('span', { class: 'rating__label' }, RATING_LABELS[r]), h('span', { class: 'rating__ivl' }, intervalLabels[r])));

  // Nếu đã mở gợi ý trước khi lật → mặc định gợi ý nút [Khó] (§4.4)
  function highlightSuggested() {
    ratingButtons.forEach((b) => b.classList.remove('rating__btn--suggested'));
    if (usedHint) ratingButtons[RATING.HARD - 1].classList.add('rating__btn--suggested');
  }

  const actions = () => h('div', { class: 'action-row' },
    h('button', { class: 'icon-btn', type: 'button', onClick: () => speakWord(word.simplified) }, '🔊 Phát âm'),
    h('button', {
      class: 'icon-btn', type: 'button',
      onClick: () => openModal(h('div', { class: 'stack center' }, h('h2', {}, 'Thứ tự nét'), strokeAnimation(word, 140)), { label: 'Thứ tự nét' }),
    }, '✏️ Nét bút'),
  );

  const front = h('div', { class: 'flashcard__face flashcard__front', 'aria-hidden': String(isNew) },
    h('div', { class: 'flashcard__meta' }, h('span', {}, headerText), h('span', {}, 'Lật thẻ')),
    h('div', { class: 'flashcard__hanzi', lang: 'zh-CN' }, word.simplified),
    hintSlot,
    h('div', { class: 'flashcard__cta' },
      h('button', { class: 'btn btn--primary', type: 'button', onClick: () => flip() }, 'Hiện đáp án', h('span', { class: 'muted small', 'aria-hidden': 'true' }, ' ↵')),
    ),
    h('div', { class: 'action-row' },
      h('button', { class: 'icon-btn', type: 'button', onClick: () => speakWord(word.simplified) }, '🔊 Phát âm'),
      hintBtn,
    ),
  );

  const relatedSlot = h('div');
  const back = h('div', { class: 'flashcard__face flashcard__back', 'aria-hidden': String(!isNew) },
    h('div', { class: 'flashcard__meta' }, h('span', {}, headerText), h('span', {}, isNew ? 'Từ mới' : 'Đáp án')),
    h('div', { class: 'flashcard__hanzi flashcard__hanzi--md', lang: 'zh-CN' }, word.simplified),
    h('div', { class: 'center' }, tonedPinyin(word, 'pinyin flashcard__pinyin'), h('div', { class: 'flashcard__hanviet' }, hanViet(word))),
    h('div', { class: 'flashcard__divider' }),
    h('div', { class: 'flashcard__meaning' }, primaryMeaning(word)),
    wordImage(word, 'word-image word-image--card'),
    renderMnemonic(word, { open: isNew }),
    renderExamples(word, { compact: true }),
    h('div', { class: 'action-row' },
      actions(),
      h('button', { class: 'icon-btn', type: 'button', onClick: () => relatedSlot.replaceChildren(renderRelated(word)) }, '🏷️ Cùng bộ thủ'),
      favoriteButton(word),
    ),
    relatedSlot,
    h('div', { class: 'rating', role: 'group', 'aria-label': 'Đánh giá mức độ nhớ' }, ratingButtons),
  );

  const el = h('div', { class: `flashcard${isNew ? ' flashcard--flipped' : ''}` },
    h('div', { class: 'flashcard__inner' }, front, back));

  // Thẻ từ mới hiện ra → tự phát âm (có thể tắt trong Cài đặt)
  if (isNew) {
    flipped = true;
    el.querySelector('.flashcard__inner').style.transition = 'none';
    if (state.settings.auto_play_audio) setTimeout(() => { if (el.isConnected) speakWord(word.simplified); }, AUTO_PLAY_DELAY_MS);
  }

  function flip() {
    if (flipped) return;
    flipped = true;
    el.classList.add('flashcard--flipped');
    front.setAttribute('aria-hidden', 'true');
    back.setAttribute('aria-hidden', 'false');
    highlightSuggested();
    vibrate(8);
    if (state.settings.auto_play_audio) speakWord(word.simplified);
    requestAnimationFrame(() => ratingButtons[RATING.GOOD - 1].focus({ preventScroll: true }));
  }

  let done = false;
  function rate(r) {
    if (!flipped || done) return;
    done = true;
    vibrate(r === RATING.AGAIN ? [10, 40, 10] : 10);
    onRate({ rating: r, usedHint, responseMs: performance.now() - shownAt });
  }

  // Touch: swipe right = Good, swipe left = Again (§10.3)
  let touchStart = null;
  back.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') touchStart = { x: e.clientX, y: e.clientY }; });
  back.addEventListener('pointerup', (e) => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) rate(dx > 0 ? RATING.GOOD : RATING.AGAIN);
  });

  function onKey(e) {
    if (!flipped && (e.key === 'Enter')) { flip(); return true; }
    if (e.key === ' ') { speakWord(word.simplified); return true; }
    if (flipped && ['1', '2', '3', '4'].includes(e.key)) { rate(Number(e.key)); return true; }
    if (!flipped && (e.key === 'h' || e.key === 'H')) { hintBtn.click(); return true; }
    return false;
  }

  return { el, onKey };
}
