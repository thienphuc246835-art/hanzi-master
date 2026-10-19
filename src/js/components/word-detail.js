// Shared word renderers: tones, radical mnemonics (§4.4), graded examples (§4.5), stroke order
import { h } from '../utils/dom.js';
import { playText } from '../utils/audio.js';
import { toneOf } from '../utils/pinyin.js';
import { toast } from '../utils/ui.js';
import { strokeDataLoader } from '../utils/strokes.js';
import { state, isFavorite, toggleFavorite } from '../core/store.js';
import { EXAMPLE_TIER_LABELS, STATE } from '../core/constants.js';
import { formatDateVi } from '../utils/date.js';

export const FORMATION_LABELS = Object.freeze({
  形声: 'Hình thanh',
  会意: 'Hội ý',
  象形: 'Tượng hình',
  指事: 'Chỉ sự',
  假借: 'Giả tá',
  转注: 'Chuyển chú',
});

const MNEMONIC_TYPE_LABELS = Object.freeze({ etymology: 'Chiết tự thật', creative: 'Mẹo sáng tạo', structure: 'Phân tích cấu tạo' });
const MEANINGS_SHOWN = 3;
const IMG_BASE = 'src/assets/img/';

export function speakWord(text) {
  return playText(text, { rate: state.settings.tts_rate }).then((ok) => {
    if (!ok && !state.capabilities.tts) toast('Không phát được âm thanh');
    return ok;
  });
}

export function primaryMeaning(word, limit = MEANINGS_SHOWN) {
  return [...new Set(word.meanings.map((m) => m.vi))].slice(0, limit).join('; ');
}

