// Progress charts — hand-built SVG, thin marks, hover/focus tooltips, table fallback
import { h, svg } from '../utils/dom.js';
import { bindTooltip, showTooltip, hideTooltip } from '../utils/ui.js';
import { dayKey, addDays, startOfDay, formatDateVi } from '../utils/date.js';

const HEAT_THRESHOLDS = [1, 5, 15, 30];

export function heatLevel(count) {
  let level = 0;
  HEAT_THRESHOLDS.forEach((t, i) => { if (count >= t) level = i + 1; });
  return level;
}

// GitHub-style contribution grid; columns are weeks starting Sunday
export function heatmap(activity, { days = 60, now = new Date(), year = false } = {}) {
  const end = startOfDay(now);
  const start = addDays(end, -(days - 1));
  const lead = start.getDay();
  const grid = h('div', { class: `heatmap${year ? ' heatmap--year' : ''}`, role: 'img', 'aria-label': `Lịch học ${days} ngày gần nhất` });
  for (let i = 0; i < lead; i++) grid.append(h('span', { class: 'heatmap__cell', style: { visibility: 'hidden' } }));
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const entry = activity.get(dayKey(d));
    const count = entry?.total ?? 0;
    const cell = h('span', { class: 'heatmap__cell', dataset: { level: heatLevel(count) }, tabindex: year ? null : '-1' });
    bindTooltip(cell, () => h('div', {}, h('strong', {}, formatDateVi(d)), h('div', {},
      count ? `${count} lượt · ${entry.newCards} mới · ${entry.reviews} ôn · ${entry.practice} luyện` : 'Không học')));
    grid.append(cell);
  }
  const legend = h('div', { class: 'legend', 'aria-hidden': 'true' }, 'Ít',
    [0, 1, 2, 3, 4].map((l) => h('span', { class: 'legend__swatch', style: { background: `var(--heat-${l})` } })), 'Nhiều');
  return h('div', { class: 'stack' }, year ? h('div', { class: 'heatmap-scroll' }, grid) : grid, legend);
}

export function ring(fraction, { label, sub, size = 64 } = {}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  const fill = svg('circle', { class: 'ring__fill', cx: 32, cy: 32, r, fill: 'none', 'stroke-width': 6, 'stroke-dasharray': c, 'stroke-dashoffset': c, transform: 'rotate(-90 32 32)' });
  const el = h('div', { class: 'ring' },
    svg('svg', { viewBox: '0 0 64 64', width: size, height: size, role: 'img', 'aria-label': `${label}: ${pct}%` },
      svg('circle', { class: 'ring__track', cx: 32, cy: 32, r, fill: 'none', 'stroke-width': 6 }),
      fill,
      svg('text', { class: 'ring__text', x: 32, y: 36, 'text-anchor': 'middle' }, `${pct}%`)),
    h('strong', {}, label),
    sub ? h('span', {}, sub) : null,
  );
  requestAnimationFrame(() => requestAnimationFrame(() => fill.setAttribute('stroke-dashoffset', c * (1 - pct / 100))));
  return el;
}

function roundedTopBar(x, y, w, hgt, radius = 4) {
  const r = Math.min(radius, hgt, w / 2);
  if (hgt <= 0) return '';
  return `M${x},${y + hgt} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + hgt} Z`;
}

export function tableView(headers, rows, summary = 'Xem dạng bảng') {
  return h('details', { class: 'table-view' }, h('summary', {}, summary),
    h('table', { class: 'data-table' },
      h('thead', {}, h('tr', {}, headers.map((x) => h('th', { scope: 'col' }, x)))),
      h('tbody', {}, rows.map((r) => h('tr', {}, r.map((v) => h('td', {}, v)))))));
}

