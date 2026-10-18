// Lessons (/lessons/:level) — HSK level tabs + lesson cards (layout from mauweb.png)
import { h, append } from '../utils/dom.js';
import { icons } from '../utils/icons.js';
import { HSK_LEVELS, MINUTES_PER_SEGMENT } from '../core/constants.js';
import { state, lessonSegments, lessonProgress } from '../core/store.js';

const LEVEL_KEY = 'hzm.lessons.level';

function rememberLevel(level) {
  try { localStorage.setItem(LEVEL_KEY, String(level)); } catch { /* ignore */ }
}

function rememberedLevel() {
  try { return Number(localStorage.getItem(LEVEL_KEY)) || null; } catch { return null; }
}

const levelLabel = (level) => HSK_LEVELS.find((l) => l.level === level)?.label ?? `HSK ${level}`;

export function lessonMeta(lesson) {
  const segments = lessonSegments(lesson).length;
  return h('p', { class: 'lesson-card__meta' },
    h('span', {}, icons.book(), `${lesson.word_ids.length} từ`),
    h('span', {}, icons.clock(), segments > 1 ? `${segments} chặng · ~${MINUTES_PER_SEGMENT} phút/chặng` : `~${MINUTES_PER_SEGMENT} phút`));
}

export function lessonCard(lesson) {
  const p = lessonProgress(lesson);
  const done = p.learned === p.total;
  const number = String(lesson.number).padStart(2, '0');
  return h('article', { class: `lesson-card${done ? ' lesson-card--done' : ''}` },
    h('div', { class: 'lesson-card__top' },
      h('span', { class: 'lesson-card__badge' }, lesson.label.toUpperCase()),
      h('span', { class: 'lesson-card__chevron' }, icons.chevron())),
    h('h3', { class: 'lesson-card__title' },
      h('a', { class: 'lesson-card__link', href: `#/lesson/${lesson.id}` }, lesson.title_vi)),
    h('p', { class: 'lesson-card__zh', lang: 'zh-CN' }, lesson.title_zh),
    lessonMeta(lesson),
    h('div', { class: 'lesson-card__bottom' },
      h('a', { class: 'lesson-card__practice', href: `#/study?lesson=${lesson.id}` }, icons.play(), 'Luyện tập'),
      p.learned ? h('span', { class: 'lesson-card__progress', title: `${p.learned} đã học · ${p.known} đã thuộc` },
        h('span', { class: 'progress' }, h('span', { class: 'progress__fill', style: { width: `${(p.learned / p.total) * 100}%` } })),
        `${p.learned}/${p.total}`) : null),
    h('span', { class: 'lesson-card__num', 'aria-hidden': 'true' }, number),
  );
}

export function render(root, { level } = {}) {
  const available = [...new Set(state.lessons.map((l) => l.level))].sort((a, b) => a - b);
  const current = Number(level) || rememberedLevel() || state.settings.start_level || available[0];
  const lvl = available.includes(current) ? current : available[0];
  rememberLevel(lvl);
  const lessons = state.lessons.filter((l) => l.level === lvl);
  const main = lessons.filter((l) => l.kind === 'lesson');
  const extra = lessons.filter((l) => l.kind === 'extra');
  const words = lessons.reduce((s, l) => s + l.word_ids.length, 0);
  const learned = lessons.reduce((s, l) => s + lessonProgress(l).learned, 0);

  append(root, [
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', {}, 'Bài học'),
        h('p', { class: 'page-head__sub' }, `${levelLabel(lvl)} · ${main.length} bài${extra.length ? ` + ${extra.length} nhóm bổ sung` : ''} · ${words} từ · đã học ${learned}`))),
    h('nav', { class: 'level-tabs', 'aria-label': 'Chọn cấp HSK' },
      available.map((l) => h('a', {
        class: 'level-tabs__tab', href: `#/lessons/${l}`, 'aria-current': l === lvl ? 'page' : null,
      }, levelLabel(l)))),
    lvl > 3 ? h('p', { class: 'muted small' }, 'Bộ từ vựng không chia bài cho cấp này — các bài được xếp tự động theo tần suất sử dụng (từ phổ biến học trước).') : null,
    h('div', { class: 'lesson-grid' }, main.map(lessonCard)),
    extra.length ? h('h2', { class: 'mt-5', style: { marginBottom: 'var(--space-3)' } }, 'Từ vựng bổ sung') : null,
    extra.length ? h('p', { class: 'muted small', style: { marginBottom: 'var(--space-4)' } }, 'Các từ thuộc cấp này nhưng không xuất hiện trong bài khóa giáo trình, xếp theo tần suất.') : null,
    extra.length ? h('div', { class: 'lesson-grid' }, extra.map(lessonCard)) : null,
  ]);
  return {};
}