export function wordImage(word, className = 'word-image') {
  if (!word.image) return null;
  const img = h('img', { class: className, src: IMG_BASE + word.image, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => img.remove());
  return img;
}

// Pinyin with each syllable colored by tone
export function tonedPinyin(word, className = 'pinyin') {
  const chars = word.characters ?? [];
  const syllables = [...word.simplified].map((ch) => chars.find((c) => c.char === ch)?.pinyin);
  if (syllables.some((s) => !s)) return h('span', { class: className }, word.pinyin);
  return h('span', { class: className, 'aria-label': word.pinyin },
    syllables.map((s) => h('span', { class: `tone-${toneOf(s)}` }, s)));
}

export function hanViet(word) {
  return (word.characters ?? []).length
    ? [...word.simplified].map((ch) => word.characters.find((c) => c.char === ch)?.han_viet ?? '').join(' ')
    : word.han_viet.toUpperCase();
}

// Front-side hint: radicals only — never reveals the meaning of the word
export function renderRadicalHint(word) {
  return h('div', { class: 'flashcard__hint' },
    (word.characters ?? []).map((c) => h('div', {},
      h('span', { class: 'hanzi' }, c.radical.char), ' ',
      `bộ ${c.radical.name_vi} — ${c.radical.meaning_vi}`,
      c.components?.length > 1 ? h('span', { class: 'muted small' }, ` · ghép với ${c.components.filter((p) => p.part !== c.radical.char).map((p) => p.part).join(' ')}`) : null,
    )),
  );
}

function renderCharacterBreakdown(c) {
  return h('div', { class: 'mnemonic__char' },
    h('span', { class: 'mnemonic__glyph', 'aria-hidden': 'true' }, c.char),
    h('div', {},
      h('strong', {}, c.han_viet), ' · ', h('span', { class: `pinyin tone-${toneOf(c.pinyin ?? '')}` }, c.pinyin ?? ''),
      c.traditional && c.traditional !== c.char ? h('span', { class: 'muted small' }, ` · phồn thể ${c.traditional}`) : null,
      c.formation ? h('span', { class: 'mnemonic__tag' }, FORMATION_LABELS[c.formation] ?? c.formation) : null,
      h('span', { class: 'mnemonic__tag' }, MNEMONIC_TYPE_LABELS[c.mnemonic.type] ?? c.mnemonic.type),
    ),
    h('div', { class: 'small' },
      'Bộ ', h('span', { class: 'hanzi' }, c.radical.char),
      `${c.radical.kangxi_no ? ` (#${c.radical.kangxi_no})` : ''} — bộ ${c.radical.name_vi}${c.radical.meaning_vi ? `: ${c.radical.meaning_vi}` : ''}${c.stroke_count ? ` · ${c.stroke_count} nét` : ''}`,
      c.components?.length ? h('div', { class: 'muted' }, c.components.map((p) => `${p.part}${p.name_vi ? ` (${p.name_vi})` : ''}: ${p.meaning_vi}`).join(' · ')) : null,
    ),
    h('div', {}, c.mnemonic.story_vi),
  );
}

export function renderMnemonic(word, { open = false } = {}) {
  return h('details', { class: 'mnemonic', open },
    h('summary', { class: 'mnemonic__summary' }, h('span', { 'aria-hidden': 'true' }, '💡'), word.mnemonic_summary.hint_short),
    (word.characters ?? []).map(renderCharacterBreakdown),
    h('p', { class: 'mt-4 small' }, h('strong', {}, 'Ghép nghĩa: '), word.mnemonic_summary.word_link_vi),
  );
}

// One example per tier (flashcard) or all of them (detail view)
export function pickExamples(word, { perTier = false, max = 8 } = {}) {
  if (!perTier) return word.examples.slice(0, max);
  const out = [];
  for (const tier of [1, 2, 3]) {
    const ex = word.examples.find((e) => e.tier === tier);
    if (ex) out.push(ex);
  }
  return out.length ? out : word.examples.slice(0, 3);
}

// Words of an example sentence (deck segmentation) as chips: tap → hear the word and see its meaning
function exampleWords(ex, gloss) {
  const byText = new Map(state.words.map((w) => [w.simplified, w]));
  const parts = (ex.seg ?? '').split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return h('div', { class: 'example__words', lang: 'zh-CN' }, parts.map((p) => {
    const w = byText.get(p);
    return h('button', {
      class: 'chip', type: 'button', disabled: !w,
      onClick: (e) => {
        e.stopPropagation();
        speakWord(p);
        gloss.textContent = `${p} · ${w.pinyin} — ${primaryMeaning(w, 2)}`;
      },
    }, p);
  }));
}

export function renderExamples(word, { compact = false, perTier = compact } = {}) {
  return h('ol', { class: 'examples', 'aria-label': 'Ví dụ theo cấp độ' },
    pickExamples(word, { perTier }).map((ex) => {
      const gloss = h('div', { class: 'example__gloss small' });
      const li = h('li', { class: 'example', tabindex: '0', role: 'button', 'aria-expanded': 'false' },
        h('div', { class: 'example__zh' },
          h('span', {}, compact && [...ex.zh].length > 18 ? `${[...ex.zh].slice(0, 16).join('')}…` : ex.zh),
          h('span', { class: 'example__tier' }, `${EXAMPLE_TIER_LABELS[ex.tier]} · ≤HSK ${ex.max_level}`),
        ),
        h('div', { class: 'example__detail' },
          compact ? h('div', { class: 'hanzi' }, ex.zh) : null,
          h('div', { class: 'pinyin' }, ex.pinyin),
          h('div', {}, ex.vi),
          exampleWords(ex, gloss),
          gloss,
          h('button', { class: 'icon-btn', type: 'button', onClick: (e) => { e.stopPropagation(); speakWord(ex.zh); } }, '🔊 Đọc câu'),
        ),
      );
      const toggle = () => {
        const open = li.classList.toggle('example--open');
        li.setAttribute('aria-expanded', String(open));
        if (open && state.settings.auto_play_audio) speakWord(ex.zh);
      };
      li.addEventListener('click', toggle);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); toggle(); } });
      return li;
    }),
  );
}

export function relatedByRadical(word, { learnedOnly = true } = {}) {
  const radicals = new Set((word.characters ?? []).map((c) => c.radical.char));
  return state.words.filter((w) => {
    if (w.id === word.id) return false;
    if (learnedOnly) {
      const card = state.cards.get(w.id);
      if (!card || card.state === STATE.NEW) return false;
    }
    return (w.characters ?? []).some((c) => radicals.has(c.radical.char));
  });
}

export function renderRelated(word) {
  const related = relatedByRadical(word);
  if (!related.length) return h('p', { class: 'muted small' }, 'Chưa có từ đã học nào chung bộ thủ.');
  return h('div', { class: 'row' }, related.map((w) => h('span', { class: 'chip chip--gold' },
    h('span', { class: 'hanzi' }, w.simplified), ` ${w.pinyin}`)));
}

// Stroke colours follow the active theme
export function strokeColors() {
  const css = getComputedStyle(document.documentElement);
  return {
    strokeColor: css.getPropertyValue('--color-text-primary').trim() || '#F0EDE8',
    radicalColor: css.getPropertyValue('--color-accent-gold').trim() || '#E8B86D',
    outlineColor: css.getPropertyValue('--color-border').trim() || '#2A2F3A',
  };
}

