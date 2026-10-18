// HSK 3.0 progress rings — one per level (§5.2)
import { h } from '../utils/dom.js';
import { HSK_LEVELS, HSK_BANDS } from '../core/constants.js';
import { levelProgress } from '../core/store.js';
import { ring } from './progress.js';

export function hskNavigator() {
  const progress = levelProgress();
  return h('div', { class: 'stack' },
    h('div', { class: 'rings' },
      HSK_LEVELS.map((lvl) => {
        const p = progress.get(lvl.level);
        const available = p?.total ?? 0;
        const fraction = available ? p.known / available : 0;
        const sub = available ? `${p.known}/${available} thuộc` : 'chưa có dữ liệu';
        const el = ring(fraction, { label: lvl.label, sub });
        el.title = `${lvl.label} (${HSK_BANDS[lvl.band]}) — chuẩn: ${lvl.newWords.toLocaleString('vi-VN')} từ mới · ${lvl.desc}`;
        return el;
      }),
    ),
    h('p', { class: 'muted small' }, 'Vòng tròn = số từ đã thuộc (độ bền ≥ 21 ngày) trên số từ hiện có trong dữ liệu của cấp đó.'),
  );
}
