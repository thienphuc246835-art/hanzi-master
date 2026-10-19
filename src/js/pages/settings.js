// Settings (/settings) — personalisation (§4.3), modes (§4.2.3), display, audio, reminders, data
import { h } from '../utils/dom.js';
import { toast } from '../utils/ui.js';
import { speak, hasChineseVoice } from '../utils/tts.js';
import {
  HSK_LEVELS, DAILY_NEW_CARDS_OPTIONS, DAILY_TIME_OPTIONS, STUDY_FOCUS, MODES, RECALL_LEVEL_LABELS,
} from '../core/constants.js';
import { state, saveSettings } from '../core/store.js';
import { exportAll, importAll, resetProgress } from '../core/db.js';

export function applyDisplaySettings() {
  const rootEl = document.documentElement;
  rootEl.style.setProperty('--hanzi-scale', String(state.settings.hanzi_scale));
  rootEl.dataset.theme = state.settings.theme === 'light' ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.settings.theme === 'light' ? '#F7F3EC' : '#0D0F14');
  if (state.settings.high_contrast) rootEl.dataset.contrast = 'high';
  else delete rootEl.dataset.contrast;
}

function segmented(label, options, current, onChange) {
  const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  const buttons = options.map(([value, text]) => h('button', {
    class: 'segmented__opt', type: 'button', role: 'radio', 'aria-checked': String(value === current),
    onClick: () => {
      buttons.forEach((b) => b.setAttribute('aria-checked', String(b === buttons[options.findIndex(([v]) => v === value)])));
      onChange(value);
    },
  }, text));
  group.append(...buttons);
  return group;
}

function switchRow(label, checked, onChange, hint) {
  return h('label', { class: 'switch' },
    h('span', {}, label, hint ? h('span', { class: 'field__hint', style: { display: 'block' } }, hint) : null),
    h('input', { type: 'checkbox', role: 'switch', checked, onChange: (e) => onChange(e.target.checked, e.target) }));
}

function field(label, control, hint) {
  return h('div', { class: 'field' }, h('span', { class: 'field__label' }, label), control, hint ? h('span', { class: 'field__hint' }, hint) : null);
}

function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Luôn giữ ít nhất 1 dạng bài ở mỗi mức của Recall Ladder (§4.2.3)
function canDisable(modeId, disabled) {
  const next = new Set([...disabled, modeId]);
  for (const level of [1, 2, 3]) {
    const remaining = Object.entries(MODES).filter(([id, def]) => def.enabled && def.perCard && !def.practiceOnly && def.levels.includes(level) && !next.has(id));
    if (!remaining.length) return level;
  }
  return 0;
}

