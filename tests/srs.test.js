import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCard, scheduleCard, previewSchedule, retrievability, nextIntervalDays,
  initStability, initDifficulty, formatInterval,
} from '../src/js/core/srs.js';
import { FSRS_WEIGHTS, STATE } from '../src/js/core/constants.js';

const NOW = new Date('2026-10-18T08:00:00Z');
const DAY = 86_400_000;
const at = (days) => new Date(NOW.getTime() + days * DAY);

test('retrievability equals request retention when elapsed = stability', () => {
  assert.ok(Math.abs(retrievability(10, 10) - 0.9) < 1e-9);
  assert.equal(retrievability(0, 5), 1);
});

test('next interval equals stability at 90% retention', () => {
  assert.equal(nextIntervalDays(3.7145), 4);
  assert.equal(nextIntervalDays(13.8206), 14);
  assert.equal(nextIntervalDays(0.01), 1, 'never below 1 day');
});

test('initial stability and difficulty follow FSRS-4.5 weights', () => {
  assert.equal(initStability(3), FSRS_WEIGHTS[2]);
  assert.equal(initDifficulty(3), FSRS_WEIGHTS[4]);
  assert.ok(initDifficulty(1) > initDifficulty(4), 'Again is harder than Easy');
});

test('new card: Again/Hard/Good stay in learning, Easy graduates', () => {
  const card = createCard('w1', NOW);
  const p = previewSchedule(card, NOW);
  assert.equal(p[1].state, STATE.LEARNING);
  assert.equal(p[1].due.getTime() - NOW.getTime(), 60_000);
  assert.equal(p[3].state, STATE.LEARNING);
  assert.equal(p[4].state, STATE.REVIEW);
  assert.equal(p[4].scheduledDays, 14);
});

test('learning → Good graduates to review with S0(Good)', () => {
  let card = scheduleCard(createCard('w1', NOW), 3, NOW);
  const later = new Date(NOW.getTime() + 10 * 60_000);
  card = scheduleCard(card, 3, later);
  assert.equal(card.state, STATE.REVIEW);
  assert.ok(Math.abs(card.stability - FSRS_WEIGHTS[2]) < 0.05, 'same-day review keeps stability ≈ S0');
  assert.equal(card.reps, 2);
});

test('review intervals are ordered Hard < Good < Easy and stability grows on success', () => {
  const card = { ...createCard('w1', NOW), state: STATE.REVIEW, stability: 10, difficulty: 5, last_review: NOW.toISOString(), due: at(10).toISOString(), reps: 3 };
  const p = previewSchedule(card, at(10));
  assert.ok(p[2].scheduledDays < p[3].scheduledDays);
  assert.ok(p[3].scheduledDays < p[4].scheduledDays);
  assert.ok(p[3].stability > 10);
  assert.ok(p[1].stability < 10, 'forgetting lowers stability');
});

test('lapse: Again on a review card → relearning, lapses+1', () => {
  const card = { ...createCard('w1', NOW), state: STATE.REVIEW, stability: 10, difficulty: 5, last_review: NOW.toISOString(), due: at(10).toISOString(), reps: 3 };
  const next = scheduleCard(card, 1, at(10));
  assert.equal(next.state, STATE.RELEARNING);
  assert.equal(next.lapses, 1);
  assert.equal(next.review_history.length, 1);
});

test('difficulty stays within [1, 10] after many ratings', () => {
  let card = createCard('w1', NOW);
  let t = NOW;
  for (let i = 0; i < 30; i++) {
    t = new Date(t.getTime() + DAY);
    card = scheduleCard(card, 1, t);
  }
  assert.ok(card.difficulty >= 1 && card.difficulty <= 10);
  for (let i = 0; i < 30; i++) {
    t = new Date(t.getTime() + 30 * DAY);
    card = scheduleCard(card, 4, t);
  }
  assert.ok(card.difficulty >= 1 && card.difficulty <= 10);
});

test('scheduleCard does not mutate its input', () => {
  const card = createCard('w1', NOW);
  const copy = structuredClone(card);
  scheduleCard(card, 3, NOW);
  assert.deepEqual(card, copy);
});

test('formatInterval produces short Vietnamese labels', () => {
  assert.equal(formatInterval(60_000), '1ph');
  assert.equal(formatInterval(8 * 60_000), '8ph');
  assert.equal(formatInterval(DAY), '1ng');
  assert.equal(formatInterval(4 * DAY), '4ng');
  assert.equal(formatInterval(60 * DAY), '2th');
});
