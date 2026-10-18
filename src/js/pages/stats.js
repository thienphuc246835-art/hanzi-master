// Statistics (/stats) — heatmap 365, new vs review, ratings, forecast, word cloud, retention, per-mode accuracy
import { h } from '../utils/dom.js';
import { dayKey, addDays, startOfDay, formatDateVi } from '../utils/date.js';
import { MODES, RATING_LABELS, STATE } from '../core/constants.js';
import { forecast } from '../core/scheduler.js';
import { state, activityByDay, retentionRate, streakDays, knownWords } from '../core/store.js';
import { heatmap, lineChart, donut, barChart, hBarChart, wordCloud, tableView } from '../components/progress.js';

const RATING_COLORS = Object.freeze({ 1: 'var(--color-rating-1)', 2: 'var(--color-rating-2)', 3: 'var(--color-rating-3)', 4: 'var(--color-rating-4)' });
const LINE_DAYS = 30;
const FORECAST_DAYS = 30;

function statTile(label, value, sub) {
  return h('section', { class: 'card' }, h('h2', { class: 'card__title' }, label), h('div', { class: 'card__value' }, value), sub ? h('p', { class: 'muted small' }, sub) : null);
}

export function render(root) {
  const now = new Date();
  const activity = activityByDay();
  const attempts = state.attempts;
  const cards = [...state.cards.values()];
  const retention = retentionRate();

  // New vs review per day, last 30 days
  const days = Array.from({ length: LINE_DAYS }, (_, i) => addDays(startOfDay(now), i - (LINE_DAYS - 1)));
  const labels = days.map((d) => `${d.getDate()}/${d.getMonth() + 1}`);
  const newSeries = days.map((d) => activity.get(dayKey(d))?.newCards ?? 0);
  const reviewSeries = days.map((d) => activity.get(dayKey(d))?.reviews ?? 0);

  // Rating distribution (FSRS reviews only)
  const ratings = { 1: 0, 2: 0, 3: 0, 4: 0 };
  attempts.filter((a) => a.counts_for_fsrs && a.final_rating).forEach((a) => { ratings[a.final_rating]++; });

  // Accuracy per exercise mode
  // Active modes always; retired modes only if the learner has history with them
  const perMode = Object.entries(MODES).filter(([id, def]) => def.enabled || attempts.some((a) => a.mode === id)).map(([id, def]) => {
    const rows = attempts.filter((a) => a.mode === id);
    const ok = rows.filter((a) => a.correct).length;
    return { id, label: def.name, value: rows.length ? ok / rows.length : 0, count: rows.length, tooltip: rows.length ? `${def.name}: ${ok}/${rows.length} đúng` : `${def.name}: chưa làm` };
  });
  const weakest = perMode.filter((m) => m.count >= 5).sort((a, b) => a.value - b.value)[0];

  const fc = forecast(cards, now, FORECAST_DAYS);
  const cloud = cards.filter((c) => c.state !== STATE.NEW && c.stability > 0)
    .sort((a, b) => b.stability - a.stability).slice(0, 60)
    .map((c) => ({ word: state.wordsById.get(c.word_id), stability: c.stability }))
    .filter((x) => x.word);

  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Thống kê'), h('p', { class: 'page-head__sub' }, `${attempts.length} lượt làm bài từ trước đến nay`))),
    h('div', { class: 'grid grid--dash' },
      statTile('Tỷ lệ nhớ', retention.rate === null ? '—' : `${Math.round(retention.rate * 100)}%`, retention.count ? `${retention.count} lượt ôn thẻ đã thuộc` : 'Cần ôn tập thẻ đã thuộc để tính'),
      statTile('Từ đã thuộc', knownWords().length, `${cards.filter((c) => c.state !== STATE.NEW).length} từ đã bắt đầu học`),
      statTile('Chuỗi ngày', `${streakDays(now)} ngày`, `${activity.size} ngày có học`),

      h('section', { class: 'card span-3' },
        h('h2', { class: 'card__title' }, 'Lịch học 365 ngày'),
        heatmap(activity, { days: 365, now, year: true })),

      h('section', { class: 'card span-2' },
        h('h2', { class: 'card__title' }, `Từ mới và ôn tập · ${LINE_DAYS} ngày`),
        lineChart({ labels, series: [
          { name: 'Từ mới', color: 'var(--color-accent-gold)', values: newSeries },
          { name: 'Ôn tập', color: 'var(--color-accent-blue)', values: reviewSeries },
        ] }, { label: 'Số từ mới và lượt ôn mỗi ngày' }),
        tableView(['Ngày', 'Từ mới', 'Ôn tập'], days.map((d, i) => [formatDateVi(d), newSeries[i], reviewSeries[i]]))),

      h('section', { class: 'card' },
        h('h2', { class: 'card__title' }, 'Phân bố đánh giá'),
        donut([1, 2, 3, 4].map((r) => ({ label: RATING_LABELS[r], value: ratings[r], color: RATING_COLORS[r] })), { label: 'Phân bố đánh giá Lại/Khó/Tốt/Dễ' }),
        tableView(['Đánh giá', 'Số lượt'], [1, 2, 3, 4].map((r) => [RATING_LABELS[r], ratings[r]]))),

      h('section', { class: 'card span-3' },
        h('h2', { class: 'card__title' }, `Dự báo thẻ đến hạn · ${FORECAST_DAYS} ngày`),
        barChart(fc.map((b, i) => ({ label: i % 5 === 0 ? `${b.date.getDate()}/${b.date.getMonth() + 1}` : '', value: b.count, tooltip: `${formatDateVi(b.date)}: ${b.count} thẻ` })), { height: 170, label: 'Dự báo số thẻ đến hạn' }),
        tableView(['Ngày', 'Số thẻ'], fc.map((b) => [formatDateVi(b.date), b.count]))),

      h('section', { class: 'card span-2' },
        h('h2', { class: 'card__title' }, 'Độ chính xác theo dạng bài'),
        weakest ? h('p', { class: 'small', style: { color: 'var(--color-accent-gold)' } }, `Điểm yếu hiện tại: ${weakest.label} (${Math.round(weakest.value * 100)}%) — hãy luyện thêm dạng này.`) : null,
        hBarChart(perMode, { label: 'Tỷ lệ đúng theo dạng bài' }),
        tableView(['Dạng bài', 'Số lượt', 'Tỷ lệ đúng'], perMode.map((m) => [m.label, m.count, m.count ? `${Math.round(m.value * 100)}%` : '—']))),

      h('section', { class: 'card' },
        h('h2', { class: 'card__title' }, 'Đám mây từ đã học'),
        h('p', { class: 'muted small' }, 'Cỡ chữ = độ bền trí nhớ; màu vàng = đã thuộc (≥ 21 ngày).'),
        wordCloud(cloud)),
    ),
  );
  return {};
}
