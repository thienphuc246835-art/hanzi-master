// Main entry point — boot, hash router, global keyboard, reminders, service worker
import { h, clear, $$, isTypingTarget } from './utils/dom.js';
import { toast, isModalOpen, hideTooltip } from './utils/ui.js';
import { initTts, isTtsSupported } from './utils/tts.js';
import { state, loadSettings, loadData, streakDays, studiedToday, recentRatings } from './core/store.js';
import { buildQueue } from './core/scheduler.js';
import { applyDisplaySettings } from './pages/settings.js';
import * as dashboard from './pages/dashboard.js';
import * as study from './pages/study.js';
import * as browse from './pages/browse.js';
import * as stats from './pages/stats.js';
import * as settings from './pages/settings.js';
import * as onboarding from './pages/onboarding.js';
import * as practice from './pages/practice.js';
import * as lessons from './pages/lessons.js';
import * as lessonPage from './pages/lesson.js';
import * as reading from './pages/reading.js';
import * as writing from './pages/writing.js';
import * as situations from './pages/situations.js';
import * as talk from './pages/talk.js';
import { icons } from './utils/icons.js';
import { saveSettings } from './core/store.js';

const ROUTES = [
  { pattern: /^\/$/, page: dashboard, title: 'Tổng quan' },
  { pattern: /^\/lessons(?:\/(\d))?$/, page: lessons, title: 'Bài học', nav: '/lessons', params: (m) => ({ level: m[1] }) },
  { pattern: /^\/lesson\/([\w-]+)$/, page: lessonPage, title: 'Bài học', nav: '/lessons', params: (m) => ({ id: m[1] }) },
  { pattern: /^\/lesson\/([\w-]+)\/read$/, page: reading, title: 'Đọc & dịch', nav: '/lessons', params: (m) => ({ id: m[1] }) },
  { pattern: /^\/talk$/, page: talk, title: 'Trò chuyện' },
  { pattern: /^\/situations(?:\/([\w-]+))?$/, page: situations, title: 'Tình huống', params: (m) => ({ id: m[1] }) },
  { pattern: /^\/writing$/, page: writing, title: 'Tập viết', params: (m, q) => ({ lessonId: q.get('lesson') }) },
  { pattern: /^\/study$/, page: study, title: 'Học', params: (m, q) => ({ lessonId: q.get('lesson'), segment: q.get('seg') }) },
  { pattern: /^\/browse$/, page: browse, title: 'Từ điển' },
  { pattern: /^\/stats$/, page: stats, title: 'Thống kê' },
  { pattern: /^\/settings$/, page: settings, title: 'Cài đặt' },
  { pattern: /^\/onboarding$/, page: onboarding, title: 'Thiết lập' },
  { pattern: /^\/practice\/([a-z_]+)$/, page: practice, title: 'Luyện tập', params: (m, q) => ({ mode: m[1], lessonId: q.get('lesson') }) },
];

const appEl = document.getElementById('app');
let currentView = null;

