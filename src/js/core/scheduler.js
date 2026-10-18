// Review queue, adaptive new-card limit (§4.3) and forecast. Pure functions.
import {
  STATE, RATING, LEARN_AHEAD_MS, ADAPTIVE_MIN_SAMPLE,
  ADAPTIVE_AGAIN_THRESHOLD, ADAPTIVE_EASY_THRESHOLD,
} from './constants.js';
import { dayKey, startOfDay, addDays } from '../utils/date.js';

export function isDue(card, now, learnAheadMs = LEARN_AHEAD_MS) {
  if (!card || card.state === STATE.NEW) return false;
  return new Date(card.due).getTime() <= now.getTime() + learnAheadMs;
}

// Hệ thống tự điều chỉnh số thẻ mới theo tỷ lệ Again / Easy gần đây
export function adaptiveNewLimit(base, recentRatings) {
  if (recentRatings.length < ADAPTIVE_MIN_SAMPLE) return { limit: base, reason: null };
  const again = recentRatings.filter((r) => r === RATING.AGAIN).length / recentRatings.length;
  const easy = recentRatings.filter((r) => r === RATING.EASY).length / recentRatings.length;
  if (again > ADAPTIVE_AGAIN_THRESHOLD) {
    return { limit: Math.max(1, Math.round(base * 0.5)), reason: `Tỷ lệ "Lại" ${Math.round(again * 100)}% > 30% → giảm thẻ mới, tăng ôn tập` };
  }
  if (easy > ADAPTIVE_EASY_THRESHOLD) {
    return { limit: Math.round(base * 1.5), reason: `Tỷ lệ "Dễ" ${Math.round(easy * 100)}% > 70% → tăng thẻ mới` };
  }
  return { limit: base, reason: null };
}

export function newIntroducedOn(cards, day) {
  return cards.filter((c) => c.review_history?.length && dayKey(c.review_history[0].date) === day).length;
}

export function selectDueCards(cards, now) {
  return cards
    .filter((c) => isDue(c, now))
    .sort((a, b) => new Date(a.due) - new Date(b.due));
}

export function selectNewWords(words, cardsById, { limit, startLevel = 1, targetLevel = 7 }) {
  if (limit <= 0) return [];
  return words
    .filter((w) => w.hsk_level >= startLevel && w.hsk_level <= targetLevel)
    .filter((w) => !cardsById.has(w.id) || cardsById.get(w.id).state === STATE.NEW)
    // Lesson order first (giáo trình), then frequency
    .sort((a, b) => a.hsk_level - b.hsk_level ||
      (a.order ?? 1e9) - (b.order ?? 1e9) ||
      (a.frequency_rank ?? 1e9) - (b.frequency_rank ?? 1e9) ||
      a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function buildQueue({ words, cards, now, settings, recentRatings = [] }) {
  const cardsById = new Map(cards.map((c) => [c.word_id, c]));
  const due = selectDueCards(cards, now);
  const adaptive = adaptiveNewLimit(settings.daily_new_cards, recentRatings);
  const introducedToday = newIntroducedOn(cards, dayKey(now));
  const remaining = Math.max(0, adaptive.limit - introducedToday);
  const fresh = selectNewWords(words, cardsById, {
    limit: remaining,
    startLevel: settings.start_level ?? 1,
    targetLevel: settings.target_hsk ?? 7,
  });
  return { due, fresh, newLimit: adaptive.limit, adaptiveReason: adaptive.reason, introducedToday };
}

// Interleave reviews and new words so new cards are spread through the session
export function interleaveQueue(dueItems, newItems) {
  if (!newItems.length) return [...dueItems];
  if (!dueItems.length) return [...newItems];
  const out = [];
  const gap = Math.max(1, Math.floor(dueItems.length / newItems.length));
  let n = 0;
  dueItems.forEach((item, i) => {
    out.push(item);
    if ((i + 1) % gap === 0 && n < newItems.length) out.push(newItems[n++]);
  });
  while (n < newItems.length) out.push(newItems[n++]);
  return out;
}

// Cards due on each of the next `days` days (day 0 includes overdue cards)
export function forecast(cards, now, days = 7) {
  const today = startOfDay(now);
  const buckets = Array.from({ length: days }, (_, i) => ({ date: addDays(today, i), count: 0 }));
  for (const c of cards) {
    if (c.state === STATE.NEW) continue;
    const due = startOfDay(new Date(c.due));
    const idx = Math.max(0, Math.round((due - today) / 86_400_000));
    if (idx < days) buckets[idx].count++;
  }
  return buckets;
}
