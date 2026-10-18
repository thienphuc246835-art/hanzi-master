// Study session (/study) — one task per screen
import { h, clear } from '../utils/dom.js';
import { confetti, toast } from '../utils/ui.js';
import { stopSpeaking } from '../utils/tts.js';
import { RATING_LABELS, VERDICT_EDIT_MS, HSK_LEVELS } from '../core/constants.js';
import { previewLabels } from '../core/srs.js';
import { StudySession, recordPractice } from '../core/session.js';
import { state, evaluateBadges, practicePool } from '../core/store.js';
import { createFlashcard } from '../components/flashcard.js';
import { createExercise } from '../components/exercises/index.js';

export function render(root, { lessonId = null, segment = null } = {}) {
  let session = new StudySession({ lessonId, segment: segment ? Number(segment) : null });
  const lesson = session.lesson;
  const exitHref = lesson ? `#/lesson/${lesson.id}` : '#/';
  let current = null; // { onKey, destroy }
  let verdict = null; // pending auto-rating bar

  const progressFill = h('div', { class: 'progress__fill' });
  const countEl = h('span', { class: 'study-head__count', 'aria-live': 'polite' });
  const stage = h('div', { class: 'stack' });
  const head = h('div', { class: 'study-head' },
    h('a', { class: 'icon-btn', href: exitHref, 'aria-label': 'Kết thúc phiên học' }, '✕'),
    lesson ? h('span', { class: 'chip chip--blue' }, `HSK ${lesson.level === 7 ? '7–9' : lesson.level} · ${lesson.label}${segment ? ` · chặng ${segment}` : ''}`) : null,
    h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Tiến độ phiên học' }, progressFill),
    countEl);
  const wrap = h('div', { class: 'study' }, head, stage);
  root.append(wrap);

  function updateProgress() {
    const { done, total } = session.progress;
    progressFill.style.width = total ? `${(done / total) * 100}%` : '0%';
    progressFill.parentElement.setAttribute('aria-valuenow', String(done));
    progressFill.parentElement.setAttribute('aria-valuemax', String(total));
    const minutes = Math.floor((Date.now() - session.stats.startedAt) / 60000);
    countEl.textContent = `${done}/${total} · ${minutes}/${state.settings.daily_time_goal_minutes} ph`;
  }

  function mount(view) {
    current?.destroy?.();
    stopSpeaking();
    verdict?.cancel();
    verdict = null;
    clear(stage);
    current = view;
    stage.append(view.el);
    updateProgress();
  }

  function headerText(word) {
    const lvl = HSK_LEVELS.find((l) => l.level === word.hsk_level);
    const { done, total } = session.progress;
    return `${lvl?.label ?? 'HSK'} · ${done + 1}/${total} thẻ`;
  }

  function advance() {
    const item = session.next();
    if (!item) return showSummary();
    if (item.type === 'warmup') return showWarmup();
    if (item.type === 'checkpoint') return showCheckpoint(item);
    if (item.mode === 'flashcard') {
      const view = createFlashcard({
        word: item.word,
        card: item.card,
        headerText: headerText(item.word),
        intervalLabels: previewLabels(item.card),
        onRate: async ({ rating, usedHint, responseMs }) => {
          await session.commit(item, { rating, usedHint, responseMs }, rating);
          transition();
        },
      });
      return mount(view);
    }
    const view = createExercise(item.mode, {
      word: item.word,
      card: item.card,
      recallLevel: item.recallLevel,
      pool: state.words,
      onDone: (result) => showVerdict(item, result),
    });
    mount(view);
  }

  function transition() {
    stage.firstElementChild?.classList.add('anim-slide-out');
    setTimeout(advance, 170);
  }

  // Auto-rating bar: editable for 3 seconds (§4.2.2)
  function showVerdict(item, result) {
    const suggested = session.suggestRating(item, result);
    let chosen = suggested;
    let timer = null;
    let committed = false;
    const labels = previewLabels(item.card);
    const commit = async () => {
      if (committed) return;
      committed = true;
      clearTimeout(timer);
      verdict = null;
      await session.commit(item, result, chosen);
      transition();
    };
    const buttons = [1, 2, 3, 4].map((r) => h('button', {
      type: 'button', 'aria-pressed': String(r === chosen), title: `Ôn lại sau ${labels[r]}`,
      onClick: () => {
        chosen = r;
        buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === r)));
        clearTimeout(timer);
        timer = setTimeout(commit, VERDICT_EDIT_MS);
        timerBar.replaceChildren(h('span'));
      },
    }, `${RATING_LABELS[r]} · ${labels[r]}`));
    const timerBar = h('div', { class: 'verdict__timer' }, h('span'));
    const bar = h('div', { class: 'verdict anim-pop', role: 'group', 'aria-label': 'Đánh giá tự động — có thể sửa trong 3 giây' },
      h('span', { class: 'verdict__text' }, `Đánh giá: ${RATING_LABELS[suggested]}`),
      h('div', { class: 'verdict__ratings' }, buttons),
      h('button', { class: 'btn btn--primary btn--small', type: 'button', onClick: commit }, 'Tiếp ↵'),
      timerBar);
    stage.append(bar);
    bar.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    timer = setTimeout(commit, VERDICT_EDIT_MS);
    verdict = {
      cancel: () => clearTimeout(timer),
      onKey: (e) => {
        if (e.key === 'Enter') { commit(); return true; }
        if (['1', '2', '3', '4'].includes(e.key)) { buttons[Number(e.key) - 1].click(); return true; }
        return false;
      },
    };
  }

  function showCheckpoint(item) {
    const view = createExercise('cloze_passage', {
      passage: item.passage,
      recallLevel: 2,
      pool: state.words,
      onDone: async (result) => {
        await session.commitCheckpoint(result);
        view.el.append(h('div', { class: 'center' }, h('button', { class: 'btn btn--primary', type: 'button', onClick: transition }, 'Tiếp tục học ↵')));
        current.onKey = (e) => { if (e.key === 'Enter') { transition(); return true; } return false; };
      },
    });
    view.el.prepend(h('p', { class: 'chip chip--blue' }, '📖 Checkpoint bài khóa — gặp lại các từ vừa học trong ngữ cảnh'));
    mount(view);
  }

  function showWarmup() {
    const view = createExercise('speed_round', {
      pool: practicePool(),
      recallLevel: 1,
      practice: true,
      onDone: async (result) => {
        await recordPractice({ word: null, mode: 'speed_round', recallLevel: 1, result });
        view.el.append(h('div', { class: 'center' }, h('button', { class: 'btn btn--primary', type: 'button', onClick: advance }, 'Vào bài học ↵')));
        current.onKey = (e) => { if (e.key === 'Enter') { advance(); return true; } return false; };
      },
    });
    mount(view);
  }

  function showSummary() {
    current?.destroy?.();
    current = null;
    clear(stage);
    updateProgress();
    if (session.stats.completed === 0 && lesson) {
      stage.append(h('div', { class: 'empty' },
        h('span', { class: 'empty__hanzi', 'aria-hidden': 'true' }, '好'),
        h('h2', {}, segment ? 'Chặng này không còn thẻ cần học' : 'Bài này không còn thẻ cần học hôm nay'),
        h('p', {}, 'Các từ đã được lên lịch ôn. Bạn có thể luyện đọc – dịch hoặc luyện tập thêm với từ của bài.'),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('a', { class: 'btn btn--primary', href: `#/lesson/${lesson.id}/read` }, '📖 Đọc & dịch'),
          h('a', { class: 'btn', href: `#/practice/multiple_choice?lesson=${lesson.id}` }, 'Luyện chọn đáp án'),
          h('a', { class: 'btn', href: exitHref }, 'Về bài học'))));
      return;
    }
    if (session.stats.completed === 0) {
      stage.append(h('div', { class: 'empty' },
        h('span', { class: 'empty__hanzi', 'aria-hidden': 'true' }, '静'),
        h('h2', {}, 'Hôm nay không còn thẻ nào'),
        h('p', {}, 'Bạn đã hoàn thành lịch ôn. Có thể học thêm từ mới hoặc luyện tập tự do.'),
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          h('button', { class: 'btn btn--primary', type: 'button', onClick: () => { session = new StudySession({ extraNew: 5 }); advance(); } }, '+5 từ mới'),
          h('a', { class: 'btn', href: '#/practice/multiple_choice' }, 'Luyện chọn đáp án'),
          h('a', { class: 'btn', href: '#/lessons' }, 'Đọc & dịch bài khóa'))));
      return;
    }
    const s = session.finish();
    const badges = evaluateBadges();
    const r = s.ratings;
    stage.append(h('div', { class: 'summary anim-pop' },
      h('span', { class: 'onboard__hanzi', 'aria-hidden': 'true' }, s.perfect ? '棒' : '好'),
      h('h2', {}, s.perfect ? 'Hoàn hảo! 100% nhớ đúng hôm nay' : 'Hoàn thành phiên học!'),
      h('div', { class: 'summary__stats' },
        h('div', { class: 'summary__stat' }, h('strong', {}, s.completed), 'lượt ôn'),
        h('div', { class: 'summary__stat' }, h('strong', {}, `${Math.round(s.accuracy * 100)}%`), 'nhớ đúng'),
        h('div', { class: 'summary__stat' }, h('strong', {}, `+${s.xp}`), 'XP')),
      h('p', { class: 'muted' }, `${s.newLearned} từ mới · ${s.minutes} phút · ${s.modes.size} dạng bài · Lại ${r[1]} · Khó ${r[2]} · Tốt ${r[3]} · Dễ ${r[4]}`),
      badges.length ? h('div', { class: 'badges' }, badges.map((b) => h('span', { class: 'badge' }, b.icon, ' ', b.name))) : null,
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        lesson ? h('a', { class: 'btn btn--primary', href: `#/lesson/${lesson.id}/read` }, '📖 Đọc & dịch bài') : null,
        h('a', { class: `btn${lesson ? '' : ' btn--primary'}`, href: exitHref }, lesson ? 'Về bài học' : 'Về trang chủ'),
        h('a', { class: 'btn', href: '#/stats' }, 'Xem thống kê'))));
    confetti();
    badges.forEach((b) => toast(`${b.icon} Mở khoá huy hiệu: ${b.name}`, 4000));
  }

  if (session.isEmpty) showSummary();
  else advance();

  return {
    onKey(e) {
      if (verdict?.onKey(e)) return true;
      return current?.onKey?.(e) ?? false;
    },
    destroy() {
      verdict?.cancel();
      current?.destroy?.();
      stopSpeaking();
    },
  };
}
