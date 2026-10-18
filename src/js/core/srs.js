// FSRS-4.5 scheduler — pure functions only (no I/O, no Date.now()).
import {
  STATE, RATING, FSRS_WEIGHTS, REQUEST_RETENTION, MAXIMUM_INTERVAL_DAYS,
  LEARNING_STEPS_MIN, RELEARNING_STEP_MIN,
} from './constants.js';

const DECAY = -0.5;
const FACTOR = 19 / 81; // 0.9^(1/DECAY) - 1
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function createCard(wordId, now = new Date()) {
  return {
    word_id: wordId,
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    state: STATE.NEW,
    due: now.toISOString(),
    last_review: null,
    review_history: [],
  };
}

// Probability of recall after `elapsedDays` for a memory of stability `stability`
export function retrievability(elapsedDays, stability) {
  if (stability <= 0) return 0;
  return Math.pow(1 + FACTOR * elapsedDays / stability, DECAY);
}

export function nextIntervalDays(stability, retention = REQUEST_RETENTION) {
  const ivl = (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
  return clamp(Math.round(ivl), 1, MAXIMUM_INTERVAL_DAYS);
}

export function initStability(rating, w = FSRS_WEIGHTS) {
  return Math.max(w[rating - 1], 0.1);
}

export function initDifficulty(rating, w = FSRS_WEIGHTS) {
  return clamp(w[4] - (rating - 3) * w[5], 1, 10);
}

export function nextDifficulty(d, rating, w = FSRS_WEIGHTS) {
  const next = d - w[6] * (rating - 3);
  // Mean reversion toward D0(Good) keeps difficulty from drifting forever
  const reverted = w[7] * initDifficulty(RATING.GOOD, w) + (1 - w[7]) * next;
  return clamp(reverted, 1, 10);
}

export function nextRecallStability(d, s, r, rating, w = FSRS_WEIGHTS) {
  const hardPenalty = rating === RATING.HARD ? w[15] : 1;
  const easyBonus = rating === RATING.EASY ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) *
    (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus);
}

export function nextForgetStability(d, s, r, w = FSRS_WEIGHTS) {
  return w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
}

function elapsedDaysBetween(lastReview, now) {
  if (!lastReview) return 0;
  return Math.max(0, (now.getTime() - new Date(lastReview).getTime()) / DAY_MS);
}

