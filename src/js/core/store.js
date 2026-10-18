// App state: data, settings, profile, cards and attempts (IndexedDB + localStorage)
import {
  STORAGE_KEYS, DATA_BASE_PATH, DAILY_NEW_CARDS_DEFAULT, MEDIAN_SAMPLE_SIZE,
  STATE, RATING, XP, BADGES, KNOWN_STABILITY_DAYS, SEGMENT_SIZE,
} from './constants.js';
import { db, setMeta, getMeta } from './db.js';
import { median } from './grader.js';
import { dayKey, addDays, startOfDay } from '../utils/date.js';
import { setAudioIndex } from '../utils/audio.js';

export const DEFAULT_SETTINGS = Object.freeze({
  display_name: '',
  target_hsk: 1,
  start_level: 1,
  daily_new_cards: DAILY_NEW_CARDS_DEFAULT,
  daily_time_goal_minutes: 10,
  study_focus: 'reading',
  disabled_modes: [],
  mc_timer: true,
  warmup_speed_round: false,
  hanzi_scale: 1,
  high_contrast: false,
  theme: 'dark',
  auto_play_audio: true,
  tts_rate: 0.85,
  reminder_enabled: false,
  reminder_time: '07:30',
  onboarded: false,
});

const DEFAULT_PROFILE = Object.freeze({
  xp: 0,
  badges: [],
  favorites: [],
  records: { matching_ms: null, speed_round: null },
  created_at: null,
});

export const state = {
  words: [],
  wordsById: new Map(),
  hanzi: {},
  lessons: [],
  lessonsById: new Map(),
  texts: [],
  textsByLesson: new Map(),
  passages: [],
  collocations: [],
  radicals: [],
  radicalsByNo: new Map(),
  cards: new Map(),
  attempts: [],
  settings: { ...DEFAULT_SETTINGS },
  profile: structuredClone(DEFAULT_PROFILE),
  capabilities: { tts: false, audio: false, hanziWriter: false, speechRecognition: false },
  dataVersion: null,
};

// ---------- localStorage (wrapped: storage may be unavailable) ----------
function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : { ...fallback };
  } catch {
    return { ...fallback };
  }
}

