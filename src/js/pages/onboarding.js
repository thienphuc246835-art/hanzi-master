// Onboarding (/onboarding) — one question per screen
import { h, clear } from '../utils/dom.js';
import { HSK_LEVELS, DAILY_NEW_CARDS_OPTIONS, DAILY_TIME_OPTIONS, STUDY_FOCUS, APP_NAME } from '../core/constants.js';
import { state, saveSettings, levelProgress } from '../core/store.js';

export function render(root) {
  const draft = { ...state.settings };
  const available = levelProgress();
  let step = 0;
  const box = h('div', { class: 'onboard' });
  root.append(box);

  const choiceGroup = (label, options, key, { onPick } = {}) => {
    const buttons = options.map(([value, text, sub]) => h('button', {
      class: 'choice', type: 'button', role: 'radio', 'aria-checked': String(draft[key] === value),
      onClick: () => {
        draft[key] = value;
        buttons.forEach((b, i) => b.setAttribute('aria-checked', String(options[i][0] === value)));
        onPick?.(value);
      },
    }, text, sub ? h('small', {}, sub) : null));
    return h('div', { class: 'choice-grid', role: 'radiogroup', 'aria-label': label }, buttons);
  };

  const levelOptions = HSK_LEVELS.map((l) => [l.level, l.label, available.get(l.level)?.total ? `${available.get(l.level).total} từ có sẵn` : `${l.newWords} từ`]);

  const steps = [
    () => [
      h('div', { class: 'onboard__hero' },
        h('span', { class: 'onboard__hanzi', 'aria-hidden': 'true' }, '学'),
        h('h1', {}, `Chào mừng đến ${APP_NAME}`),
        h('p', { class: 'muted' }, 'Học ít, nhớ nhiều — Chinh phục HSK từng bước.'),
        h('p', { class: 'small muted' }, '11.000+ từ HSK 3.0 có audio · Học theo bài giáo trình · Lịch ôn FSRS-4.5 · Lật thẻ, chọn đáp án, điền từ')),
      h('label', { class: 'field' }, h('span', { class: 'field__label' }, 'Bạn muốn được gọi là gì?'),
        h('input', { class: 'input', type: 'text', value: draft.display_name, maxLength: 40, placeholder: 'Tên của bạn (không bắt buộc)', onInput: (e) => { draft.display_name = e.target.value.trim(); } })),
    ],
    () => [
      h('h2', {}, 'Mục tiêu của bạn là cấp HSK nào?'),
      choiceGroup('Cấp HSK mục tiêu', levelOptions, 'target_hsk', { onPick: (v) => { if (draft.start_level > v) draft.start_level = v; } }),
      h('h2', { class: 'mt-4' }, 'Bạn bắt đầu học từ cấp nào?'),
      choiceGroup('Bắt đầu từ cấp', levelOptions, 'start_level', { onPick: (v) => { if (draft.target_hsk < v) draft.target_hsk = v; } }),
      h('p', { class: 'muted small' }, 'Dữ liệu mẫu hiện có HSK 1; các cấp khác sẽ được bổ sung dần.'),
    ],
    () => [
      h('h2', {}, 'Mỗi ngày bạn học bao lâu?'),
      choiceGroup('Thời gian học', DAILY_TIME_OPTIONS.map((m) => [m, `${m} phút`]), 'daily_time_goal_minutes'),
      h('h2', { class: 'mt-4' }, 'Bao nhiêu từ mới mỗi ngày?'),
      choiceGroup('Số thẻ mới', DAILY_NEW_CARDS_OPTIONS.map((n) => [n, `${n} từ`, n === 10 ? 'khuyên dùng' : null]), 'daily_new_cards'),
    ],
    () => [
      h('h2', {}, 'Bạn muốn ưu tiên kỹ năng nào?'),
      h('p', { class: 'muted small' }, 'Các dạng bài phù hợp sẽ xuất hiện thường xuyên hơn.'),
      choiceGroup('Ưu tiên kỹ năng', Object.entries(STUDY_FOCUS), 'study_focus'),
    ],
  ];

  function renderStep() {
    clear(box);
    const isLast = step === steps.length - 1;
    box.append(
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': String(step + 1), 'aria-valuemax': String(steps.length), 'aria-label': 'Tiến độ thiết lập' },
        h('div', { class: 'progress__fill', style: { width: `${((step + 1) / steps.length) * 100}%` } })),
      h('div', { class: 'stack anim-slide-in' }, steps[step]()),
      h('div', { class: 'row row--between' },
        step ? h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => { step--; renderStep(); } }, '← Quay lại') : h('span'),
        h('button', { class: 'btn btn--primary', type: 'button', onClick: next }, isLast ? 'Bắt đầu học →' : 'Tiếp tục →')),
    );
    box.querySelector('input, .choice[aria-checked="true"], .btn--primary')?.focus({ preventScroll: true });
  }

  function next() {
    if (step < steps.length - 1) {
      step++;
      renderStep();
      return;
    }
    saveSettings({ ...draft, onboarded: true });
    location.hash = '#/';
  }

  renderStep();
  return {
    onKey(e) {
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { next(); return true; }
      return false;
    },
  };
}
