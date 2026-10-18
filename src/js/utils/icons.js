// Small outline icons (stroke = currentColor) used on lesson cards
import { svg } from './dom.js';

const base = (children) => svg('svg', {
  viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor',
  'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icon',
}, children);

export const icons = {
  book: () => base([
    svg('path', { d: 'M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z' }),
    svg('path', { d: 'M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z' }),
  ]),
  clock: () => base([svg('circle', { cx: 12, cy: 12, r: 9 }), svg('path', { d: 'M12 7v5l3 2' })]),
  play: () => base([svg('circle', { cx: 12, cy: 12, r: 9 }), svg('path', { d: 'M10 8.5v7l6-3.5z', fill: 'currentColor', stroke: 'none' })]),
  chevron: () => base([svg('path', { d: 'M9 6l6 6-6 6' })]),
  sound: () => base([svg('path', { d: 'M4 9v6h4l5 4V5L8 9z' }), svg('path', { d: 'M17 9a4 4 0 0 1 0 6' })]),
  read: () => base([svg('path', { d: 'M4 19V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z' }), svg('path', { d: 'M8 7h6M8 11h6' })]),
  check: () => base([svg('circle', { cx: 12, cy: 12, r: 9 }), svg('path', { d: 'M8 12.5l2.5 2.5L16 9.5' })]),
  heart: () => base([svg('path', { d: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z' })]),
  search: () => base([svg('circle', { cx: 11, cy: 11, r: 7 }), svg('path', { d: 'M20 20l-3.5-3.5' })]),
  eye: () => base([svg('path', { d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z' }), svg('circle', { cx: 12, cy: 12, r: 3 })]),
  eyeOff: () => base([svg('path', { d: 'M3 3l18 18' }), svg('path', { d: 'M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6' }), svg('path', { d: 'M9.9 9.9a3 3 0 0 0 4.2 4.2' })]),
  grid: () => base([svg('rect', { x: 4, y: 4, width: 7, height: 7, rx: 1 }), svg('rect', { x: 13, y: 4, width: 7, height: 7, rx: 1 }), svg('rect', { x: 4, y: 13, width: 7, height: 7, rx: 1 }), svg('rect', { x: 13, y: 13, width: 7, height: 7, rx: 1 })]),
  list: () => base([svg('path', { d: 'M9 6h11M9 12h11M9 18h11' }), svg('circle', { cx: 4.5, cy: 6, r: 1 }), svg('circle', { cx: 4.5, cy: 12, r: 1 }), svg('circle', { cx: 4.5, cy: 18, r: 1 })]),
  sun: () => base([svg('circle', { cx: 12, cy: 12, r: 4 }), svg('path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' })]),
  moon: () => base([svg('path', { d: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' })]),
};
