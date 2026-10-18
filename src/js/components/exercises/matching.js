// Mode 7 — Matching 5 pairs: Hán tự ↔ nghĩa / pinyin / Hán Việt / audio
import { h } from '../../utils/dom.js';
import { shuffle, pickOne } from '../../utils/random.js';
import { vibrate } from '../../utils/ui.js';
import { areSynonyms } from '../../core/distractors.js';
import { primaryMeaning, hanViet, speakWord } from '../word-detail.js';
import { exerciseShell, feedback, now } from './common.js';

const PAIRS = 5;
const WRONG_FLASH_MS = 300;

const SIDES = Object.freeze({
  meaning: { label: 'nghĩa', render: (w) => primaryMeaning(w) },
  pinyin: { label: 'pinyin', render: (w) => w.pinyin },
  hanviet: { label: 'âm Hán Việt', render: (w) => hanViet(w) },
  audio: { label: 'âm thanh', render: (w, i) => `🔊 ${i + 1}` },
});

export function create(ctx) {
  const { word, pool, onDone } = ctx;
  const side = ctx.side ?? pickOne(Object.keys(SIDES));
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'matching' });

  // Target word + fillers that cannot be confused as synonyms
  const fillers = [];
  for (const w of shuffle(pool)) {
    if (fillers.length === PAIRS - (word ? 1 : 0)) break;
    if (word && (w.id === word.id || areSynonyms(word, w))) continue;
    if (fillers.some((f) => areSynonyms(f, w))) continue;
    fillers.push(w);
  }
  const set = word ? [word, ...fillers] : fillers;
  const left = shuffle(set);
  const right = shuffle(set);
  const startedAt = now();
  let selected = null;
  let matched = 0;
  let targetErrors = 0;
  let targetMs = null;
  let totalErrors = 0;

  const tile = (w, kind, i) => {
    const isHanzi = kind === 'left';
    const el = h('button', {
      class: `match__tile${isHanzi ? ' match__tile--hanzi' : ''}`, type: 'button',
      lang: isHanzi ? 'zh-CN' : null,
      dataset: { id: w.id, side: kind },
      'aria-label': isHanzi ? w.simplified : side === 'audio' ? `Âm thanh ${i + 1}` : SIDES[side].render(w, i),
      onClick: () => choose(el, w, kind),
    }, isHanzi ? w.simplified : SIDES[side].render(w, i));
    return el;
  };

  function choose(el, w, kind) {
    if (side === 'audio' && kind === 'right') speakWord(w.simplified);
    if (!selected || selected.kind === kind) {
      selected?.el.classList.remove('match__tile--selected');
      selected = { el, w, kind };
      el.classList.add('match__tile--selected');
      return;
    }
    const a = selected;
    selected = null;
    a.el.classList.remove('match__tile--selected');
    if (a.w.id === w.id) {
      [a.el, el].forEach((t) => { t.classList.add('match__tile--done'); t.disabled = true; });
      vibrate(10);
      matched++;
      if (word && w.id === word.id) targetMs = now() - startedAt;
      if (matched === set.length) complete();
    } else {
      totalErrors++;
      if (word && (a.w.id === word.id || w.id === word.id)) targetErrors++;
      [a.el, el].forEach((t) => {
        t.classList.add('match__tile--wrong');
        setTimeout(() => t.classList.remove('match__tile--wrong'), WRONG_FLASH_MS);
      });
      vibrate([10, 40, 10]);
    }
  }

  function complete() {
    const totalMs = now() - startedAt;
    const correct = word ? targetErrors === 0 : totalErrors === 0;
    footer.append(feedback(correct, `${(totalMs / 1000).toFixed(1)} giây · ${totalErrors} lần nối sai`));
    onDone({ correct, responseMs: targetMs ?? totalMs, totalMs, totalErrors });
  }

  body.append(
    h('p', { class: 'exercise__prompt' }, `Nối chữ Hán với ${SIDES[side].label} tương ứng`),
    h('div', { class: 'match' },
      h('div', { class: 'match__col' }, left.map((w, i) => tile(w, 'left', i))),
      h('div', { class: 'match__col' }, right.map((w, i) => tile(w, 'right', i)))),
  );

  return { el: root };
}
