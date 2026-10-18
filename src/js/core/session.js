// A complete study session (CLAUDE.md §5.3): queue → exercise → rating → FSRS → next
import {
  STATE, MODES, CHECKPOINT_EVERY_CARDS, NEW_CARD_REINSERT_GAP, XP,
} from './constants.js';
import { createCard, scheduleCard } from './srs.js';
import { buildQueue, interleaveQueue, isDue, selectDueCards } from './scheduler.js';
import { pickMode } from './exercise-picker.js';
import { inferRating } from './grader.js';
import {
  state, saveCard, recordAttempt, medianResponseMs, recentRatings, addXp, xpForAttempt, lessonSegments,
} from './store.js';
import { choosePassage } from '../components/exercises/cloze-passage.js';
import { randomInt } from '../utils/random.js';

export class StudySession {
  // Xử lý một session học tập hoàn chỉnh
  constructor({ now = new Date(), extraNew = 0, lessonId = null, segment = null } = {}) {
    let plan;
    this.lesson = lessonId ? state.lessonsById.get(lessonId) ?? null : null;
    this.segment = segment;
    if (this.lesson) {
      // Học theo bài/chặng: toàn bộ từ mới của chặng + thẻ đến hạn trong bài
      const inLesson = new Set(this.lesson.word_ids);
      const ids = segment ? lessonSegments(this.lesson)[segment - 1] ?? [] : this.lesson.word_ids;
      const due = selectDueCards([...state.cards.values()].filter((c) => inLesson.has(c.word_id)), now);
      const fresh = ids.map((id) => state.wordsById.get(id))
        .filter((w) => w && (!state.cards.has(w.id) || state.cards.get(w.id).state === STATE.NEW));
      plan = { due, fresh, newLimit: fresh.length, adaptiveReason: null, introducedToday: 0 };
    } else {
      const settings = { ...state.settings, daily_new_cards: state.settings.daily_new_cards + extraNew };
      plan = buildQueue({
        words: state.words,
        cards: [...state.cards.values()],
        now,
        settings,
        recentRatings: recentRatings(7, now),
      });
    }
    this.plan = plan;
    this.queue = interleaveQueue(plan.due.map((c) => c.word_id), plan.fresh.map((w) => w.id));
    this.recentModes = [];
    this.lastRatings = new Map();
    this.cardsSinceCheckpoint = 0;
    this.collocationWordIds = new Set(state.collocations.flatMap((c) => c.word_ids ?? []));
    this.warmupPending = MODES.speed_round.enabled && state.settings.warmup_speed_round && this.queue.length > 0;
    this.stats = {
      startedAt: Date.now(),
      completed: 0,
      fsrsReviews: 0,
      correct: 0,
      ratings: { 1: 0, 2: 0, 3: 0, 4: 0 },
      newLearned: 0,
      xp: 0,
      seen: new Set(),
      modes: new Set(),
    };
  }

  get isEmpty() {
    return this.queue.length === 0 && this.stats.completed === 0;
  }

  get progress() {
    const done = this.stats.completed;
    return { done, total: done + this.queue.length + (this.inFlight ? 1 : 0) };
  }

  next() {
    if (this.warmupPending) {
      this.warmupPending = false;
      return { type: 'warmup' };
    }
    if (MODES.cloze_passage.enabled && this.cardsSinceCheckpoint >= CHECKPOINT_EVERY_CARDS) {
      this.cardsSinceCheckpoint = 0;
      const passage = choosePassage(state.passages, (id) => this.stats.seen.has(id) && state.cards.get(id)?.state !== STATE.NEW);
      if (passage) return { type: 'checkpoint', passage };
    }
    const wordId = this.queue.shift();
    if (!wordId) return null;
    const word = state.wordsById.get(wordId);
    if (!word) return this.next();
    const card = state.cards.get(wordId) ?? createCard(wordId);
    const pick = pickMode({
      card,
      word,
      recentModes: this.recentModes,
      disabledModes: state.settings.disabled_modes,
      focus: state.settings.study_focus,
      lastRating: this.lastRatings.get(wordId),
      capabilities: state.capabilities,
      collocationWordIds: this.collocationWordIds,
      poolSize: state.words.length,
    });
    this.recentModes.push(pick.mode);
    this.inFlight = true;
    return { type: 'card', word, card, ...pick };
  }

