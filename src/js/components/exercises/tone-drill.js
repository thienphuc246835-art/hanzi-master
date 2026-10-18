// Mode 9 — Tone drill: pick the tone of each syllable (listening) or the correctly marked pinyin
import { h } from '../../utils/dom.js';
import { shuffle, pickOne } from '../../utils/random.js';
import { stripTones, applyTone, toneOf, TONE_NAMES } from '../../utils/pinyin.js';
import { state } from '../../core/store.js';
import { speakWord } from '../word-detail.js';
import { exerciseShell, optionGrid, feedback, answerReveal, now } from './common.js';

function syllablesOf(word) {
  return [...word.simplified].map((ch) => {
    const c = word.characters.find((x) => x.char === ch);
    return { hanzi: ch, pinyin: c.pinyin, tone: toneOf(c.pinyin) };
  });
}

function sandhiTip(sylls) {
  const tips = [];
  for (let i = 0; i < sylls.length - 1; i++) {
    if (sylls[i].tone === 3 && sylls[i + 1].tone === 3) tips.push('Hai thanh 3 liền nhau: thanh 3 đầu đọc thành thanh 2.');
  }
  if (sylls.some((s) => s.hanzi === '不')) tips.push('不 đứng trước thanh 4 đọc thành bú.');
  if (sylls.some((s) => s.hanzi === '一')) tips.push('一 đổi thanh theo âm tiết phía sau (yí trước thanh 4, yì trước thanh 1–3).');
  return tips;
}

// Up to 3 wrong pinyin spellings that differ only by tone
function toneVariantsOfWord(sylls, rng = Math.random) {
  const correct = sylls.map((s) => s.pinyin).join('');
  const out = new Set();
  let guard = 0;
  while (out.size < 3 && guard++ < 50) {
    const variant = sylls.map((s) => {
      const change = sylls.length === 1 || rng() < 0.6;
      if (!change) return s.pinyin;
      const tones = [1, 2, 3, 4].filter((t) => t !== s.tone);
      return applyTone(stripTones(s.pinyin), pickOne(tones, rng));
    }).join('');
    if (variant !== correct) out.add(variant);
  }
  return [...out];
}

export function create(ctx) {
  const { word, onDone } = ctx;
  const sylls = syllablesOf(word);
  const listening = state.capabilities.audio &&(ctx.variant ?? pickOne(['listen', 'read'])) === 'listen';
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'tone_drill' });
  const startedAt = now();
  const tips = sandhiTip(sylls);
  let grid = null;
  let keyHandler = null;

  const finish = (correct) => {
    footer.append(feedback(correct, ''), answerReveal(word), tips.length ? h('p', { class: 'small muted center' }, tips.join(' ')) : null);
    onDone({ correct, responseMs: now() - startedAt });
  };

  if (listening) {
    let idx = 0;
    let allRight = true;
    const sylEls = sylls.map((s) => h('div', { class: 'syllable' },
      h('span', { class: 'syllable__hanzi', lang: 'zh-CN' }, s.hanzi),
      h('span', { class: 'syllable__pinyin' }, stripTones(s.pinyin))));
    const markActive = () => sylEls.forEach((el, i) => el.classList.toggle('syllable--active', i === idx));
    const toneButtons = [1, 2, 3, 4, 5].map((t) => h('button', {
      class: 'tone-btn', type: 'button', dataset: { tone: t }, 'aria-label': `${TONE_NAMES[t]} (phím ${t})`,
      onClick: () => pick(t),
    }, applyTone('a', t), h('small', {}, t === 5 ? 'nhẹ' : `thanh ${t}`)));
    const pick = (t) => {
      if (idx >= sylls.length) return;
      const s = sylls[idx];
      const ok = t === s.tone;
      if (!ok) allRight = false;
      const btn = toneButtons[t - 1];
      btn.classList.add(ok ? 'tone-btn--correct' : 'tone-btn--wrong');
      setTimeout(() => btn.classList.remove('tone-btn--correct', 'tone-btn--wrong'), 400);
      const pinyinEl = sylEls[idx].querySelector('.syllable__pinyin');
      pinyinEl.textContent = s.pinyin;
      pinyinEl.className = `syllable__pinyin tone-${s.tone}`;
      idx++;
      markActive();
      if (idx >= sylls.length) {
        toneButtons.forEach((b) => { b.disabled = true; });
        finish(allRight);
      }
    };
    markActive();
    body.append(
      h('p', { class: 'exercise__prompt' }, 'Nghe và chọn thanh điệu cho từng âm tiết'),
      h('div', { class: 'center' }, h('button', { class: 'btn btn--primary', type: 'button', onClick: () => speakWord(word.simplified) }, '🔊 Nghe lại')),
      h('div', { class: 'syllables' }, sylEls),
      h('div', { class: 'tones', role: 'group', 'aria-label': 'Chọn thanh điệu' }, toneButtons),
    );
    setTimeout(() => speakWord(word.simplified), 350);
    keyHandler = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 5) { pick(n); return true; }
      if (e.key === ' ') { speakWord(word.simplified); return true; }
      return false;
    };
  } else {
    const correct = sylls.map((s) => s.pinyin).join('');
    const options = shuffle([correct, ...toneVariantsOfWord(sylls)]);
    grid = optionGrid(options, {
      render: (p) => h('span', { class: 'pinyin', style: { fontSize: '1.3rem' } }, p),
      onPick: (i) => {
        grid.lock(options.indexOf(correct), i);
        finish(options[i] === correct);
      },
    });
    body.append(
      h('p', { class: 'exercise__prompt' }, 'Chọn pinyin có dấu thanh đúng'),
      h('div', { class: 'flashcard__hanzi flashcard__hanzi--md', lang: 'zh-CN' }, word.simplified),
      grid.el,
    );
    keyHandler = (e) => grid.onKey(e);
  }

  return { el: root, onKey: (e) => keyHandler(e) };
}
