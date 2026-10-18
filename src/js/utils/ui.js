// Shared UI primitives: toast, modal, confetti, tooltip, haptics
import { h, clear } from './dom.js';

export function toast(message, ms = 2600) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const el = h('div', { class: 'toast' }, message);
  region.append(el);
  setTimeout(() => el.remove(), ms);
}

let activeModal = null;

export function openModal(content, { label = 'Hộp thoại', onClose } = {}) {
  closeModal();
  const root = document.getElementById('modal-root');
  const previousFocus = document.activeElement;
  const close = () => {
    if (!activeModal) return;
    activeModal.overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    activeModal = null;
    onClose?.();
    previousFocus?.focus?.();
  };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') trapFocus(e, dialog);
  };
  const dialog = h('div', { class: 'modal__dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': label },
    h('button', { class: 'icon-btn modal__close', 'aria-label': 'Đóng', onClick: close }, '✕'),
    content,
  );
  const overlay = h('div', { class: 'modal', onClick: (e) => { if (e.target === overlay) close(); } }, dialog);
  root.append(overlay);
  document.addEventListener('keydown', onKey, true);
  activeModal = { overlay, close };
  requestAnimationFrame(() => dialog.querySelector('button, [href], input, select, [tabindex]')?.focus());
  return close;
}

export function closeModal() {
  activeModal?.close();
}

export function isModalOpen() {
  return !!activeModal;
}

function trapFocus(e, container) {
  const focusable = [...container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// Haptics only after a real user gesture (browsers block it otherwise)
export function vibrate(pattern = 12) {
  try {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(pattern);
  } catch { /* not supported */ }
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Light confetti burst on a full-screen canvas (CLAUDE.md §2.3)
export function confetti({ particles = 120, duration = 1800 } = {}) {
  if (prefersReducedMotion()) return;
  const canvas = document.getElementById('confetti');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ['#E8B86D', '#6D9EEB', '#4CAF7D', '#F0EDE8', '#E05C5C'];
  const parts = Array.from({ length: particles }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 9,
    vy: -Math.random() * 9 - 3,
    size: 4 + Math.random() * 5,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  const frame = (t) => {
    const elapsed = t - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.25;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (elapsed < duration) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}

let tooltipEl = null;

export function showTooltip(content, x, y) {
  if (!tooltipEl) {
    tooltipEl = h('div', { class: 'chart-tooltip', role: 'tooltip' });
    document.body.append(tooltipEl);
  }
  clear(tooltipEl);
  tooltipEl.append(content instanceof Node ? content : document.createTextNode(content));
  const pad = 12;
  const rect = tooltipEl.getBoundingClientRect();
  let left = x + pad;
  let top = y - rect.height - pad;
  if (left + rect.width > innerWidth - 8) left = x - rect.width - pad;
  if (top < 8) top = y + pad;
  tooltipEl.style.left = `${Math.max(8, left)}px`;
  tooltipEl.style.top = `${top}px`;
  tooltipEl.classList.add('chart-tooltip--show');
}

export function hideTooltip() {
  tooltipEl?.classList.remove('chart-tooltip--show');
}

// Attach hover + focus tooltip to an element (mouse, touch and keyboard)
export function bindTooltip(el, getContent) {
  const show = (e) => {
    const r = el.getBoundingClientRect();
    const x = e?.clientX ?? r.left + r.width / 2;
    const y = e?.clientY ?? r.top;
    showTooltip(getContent(), x, y);
  };
  el.addEventListener('pointerenter', show);
  el.addEventListener('pointermove', show);
  el.addEventListener('pointerleave', hideTooltip);
  el.addEventListener('focus', () => show());
  el.addEventListener('blur', hideTooltip);
}