// Vertical bars anchored at the baseline; value labels only on the max/selected bars
export function barChart(data, { height = 160, color = 'var(--color-accent-blue)', label = 'Biểu đồ cột', valueFormat = (v) => v } = {}) {
  const W = 600;
  const padL = 8;
  const padB = 24;
  const padT = 18;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = (W - padL * 2) / data.length;
  const bw = Math.max(4, Math.min(48, slot - 2));
  const plotH = height - padB - padT;
  const maxIdx = data.findIndex((d) => d.value === max);
  const chart = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${height}`, role: 'img', 'aria-label': label },
    svg('line', { class: 'chart__grid', x1: 0, x2: W, y1: height - padB, y2: height - padB }),
    data.map((d, i) => {
      const bh = (d.value / max) * plotH;
      const x = padL + i * slot + (slot - bw) / 2;
      const y = height - padB - bh;
      const hit = svg('rect', { class: 'chart__hit', x: padL + i * slot, y: padT, width: slot, height: plotH + padB, tabindex: '0' });
      bindTooltip(hit, () => d.tooltip ?? `${d.label}: ${valueFormat(d.value)}`);
      return svg('g', {},
        svg('path', { d: roundedTopBar(x, y, bw, bh), fill: d.color ?? color }),
        (i === maxIdx || d.showValue) && d.value > 0 ? svg('text', { class: 'chart__value', x: x + bw / 2, y: y - 5, 'text-anchor': 'middle' }, valueFormat(d.value)) : null,
        svg('text', { x: x + bw / 2, y: height - 7, 'text-anchor': 'middle' }, d.label),
        hit);
    }),
  );
  return chart;
}

// Multi-series line chart with crosshair tooltip
export function lineChart({ labels, series }, { height = 200, label = 'Biểu đồ đường' } = {}) {
  const W = 600;
  const padL = 28;
  const padR = 8;
  const padT = 12;
  const padB = 24;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const n = labels.length;
  const x = (i) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v) => padT + (1 - v / max) * (height - padT - padB);
  const ticks = [0, Math.round(max / 2), max];
  const cross = svg('line', { class: 'chart__grid', x1: 0, x2: 0, y1: padT, y2: height - padB, visibility: 'hidden' });
  const dots = series.map((s) => svg('circle', { r: 4, fill: s.color, stroke: 'var(--color-surface)', 'stroke-width': 2, visibility: 'hidden' }));
  const chart = svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${height}`, role: 'img', 'aria-label': label },
    ticks.map((t) => svg('g', {},
      svg('line', { class: 'chart__grid', x1: padL, x2: W - padR, y1: y(t), y2: y(t), 'stroke-dasharray': t ? '2 4' : null }),
      svg('text', { x: padL - 6, y: y(t) + 4, 'text-anchor': 'end' }, t))),
    labels.map((l, i) => (i % Math.ceil(n / 6) === 0 || i === n - 1) ? svg('text', { x: x(i), y: height - 7, 'text-anchor': 'middle' }, l) : null),
    series.map((s) => svg('polyline', { points: s.values.map((v, i) => `${x(i)},${y(v)}`).join(' '), fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })),
    cross, dots,
  );
  const overlay = svg('rect', { class: 'chart__hit', x: padL, y: padT, width: W - padL - padR, height: height - padT - padB });
  overlay.addEventListener('pointermove', (e) => {
    const rect = chart.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((vx - padL) / (W - padL - padR)) * (n - 1))));
    cross.setAttribute('x1', x(i));
    cross.setAttribute('x2', x(i));
    cross.setAttribute('visibility', 'visible');
    dots.forEach((d, si) => { d.setAttribute('cx', x(i)); d.setAttribute('cy', y(series[si].values[i])); d.setAttribute('visibility', 'visible'); });
    showTooltip(h('div', {}, h('strong', {}, labels[i]),
      series.map((s) => h('div', {}, h('span', { class: 'legend__swatch', style: { background: s.color } }), `${s.name}: ${s.values[i]}`))), e.clientX, e.clientY);
  });
  overlay.addEventListener('pointerleave', () => {
    cross.setAttribute('visibility', 'hidden');
    dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
    hideTooltip();
  });
  chart.append(overlay);
  const legend = h('div', { class: 'legend' }, series.map((s) => h('span', {}, h('span', { class: 'legend__swatch', style: { background: s.color } }), s.name)));
  return h('div', { class: 'stack' }, legend, chart);
}