  suggestRating(item, result) {
    if (item.mode === 'flashcard') return result.rating;
    return inferRating({ ...result, medianMs: medianResponseMs(item.mode), recallLevel: item.recallLevel });
  }

  // Ghi kết quả: chỉ cập nhật FSRS khi thẻ thực sự đến hạn (§4.2.2)
  async commit(item, result, finalRating, now = new Date()) {
    const { card, word } = item;
    const stateBefore = card.state;
    this.inFlight = false;
    const countsForFsrs = !MODES[item.mode].practiceOnly && (stateBefore === STATE.NEW || isDue(card, now));
    let updated = card;
    if (countsForFsrs) {
      updated = scheduleCard(card, finalRating, now);
      await saveCard(updated);
    }
    await recordAttempt({
      word_id: word.id,
      mode: item.mode,
      recall_level: item.recallLevel,
      correct: item.mode === 'flashcard' ? finalRating > 1 : !!result.correct,
      used_hint: !!result.usedHint,
      response_ms: Math.round(result.responseMs ?? 0),
      inferred_rating: this.suggestRating(item, result),
      final_rating: finalRating,
      counts_for_fsrs: countsForFsrs,
      state_before: stateBefore,
      timestamp: now.toISOString(),
    });

    const xp = xpForAttempt(countsForFsrs);
    addXp(xp);
    this.stats.xp += xp;
    this.stats.completed++;
    this.stats.seen.add(word.id);
    this.stats.modes.add(item.mode);
    this.stats.ratings[finalRating]++;
    if (finalRating > 1) this.stats.correct++;
    if (countsForFsrs) this.stats.fsrsReviews++;
    if (stateBefore === STATE.NEW) this.stats.newLearned++;
    this.lastRatings.set(word.id, finalRating);
    this.cardsSinceCheckpoint++;

    // Thẻ đang ở bước học ngắn hạn → gặp lại sau 3–5 thẻ khác
    if (countsForFsrs && isDue(updated, now)) {
      const gap = Math.min(this.queue.length, randomInt(...NEW_CARD_REINSERT_GAP));
      this.queue.splice(gap, 0, word.id);
    }
    return updated;
  }

  async commitCheckpoint({ perWord, responseMs, difficulty }, now = new Date()) {
    const recallLevel = difficulty === 'hard' ? 3 : 2;
    const medianMs = medianResponseMs('cloze_passage');
    for (const { wordId, correct } of perWord) {
      const card = state.cards.get(wordId);
      if (!card) continue;
      const countsForFsrs = card.state !== STATE.NEW && isDue(card, now);
      const rating = inferRating({ correct, responseMs, medianMs, recallLevel });
      if (countsForFsrs) await saveCard(scheduleCard(card, rating, now));
      await recordAttempt({
        word_id: wordId, mode: 'cloze_passage', recall_level: recallLevel, correct, used_hint: false,
        response_ms: Math.round(responseMs), inferred_rating: rating, final_rating: rating,
        counts_for_fsrs: countsForFsrs, state_before: card.state, timestamp: now.toISOString(),
      });
      const xp = xpForAttempt(countsForFsrs);
      addXp(xp);
      this.stats.xp += xp;
    }
    this.stats.modes.add('cloze_passage');
  }

  finish() {
    const s = this.stats;
    if (s.completed > 0) {
      const bonus = XP.sessionBonus + (s.ratings[1] === 0 && s.completed >= 5 ? XP.perfectBonus : 0);
      addXp(bonus);
      s.xp += bonus;
    }
    return {
      ...s,
      minutes: Math.max(1, Math.round((Date.now() - s.startedAt) / 60000)),
      accuracy: s.completed ? s.correct / s.completed : 0,
      perfect: s.completed >= 5 && s.ratings[1] === 0,
    };
  }
}

// Record a practice attempt (never touches FSRS)
export async function recordPractice({ word, mode, recallLevel, result }) {
  await recordAttempt({
    word_id: word?.id ?? null,
    mode,
    recall_level: recallLevel,
    correct: !!result.correct,
    used_hint: !!result.usedHint,
    response_ms: Math.round(result.responseMs ?? 0),
    inferred_rating: null,
    final_rating: null,
    counts_for_fsrs: false,
    state_before: word ? (state.cards.get(word.id)?.state ?? STATE.NEW) : null,
  });
  addXp(XP.perPractice);
}