// Returns the four possible outcomes without mutating `card`
export function previewSchedule(card, now = new Date(), options = {}) {
  const w = options.weights ?? FSRS_WEIGHTS;
  const retention = options.retention ?? REQUEST_RETENTION;
  const elapsed = elapsedDaysBetween(card.last_review, now);
  const out = {};

  const minutes = (m) => new Date(now.getTime() + m * MINUTE_MS);
  const days = (d) => new Date(now.getTime() + d * DAY_MS);

  if (card.state === STATE.NEW) {
    for (const rating of [1, 2, 3, 4]) {
      const s = initStability(rating, w);
      const d = initDifficulty(rating, w);
      if (rating === RATING.EASY) {
        const ivl = nextIntervalDays(s, retention);
        out[rating] = { stability: s, difficulty: d, state: STATE.REVIEW, due: days(ivl), scheduledDays: ivl };
      } else {
        const step = { 1: LEARNING_STEPS_MIN.again, 2: LEARNING_STEPS_MIN.hard, 3: LEARNING_STEPS_MIN.good }[rating];
        out[rating] = { stability: s, difficulty: d, state: STATE.LEARNING, due: minutes(step), scheduledDays: 0 };
      }
    }
    return out;
  }

  const { stability: s, difficulty: d } = card;
  const r = retrievability(elapsed, s);
  const sAgain = Math.min(nextForgetStability(d, s, r, w), s);
  const sHard = nextRecallStability(d, s, r, RATING.HARD, w);
  const sGood = nextRecallStability(d, s, r, RATING.GOOD, w);
  const sEasy = nextRecallStability(d, s, r, RATING.EASY, w);
  const dFor = (rating) => nextDifficulty(d, rating, w);

  if (card.state === STATE.LEARNING || card.state === STATE.RELEARNING) {
    const goodIvl = nextIntervalDays(sGood, retention);
    const easyIvl = Math.max(nextIntervalDays(sEasy, retention), goodIvl + 1);
    out[1] = { stability: sAgain, difficulty: dFor(1), state: card.state, due: minutes(RELEARNING_STEP_MIN), scheduledDays: 0 };
    out[2] = { stability: sHard, difficulty: dFor(2), state: card.state, due: minutes(LEARNING_STEPS_MIN.good), scheduledDays: 0 };
    out[3] = { stability: sGood, difficulty: dFor(3), state: STATE.REVIEW, due: days(goodIvl), scheduledDays: goodIvl };
    out[4] = { stability: sEasy, difficulty: dFor(4), state: STATE.REVIEW, due: days(easyIvl), scheduledDays: easyIvl };
    return out;
  }

  // REVIEW: keep Hard < Good < Easy so the buttons always mean what they say
  let hardIvl = nextIntervalDays(sHard, retention);
  let goodIvl = nextIntervalDays(sGood, retention);
  let easyIvl = nextIntervalDays(sEasy, retention);
  hardIvl = Math.min(hardIvl, goodIvl);
  goodIvl = Math.max(goodIvl, hardIvl + 1);
  easyIvl = Math.max(easyIvl, goodIvl + 1);
  out[1] = { stability: sAgain, difficulty: dFor(1), state: STATE.RELEARNING, due: minutes(RELEARNING_STEP_MIN), scheduledDays: 0 };
  out[2] = { stability: sHard, difficulty: dFor(2), state: STATE.REVIEW, due: days(hardIvl), scheduledDays: hardIvl };
  out[3] = { stability: sGood, difficulty: dFor(3), state: STATE.REVIEW, due: days(goodIvl), scheduledDays: goodIvl };
  out[4] = { stability: sEasy, difficulty: dFor(4), state: STATE.REVIEW, due: days(easyIvl), scheduledDays: easyIvl };
  return out;
}

// Apply a rating and return the updated card (input card is not mutated)
export function scheduleCard(card, rating, now = new Date(), options = {}) {
  if (![1, 2, 3, 4].includes(rating)) throw new RangeError(`Invalid rating: ${rating}`);
  const outcome = previewSchedule(card, now, options)[rating];
  const elapsed = elapsedDaysBetween(card.last_review, now);
  const isLapse = card.state === STATE.REVIEW && rating === RATING.AGAIN;
  return {
    ...card,
    stability: outcome.stability,
    difficulty: outcome.difficulty,
    state: outcome.state,
    due: outcome.due.toISOString(),
    scheduled_days: outcome.scheduledDays,
    elapsed_days: Math.round(elapsed * 100) / 100,
    reps: card.reps + 1,
    lapses: card.lapses + (isLapse ? 1 : 0),
    last_review: now.toISOString(),
    review_history: [
      ...(card.review_history ?? []),
      { date: now.toISOString(), rating, elapsed: Math.round(elapsed * 100) / 100, state: card.state },
    ],
  };
}

// "1ph", "8ph", "3 giờ", "1ng", "4ng", "2th", "1,5 năm"
export function formatInterval(ms) {
  const min = ms / MINUTE_MS;
  if (min < 1) return '<1ph';
  if (min < 60) return `${Math.round(min)}ph`;
  const hours = min / 60;
  if (hours < 24) return `${Math.round(hours)} giờ`;
  const d = hours / 24;
  if (d < 30) return `${Math.round(d)}ng`;
  if (d < 365) return `${Math.round(d / 30)}th`;
  return `${(d / 365).toFixed(1).replace('.', ',')} năm`;
}

export function previewLabels(card, now = new Date(), options = {}) {
  const preview = previewSchedule(card, now, options);
  const labels = {};
  for (const rating of [1, 2, 3, 4]) labels[rating] = formatInterval(preview[rating].due.getTime() - now.getTime());
  return labels;
}
