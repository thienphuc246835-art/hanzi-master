// Pointer-based drag & drop that works for mouse, touch and pen.
// A plain tap/click (or Enter/Space on the button) falls back to `onTap`.
const DRAG_THRESHOLD_PX = 6;

export function makeDraggable(el, { dropSelector, onDrop, onTap, onOver }) {
  let start = null;
  let dragging = false;
  let lastTarget = null;

  const targetAt = (x, y) => {
    el.style.pointerEvents = 'none';
    const under = document.elementFromPoint(x, y);
    el.style.pointerEvents = '';
    return under?.closest(dropSelector) ?? null;
  };

  const reset = () => {
    el.classList.remove('token--dragging');
    el.style.transform = '';
    lastTarget?.classList.remove('answer-line--over');
    lastTarget = null;
    start = null;
    dragging = false;
  };

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    start = { x: e.clientX, y: e.clientY };
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      dragging = true;
      el.classList.add('token--dragging');
    }
    if (!dragging) return;
    el.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;
    const t = targetAt(e.clientX, e.clientY);
    if (t !== lastTarget) {
      lastTarget?.classList.remove('answer-line--over');
      t?.classList.add('answer-line--over');
      lastTarget = t;
      onOver?.(t);
    }
  });

  let suppressClick = false;

  el.addEventListener('pointerup', (e) => {
    if (!start) return;
    const wasDragging = dragging;
    const target = wasDragging ? targetAt(e.clientX, e.clientY) : null;
    reset();
    if (wasDragging) {
      suppressClick = true;
      if (target) onDrop?.(target, e);
    }
  });

  el.addEventListener('pointercancel', reset);

  // Click covers taps without movement and keyboard activation
  el.addEventListener('click', (e) => {
    if (suppressClick) { suppressClick = false; return; }
    onTap?.(e);
  });
}