function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export function loadSettings() {
  state.settings = readLocal(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  state.profile = readLocal(STORAGE_KEYS.profile, structuredClone(DEFAULT_PROFILE));
  state.profile.records = { ...DEFAULT_PROFILE.records, ...state.profile.records };
  if (!state.profile.created_at) {
    state.profile.created_at = new Date().toISOString();
    saveProfile();
  }
}

export function saveSettings(patch = {}) {
  Object.assign(state.settings, patch);
  writeLocal(STORAGE_KEYS.settings, state.settings);
}

export function saveProfile(patch = {}) {
  Object.assign(state.profile, patch);
  writeLocal(STORAGE_KEYS.profile, state.profile);
}

// ---------- Data loading (offline-first) ----------
async function fetchJson(file) {
  const res = await fetch(DATA_BASE_PATH + file);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.json();
}

// Attach per-character data (radical, mnemonic…) from hanzi.json to each word
function hydrateWord(word, hanzi) {
  if (word.characters) return word;
  const chars = [...word.simplified];
  const seen = new Set();
  word.characters = [];
  chars.forEach((c, i) => {
    if (seen.has(c) || !hanzi[c]) return;
    seen.add(c);
    word.characters.push({ ...hanzi[c], pinyin: word.char_pinyin?.[i] ?? '' });
  });
  return word;
}

// Duplicate words were merged on import: move their progress to the surviving entry
// (keeping the existing card if both were studied) and drop the orphans
async function migrateMergedCards(cards) {
  const mergedInto = new Map();
  for (const w of state.words) for (const id of w.merged_ids ?? []) mergedInto.set(id, w.id);
  for (const card of cards) {
    if (state.wordsById.has(card.word_id)) continue;
    const target = mergedInto.get(card.word_id);
    if (target && !state.cards.has(target)) {
      const moved = { ...card, word_id: target };
      state.cards.set(target, moved);
      await db.put('cards', moved);
    }
    await db.delete('cards', card.word_id);
  }
}

export async function loadData() {
  // Offline: the service worker serves cached copies of these files
  const manifest = await fetchJson('manifest.json');
  const optional = (file) => (file ? fetchJson(file).catch(() => null) : Promise.resolve(null));
  const [vocab, hanzi, lessons, texts, passages, collocations, radicals] = await Promise.all([
    Promise.all(manifest.vocab.map(fetchJson)).then((x) => x.flat()),
    optional(manifest.hanzi),
    optional(manifest.lessons),
    Promise.all((manifest.texts ?? []).map((f) => fetchJson(f).catch(() => []))).then((x) => x.flat()),
    Promise.all(manifest.passages.map(fetchJson)).then((x) => x.flat()),
    fetchJson(manifest.collocations),
    fetchJson(manifest.radicals),
  ]);
  state.words = vocab.map((w) => hydrateWord(w, hanzi ?? {}));
  state.hanzi = hanzi ?? {};
  state.lessons = lessons ?? [];
  state.texts = texts;
  state.passages = passages;
  state.collocations = collocations;
  state.radicals = radicals;
  state.dataVersion = manifest.version;
  if ((await getMeta('data_version')) !== manifest.version) await setMeta('data_version', manifest.version);

  state.wordsById = new Map(state.words.map((w) => [w.id, w]));
  state.radicalsByNo = new Map(state.radicals.map((r) => [r.no, r]));
  state.lessonsById = new Map(state.lessons.map((l) => [l.id, l]));
  state.textsByLesson = new Map(state.texts.map((t) => [t.lesson_id, t]));

  // Text → recorded audio file (words and example sentences)
  const audioIndex = new Map();
  for (const w of state.words) {
    if (w.audio && !audioIndex.has(w.simplified)) audioIndex.set(w.simplified, w.audio);
    for (const e of w.examples) if (e.audio && !audioIndex.has(e.zh)) audioIndex.set(e.zh, e.audio);
  }
  setAudioIndex(audioIndex);

  const [cards, attempts] = await Promise.all([db.getAll('cards'), db.getAll('attempts')]);
  state.cards = new Map(cards.filter((c) => state.wordsById.has(c.word_id)).map((c) => [c.word_id, c]));
  await migrateMergedCards(cards);
  state.attempts = attempts.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// ---------- Cards & attempts ----------
export async function saveCard(card) {
  state.cards.set(card.word_id, card);
  await db.put('cards', card);
}

export async function recordAttempt(attempt) {
  const row = { ...attempt, timestamp: attempt.timestamp ?? new Date().toISOString() };
  row.id = await db.add('attempts', row);
  state.attempts.push(row);
  return row;
}

export function medianResponseMs(mode) {
  const times = [];
  for (let i = state.attempts.length - 1; i >= 0 && times.length < MEDIAN_SAMPLE_SIZE; i--) {
    const a = state.attempts[i];
    if (a.mode === mode && a.correct && Number.isFinite(a.response_ms)) times.push(a.response_ms);
  }
  return times.length >= 5 ? median(times) : null;
}

export function recentRatings(days = 7, now = new Date()) {
  const since = addDays(now, -days).toISOString();
  return state.attempts.filter((a) => a.counts_for_fsrs && a.timestamp >= since).map((a) => a.final_rating);
}

// ---------- Derived statistics ----------
export function activityByDay() {
  const map = new Map();
  for (const a of state.attempts) {
    const key = dayKey(a.timestamp);
    const entry = map.get(key) ?? { total: 0, reviews: 0, newCards: 0, practice: 0 };
    entry.total++;
    if (!a.counts_for_fsrs) entry.practice++;
    else if (a.state_before === STATE.NEW) entry.newCards++;
    else entry.reviews++;
    map.set(key, entry);
  }
  return map;
}

export function streakDays(now = new Date()) {
  const days = activityByDay();
  let cursor = startOfDay(now);
  if (!days.has(dayKey(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function studiedToday(now = new Date()) {
  return activityByDay().has(dayKey(now));
}

// % of review-state FSRS checks answered correctly
export function retentionRate() {
  const reviews = state.attempts.filter((a) => a.counts_for_fsrs && a.state_before === STATE.REVIEW);
  if (!reviews.length) return { rate: null, count: 0 };
  const ok = reviews.filter((a) => a.final_rating > RATING.AGAIN).length;
  return { rate: ok / reviews.length, count: reviews.length };
}

export function knownWords() {
  return [...state.cards.values()].filter((c) => c.state === STATE.REVIEW && c.stability >= KNOWN_STABILITY_DAYS);
}

export function learnedCards() {
  return [...state.cards.values()].filter((c) => c.state !== STATE.NEW);
}

export function levelProgress() {
  const out = new Map();
  for (const w of state.words) {
    const entry = out.get(w.hsk_level) ?? { total: 0, learned: 0, known: 0 };
    entry.total++;
    const c = state.cards.get(w.id);
    if (c && c.state !== STATE.NEW) entry.learned++;
    if (c && c.state === STATE.REVIEW && c.stability >= KNOWN_STABILITY_DAYS) entry.known++;
    out.set(w.hsk_level, entry);
  }
  return out;
}

// ---------- Lessons ----------
export function lessonSegments(lesson) {
  const ids = lesson.word_ids;
  if (ids.length <= SEGMENT_SIZE) return [ids];
  const count = Math.ceil(ids.length / SEGMENT_SIZE);
  const size = Math.ceil(ids.length / count);
  return Array.from({ length: count }, (_, i) => ids.slice(i * size, (i + 1) * size));
}

export function lessonProgress(lesson) {
  let learned = 0;
  let known = 0;
  for (const id of lesson.word_ids) {
    const c = state.cards.get(id);
    if (c && c.state !== STATE.NEW) learned++;
    if (c && c.state === STATE.REVIEW && c.stability >= KNOWN_STABILITY_DAYS) known++;
  }
  return { learned, known, total: lesson.word_ids.length };
}

// First lesson in the learner's range that still has unlearned words
export function nextLesson() {
  const { start_level: from = 1, target_hsk: to = 7 } = state.settings;
  return state.lessons.find((l) => l.level >= from && l.level <= to && lessonProgress(l).learned < l.word_ids.length) ?? null;
}

// ---------- Favorites ----------
export function isFavorite(wordId) {
  return state.profile.favorites.includes(wordId);
}

export function toggleFavorite(wordId) {
  const favs = new Set(state.profile.favorites);
  if (favs.has(wordId)) favs.delete(wordId); else favs.add(wordId);
  saveProfile({ favorites: [...favs] });
  return favs.has(wordId);
}

// ---------- Gamification ----------
export function addXp(amount) {
  saveProfile({ xp: state.profile.xp + amount });
}

export function evaluateBadges() {
  const owned = new Set(state.profile.badges);
  const unlocked = [];
  const streak = streakDays();
  const retention = retentionRate();
  const known = knownWords().length;
  const lvl1 = levelProgress().get(1);
  const checks = {
    streak_7: streak >= 7,
    streak_30: streak >= 30,
    hsk1_done: !!lvl1 && lvl1.total > 0 && lvl1.known === lvl1.total,
    retention_90: retention.count >= 50 && retention.rate >= 0.9,
    words_1000: known >= 1000,
  };
  for (const badge of BADGES) {
    if (checks[badge.id] && !owned.has(badge.id)) {
      owned.add(badge.id);
      unlocked.push(badge);
    }
  }
  if (unlocked.length) saveProfile({ badges: [...owned] });
  return unlocked;
}

export function xpForAttempt(countsForFsrs) {
  return countsForFsrs ? XP.perReview : XP.perPractice;
}

// Words the user has started learning — used as the pool for practice & distractors
export function practicePool() {
  const learned = state.words.filter((w) => {
    const c = state.cards.get(w.id);
    return c && c.state !== STATE.NEW;
  });
  return learned.length >= 5 ? learned : state.words;
}
