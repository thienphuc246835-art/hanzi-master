// Shared constants — CLAUDE.md is the source of truth for every value here.

export const APP_NAME = 'HànZì Master';
export const DATA_BASE_PATH = 'src/js/data/';

// ---------- SRS (FSRS-4.5) ----------
export const STATE = Object.freeze({
  NEW: 'new',
  LEARNING: 'learning',
  REVIEW: 'review',
  RELEARNING: 'relearning',
});

export const RATING = Object.freeze({ AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 });
export const RATING_LABELS = Object.freeze({ 1: 'Lại', 2: 'Khó', 3: 'Tốt', 4: 'Dễ' });
export const RATING_KEYS_EN = Object.freeze({ 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' });

// FSRS-4.5 default parameters (17 weights)
export const FSRS_WEIGHTS = Object.freeze([
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031,
  1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
]);
export const REQUEST_RETENTION = 0.9;
export const MAXIMUM_INTERVAL_DAYS = 36500;

// Short-term steps (minutes) used before a card graduates to review
export const LEARNING_STEPS_MIN = Object.freeze({ again: 1, hard: 5, good: 10 });
export const RELEARNING_STEP_MIN = 5;
export const LEARN_AHEAD_MS = 20 * 60 * 1000;

// ---------- Personalisation (§4.3) ----------
export const DAILY_NEW_CARDS_DEFAULT = 10;
export const DAILY_NEW_CARDS_OPTIONS = [5, 10, 20];
export const DAILY_TIME_OPTIONS = [5, 10, 20, 30];
export const ADAPTIVE_MIN_SAMPLE = 20;
export const ADAPTIVE_AGAIN_THRESHOLD = 0.3;
export const ADAPTIVE_EASY_THRESHOLD = 0.7;

export const STUDY_FOCUS = Object.freeze({
  reading: 'Đọc hiểu',
  listening: 'Nghe',
  writing: 'Viết',
  speaking: 'Giao tiếp',
});

// ---------- HSK 3.0 (§8) ----------
export const HSK_BANDS = Object.freeze({
  elementary: 'Sơ cấp',
  intermediate: 'Trung cấp',
  advanced: 'Cao cấp',
});

// level 7 represents the merged 7–9 band
export const HSK_LEVELS = Object.freeze([
  { level: 1, label: 'HSK 1', band: 'elementary', newWords: 500, cumulative: 500, hanzi: 300, syllables: 269, grammar: 48, desc: 'Sinh hoạt hàng ngày cơ bản' },
  { level: 2, label: 'HSK 2', band: 'elementary', newWords: 772, cumulative: 1272, hanzi: 600, syllables: 468, grammar: 81, desc: 'Giao tiếp đơn giản' },
  { level: 3, label: 'HSK 3', band: 'elementary', newWords: 973, cumulative: 2245, hanzi: 900, syllables: 608, grammar: 81, desc: 'Ngữ cảnh quen thuộc' },
  { level: 4, label: 'HSK 4', band: 'intermediate', newWords: 1000, cumulative: 3245, hanzi: 1200, syllables: 724, grammar: 76, desc: 'Chủ đề rộng, trôi chảy hơn' },
  { level: 5, label: 'HSK 5', band: 'intermediate', newWords: 1071, cumulative: 4316, hanzi: 1500, syllables: 822, grammar: 71, desc: 'Đọc báo, xem phim' },
  { level: 6, label: 'HSK 6', band: 'intermediate', newWords: 1140, cumulative: 5456, hanzi: 1800, syllables: 908, grammar: 67, desc: 'Thành thạo, viết luận' },
  { level: 7, label: 'HSK 7–9', band: 'advanced', newWords: 5636, cumulative: 11092, hanzi: 3000, syllables: 1110, grammar: 148, desc: 'Học thuật, chuyên môn' },
]);

export const EXAMPLE_TIER_LABELS = Object.freeze({ 1: 'Cơ bản', 2: 'Mở rộng', 3: 'Nâng cao' });

// Lessons are split into "chặng" (segments) of about 12 words ≈ 10 minutes each
export const SEGMENT_SIZE = 12;
export const MINUTES_PER_SEGMENT = 10;
export const LESSON_KIND_LABELS = Object.freeze({ lesson: 'Bài', extra: 'Bổ sung' });

// ---------- Exercise modes (§4.2) ----------
// levels: recall-ladder levels the mode can serve (§4.2.1)
// perCard: can grade the current card inside a study session
// practiceOnly: never writes an FSRS review (§4.2.2)
// enabled: shown in sessions, practice and settings. Only the 3 core modes are on;
// the others stay implemented and can be switched back on here.
export const MODES = Object.freeze({
  flashcard:        { num: 1,  name: 'Lật thẻ',              levels: [1, 2, 3], perCard: true, practiceOnly: false, enabled: true, desc: 'Nhìn chữ, tự nhớ nghĩa rồi lật thẻ' },
  multiple_choice:  { num: 2,  name: 'Chọn đáp án đúng',     levels: [1, 2], perCard: true,  practiceOnly: false, enabled: true, desc: 'Chọn nghĩa / chữ Hán đúng trong 4 đáp án' },
  cloze:            { num: 3,  name: 'Điền từ',              levels: [2, 3], perCard: true,  practiceOnly: false, enabled: true, desc: 'Điền từ còn thiếu vào câu ví dụ' },
  listening:        { num: 4,  name: 'Nghe chọn chữ',        levels: [2],    perCard: true,  practiceOnly: false, enabled: false, needs: ['audio'] },
  writing:          { num: 5,  name: 'Viết chữ Hán',         levels: [3],    perCard: true,  practiceOnly: false, enabled: false, needs: ['hanziWriter'] },
  cloze_passage:    { num: 6,  name: 'Bài khóa đục lỗ',      levels: [2, 3], perCard: false, practiceOnly: false, enabled: false },
  matching:         { num: 7,  name: 'Nối cặp',              levels: [1],    perCard: true,  practiceOnly: false, enabled: false },
  sentence_builder: { num: 8,  name: 'Sắp xếp câu',          levels: [2],    perCard: true,  practiceOnly: false, enabled: false },
  tone_drill:       { num: 9,  name: 'Luyện thanh điệu',     levels: [2],    perCard: true,  practiceOnly: false, enabled: false },
  radical_assembly: { num: 10, name: 'Ghép bộ thủ',          levels: [2],    perCard: true,  practiceOnly: false, enabled: false },
  dictation:        { num: 11, name: 'Nghe chép chính tả',   levels: [3],    perCard: true,  practiceOnly: false, enabled: false, needs: ['audio'] },
  translation:      { num: 12, name: 'Dịch Việt → Trung',    levels: [3],    perCard: true,  practiceOnly: false, enabled: false },
  speaking:         { num: 13, name: 'Nói & Shadowing',      levels: [3],    perCard: false, practiceOnly: true,  enabled: false, needs: ['audio'] },
  collocation:      { num: 14, name: 'Kết hợp từ',           levels: [2],    perCard: true,  practiceOnly: false, enabled: false },
  speed_round:      { num: 15, name: 'Đúng/Sai tốc độ',      levels: [1],    perCard: false, practiceOnly: true,  enabled: false },
});

export const ACTIVE_MODES = Object.freeze(Object.keys(MODES).filter((id) => MODES[id].enabled));

export const RECALL_LEVEL_LABELS = Object.freeze({
  1: 'Nhận diện',
  2: 'Hồi tưởng có gợi ý',
  3: 'Tự tạo',
});

// §4.2.3 — preferred modes per study focus
export const FOCUS_MODES = Object.freeze({
  reading: ['cloze', 'multiple_choice', 'cloze_passage', 'collocation'],
  listening: ['flashcard', 'listening', 'tone_drill', 'dictation'],
  writing: ['cloze', 'writing', 'radical_assembly', 'translation'],
  speaking: ['flashcard', 'speaking', 'sentence_builder', 'tone_drill'],
});
export const FOCUS_WEIGHT = 3;
export const MAX_SAME_MODE_IN_A_ROW = 3;
export const CHECKPOINT_EVERY_CARDS = 10;
export const NEW_CARD_REINSERT_GAP = [3, 5];

// ---------- Timers ----------
export const MC_TIMER_MS = 10_000;
export const VERDICT_EDIT_MS = 3000;
export const SPEED_ROUND_MS = 60_000;
export const MEDIAN_SAMPLE_SIZE = 30;

// ---------- Gamification (§7) ----------
export const XP = Object.freeze({ perReview: 10, perPractice: 3, sessionBonus: 50, perfectBonus: 30 });

export const BADGES = Object.freeze([
  { id: 'streak_7', icon: '🏆', name: 'Tuần luyện thép', desc: 'Học 7 ngày liên tiếp' },
  { id: 'streak_30', icon: '🔥', name: 'Tháng bền bỉ', desc: 'Học 30 ngày liên tiếp' },
  { id: 'hsk1_done', icon: '🎓', name: 'Chứng nhận HSK 1', desc: 'Thuộc toàn bộ từ HSK 1 hiện có' },
  { id: 'retention_90', icon: '🧠', name: 'Trí nhớ thép', desc: 'Tỷ lệ nhớ ≥ 90% (tối thiểu 50 lượt ôn)' },
  { id: 'words_1000', icon: '📖', name: 'Từ điển sống', desc: 'Thuộc 1000 từ' },
]);

// A word counts as "known" once its memory is reasonably stable
export const KNOWN_STABILITY_DAYS = 21;

// ---------- Storage ----------
export const STORAGE_KEYS = Object.freeze({
  settings: 'hzm.settings',
  profile: 'hzm.profile',
});

export const DB_NAME = 'hanzi-master';
export const DB_VERSION = 1;