// Donut with legend + direct value labels (identity never by color alone)
export function donut(segments, { label = 'Biểu đồ tròn', centerText = '' } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 70;
  const r = 46;
  const cx = 90;
  const cy = 90;
  let angle = -Math.PI / 2;
  const gap = total > 0 && segments.filter((s) => s.value).length > 1 ? 0.03 : 0;
  const arcs = segments.map((s) => {
    if (!total || !s.value) return null;
    const sweep = (s.value / total) * Math.PI * 2;
    const a0 = angle + gap / 2;
    const a1 = angle + sweep - gap / 2;
    angle += sweep;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad, a) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
    const d = sweep >= Math.PI * 2 - 0.001
      ? `M${cx - R},${cy} A${R},${R} 0 1 1 ${cx + R},${cy} A${R},${R} 0 1 1 ${cx - R},${cy} M${cx - r},${cy} A${r},${r} 0 1 0 ${cx + r},${cy} A${r},${r} 0 1 0 ${cx - r},${cy}`
      : `M${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${large} 0 ${p(r, a0)} Z`;
    const path = svg('path', { d, fill: s.color, 'fill-rule': 'evenodd', tabindex: '0' });
    bindTooltip(path, () => `${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`);
    return path;
  });
  const chart = svg('svg', { class: 'chart', viewBox: '0 0 180 180', role: 'img', 'aria-label': label, style: 'max-width:200px;margin:0 auto' },
    total ? arcs : svg('circle', { cx, cy, r: (R + r) / 2, fill: 'none', stroke: 'var(--color-surface-raised)', 'stroke-width': R - r }),
    svg('text', { class: 'chart__value', x: cx, y: cy + 5, 'text-anchor': 'middle', style: 'font-size:18px' }, centerText || total));
  const legend = h('div', { class: 'legend', style: { justifyContent: 'center' } },
    segments.map((s) => h('span', {}, h('span', { class: 'legend__swatch', style: { background: s.color } }),
      `${s.label} ${total ? Math.round((s.value / total) * 100) : 0}%`)));
  return h('div', { class: 'stack' }, chart, legend);
}

// Horizontal bars for accuracy per exercise mode (0..1)
export function hBarChart(data, { label = 'Biểu đồ thanh ngang' } = {}) {
  const rowH = 26;
  const W = 600;
  const labelW = 170;
  const height = data.length * rowH + 4;
  return svg('svg', { class: 'chart', viewBox: `0 0 ${W} ${height}`, role: 'img', 'aria-label': label },
    data.map((d, i) => {
      const y = i * rowH + 4;
      const bw = Math.max(0, d.value) * (W - labelW - 60);
      const hit = svg('rect', { class: 'chart__hit', x: 0, y, width: W, height: rowH, tabindex: '0' });
      bindTooltip(hit, () => d.tooltip);
      return svg('g', {},
        svg('text', { x: 0, y: y + 15 }, d.label),
        svg('rect', { x: labelW, y: y + 5, width: W - labelW - 60, height: 12, rx: 4, fill: 'var(--color-surface-raised)' }),
        d.count ? svg('rect', { x: labelW, y: y + 5, width: bw, height: 12, rx: 4, fill: 'var(--color-accent-gold)' }) : null,
        svg('text', { class: 'chart__value', x: W - 4, y: y + 15, 'text-anchor': 'end' }, d.count ? `${Math.round(d.value * 100)}%` : '—'),
        hit);
    }));
}

export function wordCloud(items) {
  if (!items.length) return h('p', { class: 'muted small' }, 'Chưa có từ nào đủ độ bền để hiển thị.');
  const maxS = Math.max(...items.map((i) => i.stability));
  return h('div', { class: 'row', style: { justifyContent: 'center', gap: '0.5rem 1rem' } },
    items.map((i) => {
      const size = 1 + (i.stability / maxS) * 1.8;
      const el = h('span', { class: 'hanzi', tabindex: '0', style: { fontSize: `${size}rem`, color: i.stability >= 21 ? 'var(--color-accent-gold)' : 'var(--color-text-secondary)' } }, i.word.simplified);
      bindTooltip(el, () => `${i.word.simplified} ${i.word.pinyin} — độ bền ${i.stability.toFixed(1)} ngày`);
      return el;
    }));
}