// Stroke-order animation via HanziWriter (stroke data shipped locally in data/strokes/)
export function strokeAnimation(word, size = 120) {
  const wrap = h('div', { class: 'writer' });
  if (!window.HanziWriter) {
    wrap.append(h('p', { class: 'muted small' }, 'Chưa tải được thư viện HanziWriter (cần mạng ở lần mở đầu tiên).'));
    return wrap;
  }
  const chars = [...word.simplified];
  const writers = chars.map((ch) => {
    const box = h('div', { class: 'writer__box', style: { width: `${size}px`, height: `${size}px` } });
    wrap.append(box);
    return window.HanziWriter.create(box, ch, {
      width: size, height: size, padding: 6,
      ...strokeColors(),
      charDataLoader: strokeDataLoader,
      delayBetweenStrokes: 180, strokeAnimationSpeed: 1.2,
      onLoadCharDataError: () => { box.textContent = ch; },
    });
  });
  const run = async (i = 0) => {
    if (i >= writers.length) return;
    writers[i].animateCharacter({ onComplete: () => run(i + 1) });
  };
  requestAnimationFrame(() => run());
  return wrap;
}

export function favoriteButton(word) {
  const btn = h('button', {
    class: 'icon-btn', type: 'button', 'aria-pressed': String(isFavorite(word.id)),
    onClick: () => {
      const on = toggleFavorite(word.id);
      btn.setAttribute('aria-pressed', String(on));
      toast(on ? 'Đã đánh dấu ⭐' : 'Đã bỏ đánh dấu');
    },
  }, '⭐ Đánh dấu');
  return btn;
}

export function renderCardStatus(word) {
  const card = state.cards.get(word.id);
  if (!card || card.state === STATE.NEW) return h('p', { class: 'muted small' }, 'Chưa học');
  const labels = { learning: 'Đang học', relearning: 'Học lại', review: 'Ôn tập' };
  return h('p', { class: 'muted small' },
    `${labels[card.state]} · độ bền ${card.stability.toFixed(1)} ngày · độ khó ${card.difficulty.toFixed(1)} · ôn ${card.reps} lần · quên ${card.lapses} lần · đến hạn ${formatDateVi(card.due)}`);
}

// Full detail (browse popup / flashcard "Chi tiết")
export function renderWordDetail(word) {
  const strokeSlot = h('div');
  return h('div', { class: 'stack' },
    h('div', { class: 'row row--between' },
      h('span', { class: 'chip chip--gold' }, word.hsk_level === 7 ? 'HSK 7–9' : `HSK ${word.hsk_level}`),
      renderCardStatus(word),
    ),
    h('div', { class: 'flashcard__hanzi flashcard__hanzi--md center' }, word.simplified),
    h('div', { class: 'center' }, tonedPinyin(word, 'pinyin flashcard__pinyin'), h('div', { class: 'flashcard__hanviet' }, hanViet(word))),
    word.other_readings?.length ? h('p', { class: 'center small muted' }, 'Cách đọc khác: ', word.other_readings.map((r) => `${r.pinyin} (HSK ${r.hsk_level === 7 ? '7–9' : r.hsk_level})`).join(' · ')) : null,
    wordImage(word),
    h('ul', { class: 'meanings' }, word.meanings.map((m) => h('li', {}, m.pos ? h('span', { class: 'chip' }, m.pos) : null, ' ', m.vi))),
    h('div', { class: 'action-row' },
      h('button', { class: 'icon-btn', type: 'button', onClick: () => speakWord(word.simplified) }, '🔊 Phát âm'),
      h('button', { class: 'icon-btn', type: 'button', onClick: () => strokeSlot.replaceChildren(strokeAnimation(word)) }, '✏️ Nét bút'),
      favoriteButton(word),
    ),
    strokeSlot,
    renderMnemonic(word, { open: true }),
    renderExamples(word, { perTier: false }),
    word.syn?.length ? h('p', { class: 'small' }, h('strong', {}, 'Cận nghĩa: '), word.syn.map((s) => `${s.hz} (${s.gloss})`).join(' · ')) : null,
    word.ant?.length ? h('p', { class: 'small' }, h('strong', {}, 'Trái nghĩa: '), word.ant.map((s) => `${s.hz} (${s.gloss})`).join(' · ')) : null,
    word.confusables?.length ? h('p', { class: 'small' }, h('strong', {}, 'Dễ nhầm với: '), word.confusables.join(' · ')) : null,
    h('div', {}, h('h3', { class: 'small muted' }, '🏷️ Từ đã học cùng bộ thủ'), renderRelated(word)),
  );
}
