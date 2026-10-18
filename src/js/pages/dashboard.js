// Dashboard (/) — streak, today's queue, heatmap, HSK rings, forecast, practice launcher
import { h } from '../utils/dom.js';
import { dayKey, weekdayShort, formatDateVi } from '../utils/date.js';
import { hashString } from '../utils/random.js';
import { MODES, BADGES, ACTIVE_MODES } from '../core/constants.js';
import { buildQueue, forecast } from '../core/scheduler.js';
import { state, streakDays, studiedToday, activityByDay, recentRatings, retentionRate, nextLesson } from '../core/store.js';
import { lessonCard } from './lessons.js';
import { heatmap, barChart, tableView } from '../components/progress.js';
import { hskNavigator } from '../components/hsk-navigator.js';
import { tonedPinyin, primaryMeaning, speakWord } from '../components/word-detail.js';

function greeting(now) {
  const hr = now.getHours();
  if (hr < 11) return 'Chào buổi sáng';
  if (hr < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

// Word of the Day — deterministic per calendar day
function wordOfTheDay(now) {
  const { start_level: from = 1, target_hsk: to = 7 } = state.settings;
  const pool = state.words.filter((w) => w.hsk_level >= from && w.hsk_level <= Math.min(7, to + 1));
  const list = pool.length ? pool : state.words;
  if (!list.length) return null;
  return list[hashString(dayKey(now)) % list.length];
}

export function render(root) {
  const now = new Date();
  const name = state.settings.display_name;
  const queue = buildQueue({ words: state.words, cards: [...state.cards.values()], now, settings: state.settings, recentRatings: recentRatings(7, now) });
  const streak = streakDays(now);
  const today = studiedToday(now);
  const wotd = wordOfTheDay(now);
  const fc = forecast([...state.cards.values()], now, 7);
  const retention = retentionRate();
  const upcoming = nextLesson();
  // The next lesson and the two after it at the same level
  const siblingsFrom = (lesson) => {
    const same = state.lessons.filter((l) => l.level === lesson.level);
    const i = same.indexOf(lesson);
    return same.slice(i, i + 3);
  };

  const queueCount = queue.due.length + queue.fresh.length;
  const startBtn = h('a', { class: 'btn btn--primary btn--block', href: '#/study' }, queueCount ? 'Bắt đầu học' : 'Học thêm');

  root.append(
    h('div', { class: 'page-head' },
      h('div', {},
        h('h1', {}, `${greeting(now)}${name ? `, ${name}` : ''}`),
        h('p', { class: 'page-head__sub' }, `${formatDateVi(now)} · Mục tiêu ${state.settings.daily_time_goal_minutes} phút/ngày · ${state.settings.daily_new_cards} từ mới/ngày`)),
    ),
    h('div', { class: 'grid grid--dash' },
      upcoming ? h('section', { class: 'card span-3', 'aria-labelledby': 'w-next' },
        h('h2', { class: 'card__title', id: 'w-next' }, 'Bài học tiếp theo', h('a', { href: `#/lessons/${upcoming.level}`, class: 'small' }, 'Tất cả bài học →')),
        h('div', { class: 'lesson-grid' }, siblingsFrom(upcoming).map(lessonCard))) : null,
      h('section', { class: 'card', 'aria-labelledby': 'w-streak' },
        h('h2', { class: 'card__title', id: 'w-streak' }, 'Chuỗi ngày học'),
        h('div', { class: 'streak' },
          h('span', { class: `streak__flame${streak ? '' : ' streak__flame--off'}`, 'aria-hidden': 'true' }, '🔥'),
          h('div', {},
            h('div', { class: 'card__value' }, streak, h('small', {}, ' ngày')),
            h('p', { class: 'muted small' }, today ? 'Hôm nay đã học ✓' : streak ? 'Học hôm nay để giữ chuỗi!' : 'Bắt đầu chuỗi mới hôm nay'))),
        h('p', { class: 'muted small mt-4' }, `${state.profile.xp.toLocaleString('vi-VN')} XP · tỷ lệ nhớ ${retention.rate === null ? '—' : `${Math.round(retention.rate * 100)}%`}`),
      ),
      h('section', { class: 'card', 'aria-labelledby': 'w-queue' },
        h('h2', { class: 'card__title', id: 'w-queue' }, 'Hôm nay'),
        h('div', { class: 'queue' },
          h('div', {}, h('div', { class: 'queue__num queue__num--review' }, queue.due.length), h('span', { class: 'muted small' }, 'thẻ ôn tập')),
          h('div', {}, h('div', { class: 'queue__num queue__num--new' }, queue.fresh.length), h('span', { class: 'muted small' }, 'thẻ mới'))),
        queue.adaptiveReason ? h('p', { class: 'small mt-4', style: { color: 'var(--color-accent-gold)' } }, `⚙️ ${queue.adaptiveReason}`) : null,
        h('div', { class: 'mt-4' }, startBtn),
      ),
      wotd ? h('section', { class: 'card', 'aria-labelledby': 'w-wotd' },
        h('h2', { class: 'card__title', id: 'w-wotd' }, 'Từ của ngày'),
        h('div', { class: 'wotd' },
          h('button', { class: 'wotd__hanzi hanzi icon-btn', type: 'button', lang: 'zh-CN', 'aria-label': `Phát âm ${wotd.simplified}`, onClick: () => speakWord(wotd.simplified) }, wotd.simplified),
          h('div', {}, tonedPinyin(wotd), h('div', {}, primaryMeaning(wotd)), h('p', { class: 'muted small' }, `💡 ${wotd.mnemonic_summary.hint_short}`))),
      ) : null,
      h('section', { class: 'card span-2', 'aria-labelledby': 'w-heat' },
        h('h2', { class: 'card__title', id: 'w-heat' }, '60 ngày gần nhất', h('a', { href: '#/stats', class: 'small' }, 'Xem thống kê →')),
        heatmap(activityByDay(), { days: 60, now }),
      ),
      h('section', { class: 'card', 'aria-labelledby': 'w-fc' },
        h('h2', { class: 'card__title', id: 'w-fc' }, 'Dự báo 7 ngày'),
        fc.every((b) => b.count === 0) ? h('p', { class: 'muted small' }, 'Chưa có thẻ nào đến hạn — học từ mới để bắt đầu lịch ôn.') : null,
        barChart(fc.map((b, i) => ({ label: i === 0 ? 'Nay' : weekdayShort(b.date), value: b.count, tooltip: `${formatDateVi(b.date)}: ${b.count} thẻ cần ôn` })), { height: 150, label: 'Số thẻ đến hạn 7 ngày tới' }),
        tableView(['Ngày', 'Số thẻ'], fc.map((b) => [formatDateVi(b.date), b.count])),
      ),
      h('section', { class: 'card span-3', 'aria-labelledby': 'w-hsk' },
        h('h2', { class: 'card__title', id: 'w-hsk' }, 'Tiến độ HSK 3.0'),
        hskNavigator(),
      ),
      h('section', { class: 'card span-3', 'aria-labelledby': 'w-practice' },
        h('h2', { class: 'card__title', id: 'w-practice' }, 'Luyện tập tự do', h('span', { class: 'small' }, 'không ảnh hưởng lịch ôn')),
        h('div', { class: 'practice-grid' },
          ACTIVE_MODES.map((id) => h('a', {
            class: 'practice-tile', href: `#/practice/${id}`,
          }, h('span', { class: 'practice-tile__name' }, MODES[id].name), h('span', { class: 'practice-tile__level' }, MODES[id].desc)))),
      ),
      h('section', { class: 'card span-3', 'aria-labelledby': 'w-badges' },
        h('h2', { class: 'card__title', id: 'w-badges' }, 'Huy hiệu'),
        h('div', { class: 'badges' }, BADGES.map((b) => h('span', {
          class: `badge${state.profile.badges.includes(b.id) ? '' : ' badge--locked'}`, title: b.desc,
        }, h('span', { 'aria-hidden': 'true' }, b.icon), b.name, h('span', { class: 'sr-only' }, state.profile.badges.includes(b.id) ? ' (đã đạt)' : ` (chưa đạt: ${b.desc})`)))),
      ),
    ),
  );
}