export function render(root) {
  const s = state.settings;
  const levelOpts = HSK_LEVELS.map((l) => [l.level, l.label]);

  const customNew = h('input', {
    class: 'input', type: 'number', min: 1, max: 100, value: s.daily_new_cards, style: { maxWidth: '120px' },
    'aria-label': 'Số thẻ mới mỗi ngày (tuỳ chỉnh)',
    onChange: (e) => {
      const v = Math.max(1, Math.min(100, Number(e.target.value) || 10));
      e.target.value = v;
      saveSettings({ daily_new_cards: v });
      toast('Đã lưu');
    },
  });

  const modeRows = Object.entries(MODES).filter(([, def]) => def.enabled).map(([id, def]) => switchRow(
    def.name,
    !s.disabled_modes.includes(id),
    (on, input) => {
      const disabled = new Set(state.settings.disabled_modes);
      if (!on) {
        const blocked = def.perCard ? canDisable(id, disabled) : 0;
        if (blocked) {
          input.checked = true;
          toast(`Cần giữ ít nhất 1 dạng bài mức «${RECALL_LEVEL_LABELS[blocked]}»`);
          return;
        }
        disabled.add(id);
      } else disabled.delete(id);
      saveSettings({ disabled_modes: [...disabled] });
    },
    def.desc,
  ));

  const scaleLabel = h('span', { class: 'muted small' }, `${Math.round(s.hanzi_scale * 100)}%`);
  const rateLabel = h('span', { class: 'muted small' }, `${s.tts_rate.toFixed(2)}×`);
  const fileInput = h('input', {
    type: 'file', accept: 'application/json', hidden: true,
    onChange: async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        await importAll(data);
        if (data.settings) saveSettings(data.settings);
        toast('Đã nhập dữ liệu — đang tải lại…');
        setTimeout(() => location.reload(), 800);
      } catch {
        toast('File không hợp lệ');
      }
    },
  });

  root.append(
    h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, 'Cài đặt'), h('p', { class: 'page-head__sub' }, 'Mọi thay đổi được lưu tự động trên thiết bị này.'))),
    h('div', { class: 'grid grid--2' },
      h('section', { class: 'card stack' },
        h('h2', {}, 'Mục tiêu học'),
        field('Tên hiển thị', h('input', { class: 'input', type: 'text', value: s.display_name, maxLength: 40, onChange: (e) => { saveSettings({ display_name: e.target.value.trim() }); toast('Đã lưu'); } })),
        field('Cấp HSK mục tiêu', segmented('Cấp HSK mục tiêu', levelOpts, s.target_hsk, (v) => saveSettings({ target_hsk: v, start_level: Math.min(state.settings.start_level, v) }))),
        field('Bắt đầu học từ cấp', segmented('Bắt đầu từ cấp', levelOpts, s.start_level, (v) => saveSettings({ start_level: v, target_hsk: Math.max(state.settings.target_hsk, v) }))),
        field('Thời gian học mỗi ngày', segmented('Thời gian học', DAILY_TIME_OPTIONS.map((m) => [m, `${m} phút`]), s.daily_time_goal_minutes, (v) => saveSettings({ daily_time_goal_minutes: v }))),
        field('Số thẻ mới mỗi ngày', h('div', { class: 'row' },
          segmented('Số thẻ mới', DAILY_NEW_CARDS_OPTIONS.map((n) => [n, String(n)]), s.daily_new_cards, (v) => { saveSettings({ daily_new_cards: v }); customNew.value = v; }),
          customNew), 'Hệ thống tự giảm khi tỷ lệ "Lại" > 30% và tăng khi tỷ lệ "Dễ" > 70%.'),
        field('Ưu tiên kỹ năng', segmented('Ưu tiên kỹ năng', Object.entries(STUDY_FOCUS), s.study_focus, (v) => saveSettings({ study_focus: v }))),
      ),
      h('section', { class: 'card stack' },
        h('h2', {}, 'Dạng bài tập'),
        h('p', { class: 'muted small' }, 'Phiên học luân phiên 3 dạng bài. Có thể tắt bớt, nhưng luôn giữ ít nhất 1 dạng cho mỗi mức ghi nhớ.'),
        ...modeRows,
        switchRow('Đồng hồ 10 giây cho bài chọn đáp án', s.mc_timer, (v) => saveSettings({ mc_timer: v })),
      ),
      h('section', { class: 'card stack' },
        h('h2', {}, 'Hiển thị & âm thanh'),
        field('Giao diện', segmented('Giao diện', [['dark', 'Tối (mặc định)'], ['light', 'Sáng · giấy kem']], s.theme, (v) => { saveSettings({ theme: v }); applyDisplaySettings(); })),
        switchRow('Tự phát âm', s.auto_play_audio, (v) => saveSettings({ auto_play_audio: v }), 'Phát khi thẻ từ mới xuất hiện, khi lật thẻ ôn tập, khi mở chi tiết một từ và khi mở một câu ví dụ.'),
        field(h('span', {}, 'Cỡ chữ Hán ', scaleLabel), h('input', {
          type: 'range', min: 0.8, max: 1.4, step: 0.05, value: s.hanzi_scale, 'aria-label': 'Cỡ chữ Hán',
          onInput: (e) => { saveSettings({ hanzi_scale: Number(e.target.value) }); scaleLabel.textContent = `${Math.round(e.target.value * 100)}%`; applyDisplaySettings(); },
        }), h('span', { class: 'hanzi', style: { fontSize: 'var(--size-hanzi-sm)' } }, '学习 汉语')),
        switchRow('Chế độ tương phản cao', s.high_contrast, (v) => { saveSettings({ high_contrast: v }); applyDisplaySettings(); }),
        field(h('span', {}, 'Tốc độ đọc ', rateLabel), h('input', {
          type: 'range', min: 0.5, max: 1.2, step: 0.05, value: s.tts_rate, 'aria-label': 'Tốc độ đọc',
          onInput: (e) => { saveSettings({ tts_rate: Number(e.target.value) }); rateLabel.textContent = `${Number(e.target.value).toFixed(2)}×`; },
        }), hasChineseVoice() ? 'Đã tìm thấy giọng đọc tiếng Trung.' : 'Chưa tìm thấy giọng đọc tiếng Trung — hãy cài gói giọng nói Chinese (Simplified) trong hệ điều hành.'),
        h('button', { class: 'btn', type: 'button', onClick: () => speak('你好，欢迎学习汉语。', { rate: state.settings.tts_rate }) }, '🔊 Nghe thử'),
      ),
      h('section', { class: 'card stack' },
        h('h2', {}, 'Nhắc nhở hằng ngày'),
        switchRow('Bật thông báo nhắc học', s.reminder_enabled, async (v, input) => {
          if (v && 'Notification' in window && Notification.permission !== 'granted') {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') { input.checked = false; toast('Trình duyệt chưa cho phép thông báo'); return; }
          }
          saveSettings({ reminder_enabled: v });
          window.dispatchEvent(new Event('hzm:reminder'));
        }, 'Thông báo hiện khi ứng dụng đang mở (cài đặt PWA để tiện hơn).'),
        field('Giờ nhắc', h('input', { class: 'input', type: 'time', value: s.reminder_time, style: { maxWidth: '160px' }, onChange: (e) => { saveSettings({ reminder_time: e.target.value }); window.dispatchEvent(new Event('hzm:reminder')); } })),
        h('h2', { class: 'mt-5' }, 'Dữ liệu'),
        h('div', { class: 'row' },
          h('button', {
            class: 'btn', type: 'button',
            onClick: async () => download(`hanzi-master-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ ...(await exportAll()), settings: state.settings, profile: state.profile }, null, 2), 'application/json'),
          }, '⬇️ Xuất JSON'),
          h('button', {
            class: 'btn', type: 'button',
            onClick: () => {
              const header = ['simplified', 'pinyin', 'meaning_vi', 'hsk_level', 'state', 'stability', 'difficulty', 'reps', 'lapses', 'due'];
              const rows = [...state.cards.values()].map((c) => {
                const w = state.wordsById.get(c.word_id);
                return [w?.simplified, w?.pinyin, w?.meanings[0].vi, w?.hsk_level, c.state, c.stability.toFixed(2), c.difficulty.toFixed(2), c.reps, c.lapses, c.due];
              });
              download('hanzi-master-cards.csv', `﻿${[header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\n')}`, 'text/csv');
            },
          }, '⬇️ Xuất CSV'),
          h('button', { class: 'btn', type: 'button', onClick: () => fileInput.click() }, '⬆️ Nhập JSON'),
          fileInput),
        h('button', {
          class: 'btn', type: 'button', style: { color: 'var(--color-danger)' },
          onClick: async () => {
            if (!confirm('Xoá toàn bộ tiến độ học (thẻ và lịch sử)? Không thể hoàn tác.')) return;
            await resetProgress();
            toast('Đã xoá tiến độ — đang tải lại…');
            setTimeout(() => location.reload(), 800);
          },
        }, 'Xoá tiến độ học'),
        h('p', { class: 'muted small' }, `Dữ liệu từ vựng: ${state.dataVersion ?? '—'} · ${state.words.length} từ.`),
      ),
    ),
  );
  return {};
}
