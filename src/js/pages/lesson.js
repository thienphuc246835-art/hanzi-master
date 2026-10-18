// Lesson detail (/lesson/:id) — chặng, word list with audio, practice & reading entry points
import { h } from '../utils/dom.js';
import { icons } from '../utils/icons.js';
import { playText, stopAudio } from '../utils/audio.js';
import { HSK_LEVELS, MODES, STATE, ACTIVE_MODES } from '../core/constants.js';
import { state, lessonSegments, lessonProgress } from '../core/store.js';
import { wordBoard } from '../components/word-board.js';
import { lessonMeta } from './lessons.js';

const levelLabel = (level) => HSK_LEVELS.find((l) => l.level === level)?.label ?? `HSK ${level}`;

export function render(root, { id }) {
  const lesson = state.lessonsById.get(id);
  if (!lesson) {
    root.append(h('div', { class: 'empty' }, h('h2', {}, 'Không tìm thấy bài học'), h('a', { class: 'btn', href: '#/lessons' }, 'Danh sách bài học')));
    return {};
  }
  const words = lesson.word_ids.map((wid) => state.wordsById.get(wid)).filter(Boolean);
  const segments = lessonSegments(lesson);
  const progress = lessonProgress(lesson);
  const siblings = state.lessons.filter((l) => l.level === lesson.level);
  const idx = siblings.indexOf(lesson);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];
  const hasText = state.textsByLesson.has(lesson.id);
  let playAllCancelled = false;

  const playAll = async () => {
    playAllCancelled = false;
    for (const w of words) {
      if (playAllCancelled) return;
      const row = root.querySelector(`[data-word="${w.id}"]`);
      row?.classList.add('word-card--playing');
      await playText(w.simplified, { rate: state.settings.tts_rate });
      row?.classList.remove('word-card--playing');
      await new Promise((r) => setTimeout(r, 350));
    }
  };

  const segmentCard = (ids, i) => {
    const learned = ids.filter((wid) => { const c = state.cards.get(wid); return c && c.state !== STATE.NEW; }).length;
    return h('div', { class: 'segment' },
      h('div', {},
        h('strong', {}, segments.length > 1 ? `Chặng ${i + 1}` : 'Toàn bài'),
        h('div', { class: 'muted small', lang: 'zh-CN' }, ids.slice(0, 6).map((wid) => state.wordsById.get(wid)?.simplified).join('、'), ids.length > 6 ? '…' : ''),
        h('div', { class: 'muted small' }, `${ids.length} từ · đã học ${learned}`)),
      h('a', { class: `btn btn--small${learned < ids.length ? ' btn--primary' : ''}`, href: `#/study?lesson=${lesson.id}${segments.length > 1 ? `&seg=${i + 1}` : ''}` },
        learned < ids.length ? (learned ? 'Học tiếp' : 'Học') : 'Ôn lại'));
  };

  root.append(
    h('nav', { class: 'breadcrumb small', 'aria-label': 'Đường dẫn' },
      h('a', { href: '#/lessons' }, 'Bài học'), ' › ',
      h('a', { href: `#/lessons/${lesson.level}` }, levelLabel(lesson.level)), ' › ',
      h('span', {}, lesson.label)),
    h('section', { class: 'lesson-hero' },
      h('span', { class: 'lesson-card__badge' }, lesson.label.toUpperCase()),
      h('h1', {}, lesson.title_vi),
      h('p', { class: 'lesson-card__zh', lang: 'zh-CN' }, lesson.title_zh),
      lessonMeta(lesson),
      h('div', { class: 'row' },
        h('div', { class: 'progress', style: { flex: 1, maxWidth: '320px' }, role: 'progressbar', 'aria-valuenow': String(progress.learned), 'aria-valuemax': String(progress.total) },
          h('div', { class: 'progress__fill', style: { width: `${(progress.learned / progress.total) * 100}%` } })),
        h('span', { class: 'muted small' }, `${progress.learned}/${progress.total} đã học · ${progress.known} đã thuộc`)),
      h('div', { class: 'row' },
        h('a', { class: 'btn btn--primary', href: `#/study?lesson=${lesson.id}` }, icons.play(), 'Luyện tập'),
        h('a', { class: 'btn', href: `#/lesson/${lesson.id}/read` }, icons.read(), hasText ? 'Đọc & dịch bài khóa' : 'Luyện đọc & dịch'),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: playAll }, icons.sound(), 'Nghe cả bài')),
      h('span', { class: 'lesson-card__num', 'aria-hidden': 'true' }, String(lesson.number).padStart(2, '0'))),

    h('div', { class: 'grid grid--2 mt-5' },
      h('section', { class: 'card stack' },
        h('h2', { class: 'card__title' }, segments.length > 1 ? `${segments.length} chặng` : 'Học từ mới'),
        segments.map(segmentCard)),
      h('section', { class: 'card stack' },
        h('h2', { class: 'card__title' }, 'Luyện tập với từ của bài'),
        h('div', { class: 'practice-grid' }, ACTIVE_MODES.map((m) => h('a', { class: 'practice-tile', href: `#/practice/${m}?lesson=${lesson.id}` },
          h('span', { class: 'practice-tile__name' }, MODES[m].name),
          h('span', { class: 'practice-tile__level' }, MODES[m].desc)))))),

    h('section', { class: 'mt-5' },
      h('h2', { class: 'card__title' }, `Từ vựng (${words.length})`),
      wordBoard(words)),

    h('nav', { class: 'row row--between mt-5', 'aria-label': 'Bài trước / sau' },
      prev ? h('a', { class: 'btn btn--ghost', href: `#/lesson/${prev.id}` }, `← ${prev.label}`) : h('span'),
      next ? h('a', { class: 'btn btn--ghost', href: `#/lesson/${next.id}` }, `${next.label} →`) : h('span')),
  );

  return {
    destroy() {
      playAllCancelled = true;
      stopAudio();
    },
  };
}
