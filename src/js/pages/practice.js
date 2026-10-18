// Free practice (/practice/:mode) — any exercise, recorded as practice (no FSRS changes)
import { h, clear } from '../utils/dom.js';
import { toast } from '../utils/ui.js';
import { pickOne, shuffle } from '../utils/random.js';
import { stopSpeaking } from '../utils/tts.js';
import { MODES } from '../core/constants.js';
import { modeSupportsWord } from '../core/exercise-picker.js';
import { recordPractice } from '../core/session.js';
import { state, practicePool, saveProfile } from '../core/store.js';
import { createExercise } from '../components/exercises/index.js';
import { createFlashcard } from '../components/flashcard.js';
import { previewLabels, createCard } from '../core/srs.js';

const NEEDS_LABELS = Object.freeze({
  audio: 'âm thanh (file audio của bộ từ vựng hoặc giọng đọc tiếng Trung)',
  hanziWriter: 'thư viện HanziWriter (cần mạng lần đầu)',
});

export function render(root, { mode, lessonId = null }) {
  const def = MODES[mode];
  const lesson = lessonId ? state.lessonsById.get(lessonId) : null;
  if (!def) {
    root.append(h('div', { class: 'empty' }, h('h2', {}, 'Không tìm thấy dạng bài'), h('a', { class: 'btn', href: '#/' }, 'Về trang chủ')));
    return {};
  }
  const missing = (def.needs ?? []).filter((n) => !state.capabilities[n]);
  const lessonWords = lesson ? lesson.word_ids.map((id) => state.wordsById.get(id)).filter(Boolean) : [];
  const pool = lessonWords.length >= 5 ? lessonWords : practicePool();
  const collocationIds = new Set(state.collocations.flatMap((c) => c.word_ids ?? []));
  let rounds = 0;
  let correct = 0;
  let current = null;
  let nextHandler = null;

  const scoreEl = h('span', { class: 'study-head__count', 'aria-live': 'polite' }, '0/0');
  const stage = h('div', { class: 'stack' });
  root.append(h('div', { class: 'study' },
    h('div', { class: 'study-head' },
      h('a', { class: 'icon-btn', href: lesson ? `#/lesson/${lesson.id}` : '#/', 'aria-label': 'Thoát luyện tập' }, '✕'),
      h('h1', { style: { fontSize: '1rem', flex: 1 } }, `Luyện tập · ${def.name}${lesson ? ` · ${lesson.label}` : ''}`),
      scoreEl),
    stage));

  if (missing.length) {
    stage.append(h('div', { class: 'empty' },
      h('h2', {}, 'Dạng bài này chưa dùng được trên trình duyệt này'),
      h('p', {}, `Cần: ${missing.map((m) => NEEDS_LABELS[m]).join(', ')}.`),
      h('a', { class: 'btn', href: '#/' }, 'Chọn dạng bài khác')));
    return {};
  }

  const ctx = { capabilities: state.capabilities, collocationWordIds: collocationIds, poolSize: pool.length };

  // Deal words like a shuffled deck: every word once per round, never the same word twice in a row
  const usable = pool.filter((w) => modeSupportsWord(mode, w, ctx) || mode === 'speaking');
  const source = [...new Map((usable.length ? usable : pool).map((w) => [w.simplified, w])).values()];
  let deck = [];
  let lastWord = null;
  function pickWord() {
    if (!deck.length) {
      deck = shuffle(source);
      if (deck.length > 1 && deck[deck.length - 1] === lastWord) deck.unshift(deck.pop());
    }
    lastWord = deck.pop();
    return lastWord;
  }

  const onDone = (word, recallLevel) => async (result) => {
    rounds++;
    if (result.correct) correct++;
    scoreEl.textContent = `${correct}/${rounds}`;
    if (mode === 'cloze_passage') {
      for (const r of result.perWord) await recordPractice({ word: state.wordsById.get(r.wordId), mode, recallLevel, result: { correct: r.correct, responseMs: result.responseMs } });
    } else {
      await recordPractice({ word, mode, recallLevel, result });
    }
    if (mode === 'matching' && result.totalErrors === 0) {
      const best = state.profile.records.matching_ms;
      if (!best || result.totalMs < best) {
        saveProfile({ records: { ...state.profile.records, matching_ms: Math.round(result.totalMs) } });
        toast(`🏆 Kỷ lục nối cặp mới: ${(result.totalMs / 1000).toFixed(1)} giây`);
      }
    }
    if (mode === 'speed_round') {
      const best = state.profile.records.speed_round;
      if (!best || result.score > best) {
        saveProfile({ records: { ...state.profile.records, speed_round: result.score } });
        if (result.score) toast(`🏆 Kỷ lục mới: ${result.score} câu đúng`);
      }
    }
    const nextBtn = h('button', { class: 'btn btn--primary', type: 'button', onClick: next }, 'Tiếp ↵');
    current.el.append(h('div', { class: 'center' }, nextBtn));
    nextHandler = (e) => { if (e.key === 'Enter') { next(); return true; } return false; };
    nextBtn.focus({ preventScroll: true });
  };

  function next() {
    current?.destroy?.();
    stopSpeaking();
    nextHandler = null;
    clear(stage);
    const recallLevel = Math.max(...def.levels);
    if (mode === 'flashcard') {
      const word = pickWord();
      const card = state.cards.get(word.id) ?? createCard(word.id);
      current = createFlashcard({
        word, card: { ...card, state: card.state === 'new' ? 'review' : card.state }, headerText: 'Luyện thêm',
        intervalLabels: previewLabels(card),
        onRate: ({ rating, responseMs }) => onDone(word, 1)({ correct: rating > 1, responseMs }),
      });
    } else if (mode === 'cloze_passage') {
      const passage = pickOne(shuffle(state.passages));
      current = createExercise(mode, { passage, practice: true, recallLevel: 2, pool: state.words, onDone: onDone(null, 2) });
    } else if (mode === 'speed_round' || mode === 'matching') {
      current = createExercise(mode, { word: null, pool, practice: true, recallLevel, onDone: onDone(null, recallLevel) });
    } else if (mode === 'collocation') {
      current = createExercise(mode, { word: null, item: pickOne(state.collocations), practice: true, recallLevel, pool, onDone: onDone(null, recallLevel) });
    } else {
      const word = pickWord();
      const level = def.levels.length > 1 ? pickOne(def.levels) : recallLevel;
      current = createExercise(mode, { word, card: state.cards.get(word.id) ?? createCard(word.id), recallLevel: level, practice: true, pool: state.words, onDone: onDone(word, level) });
    }
    stage.append(current.el);
  }

  next();

  return {
    onKey(e) {
      if (nextHandler?.(e)) return true;
      return current?.onKey?.(e) ?? false;
    },
    destroy() {
      current?.destroy?.();
      stopSpeaking();
    },
  };
}