function currentPath() {
  return (location.hash.replace(/^#/, '') || '/').split('?')[0] || '/';
}

function currentQuery() {
  return new URLSearchParams(location.hash.split('?')[1] ?? '');
}

function updateTopbar() {
  const meta = document.getElementById('topbar-meta');
  if (!meta) return;
  const streak = streakDays();
  const light = state.settings.theme === 'light';
  clear(meta).append(
    h('span', { title: 'Chuỗi ngày học' }, `🔥 ${streak}`),
    h('span', { title: 'Điểm kinh nghiệm' }, `${state.profile.xp.toLocaleString('vi-VN')} XP`),
    h('button', {
      class: 'icon-btn theme-toggle', type: 'button',
      'aria-label': light ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng',
      onClick: () => { saveSettings({ theme: light ? 'dark' : 'light' }); applyDisplaySettings(); updateTopbar(); },
    }, light ? icons.moon() : icons.sun()),
  );
}

function route() {
  const path = currentPath();
  if (!state.settings.onboarded && path !== '/onboarding') {
    location.replace('#/onboarding');
    return;
  }
  const match = ROUTES.map((r) => ({ r, m: path.match(r.pattern) })).find((x) => x.m);
  if (!match) {
    location.replace('#/');
    return;
  }
  currentView?.destroy?.();
  hideTooltip();
  clear(appEl);
  const params = match.r.params?.(match.m, currentQuery()) ?? {};
  currentView = match.r.page.render(appEl, params) ?? {};
  document.title = `${match.r.title} · HànZì Master`;

  const base = `/${path.split('/')[1]}`;
  const navRoute = match.r.nav ?? (base === '/practice' ? '/' : base);
  $$('.nav__link').forEach((a) => {
    const active = a.dataset.route === navRoute;
    if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  updateTopbar();
  window.scrollTo({ top: 0 });
  appEl.focus({ preventScroll: true });
}

// Keyboard: 1–4 choose/rate, Enter confirm, Space speak (CLAUDE.md §4.2)
function onKeydown(e) {
  if (isModalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
  const target = e.target;
  if (isTypingTarget(target)) return;
  // Let native activation happen for focused buttons/links on Space
  if (e.key === ' ' && (target.tagName === 'BUTTON' || target.tagName === 'A')) return;
  if (currentView?.onKey?.(e)) e.preventDefault();
}

// Daily reminder while the app is open (§7.2)
let reminderTimer = null;
function scheduleReminder() {
  clearTimeout(reminderTimer);
  const s = state.settings;
  if (!s.reminder_enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  const [hh, mm] = s.reminder_time.split(':').map(Number);
  const now = new Date();
  const at = new Date(now);
  at.setHours(hh, mm, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  reminderTimer = setTimeout(() => {
    if (!studiedToday()) {
      const q = buildQueue({ words: state.words, cards: [...state.cards.values()], now: new Date(), settings: state.settings, recentRatings: recentRatings() });
      const count = q.due.length + q.fresh.length;
      new Notification('HànZì Master', {
        body: `Bạn có ${count} thẻ cần ôn hôm nay. Streak của bạn: ${streakDays()} ngày 🔥`,
        icon: 'src/assets/icons/icon.svg',
      });
    }
    scheduleReminder();
  }, at - now);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache unavailable */ });
}

function showBootError(error) {
  clear(appEl).append(h('div', { class: 'empty' },
    h('span', { class: 'empty__hanzi', 'aria-hidden': 'true' }, '错'),
    h('h1', {}, 'Không tải được dữ liệu'),
    h('p', {}, location.protocol === 'file:'
      ? 'Hãy mở ứng dụng qua máy chủ cục bộ (npm start) thay vì mở trực tiếp file index.html.'
      : String(error?.message ?? error)),
    h('button', { class: 'btn btn--primary', type: 'button', onClick: () => location.reload() }, 'Thử lại')));
}

async function boot() {
  loadSettings();
  applyDisplaySettings();
  try {
    await loadData();
  } catch (error) {
    showBootError(error);
    return;
  }
  state.capabilities.tts = isTtsSupported() && await initTts();
  // Recorded deck audio covers words & examples; TTS covers everything else
  state.capabilities.audio = state.capabilities.tts || state.words.some((w) => w.audio);
  state.capabilities.hanziWriter = typeof window.HanziWriter !== 'undefined';
  state.capabilities.speechRecognition = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!state.capabilities.hanziWriter) {
    // The deferred script may finish after modules: re-check once it has loaded
    window.addEventListener('load', () => { state.capabilities.hanziWriter = typeof window.HanziWriter !== 'undefined'; }, { once: true });
  }

  window.addEventListener('hashchange', route);
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('hzm:reminder', scheduleReminder);
  window.addEventListener('online', () => toast('Đã kết nối mạng'));
  window.addEventListener('offline', () => toast('Đang ngoại tuyến — dữ liệu vẫn được lưu trên máy'));
  route();
  scheduleReminder();
  registerServiceWorker();
}

boot();
