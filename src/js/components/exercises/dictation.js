// Mode 11 — Dictation: listen to an example sentence, type it in characters or pinyin
import { h } from '../../utils/dom.js';
import { pickOne } from '../../utils/random.js';
import { playText } from '../../utils/audio.js';
import { normalizePinyin } from '../../utils/pinyin.js';
import { diffChars, normalizeHanzi } from '../../core/grader.js';
import { state } from '../../core/store.js';
import { builderExamples } from '../../core/exercise-picker.js';
import { exerciseShell, feedback, sentenceReveal, primaryButton, now } from './common.js';

const HANZI = /\p{Script=Han}/u;

// Commonly confused homophones (explained when the learner swaps them)
const HOMOPHONE_NOTES = Object.freeze({
  在: '在 (zài) = ở, đang', 再: '再 (zài) = lại, nữa',
  的: '的 (de) = trợ từ sở hữu', 得: '得 (de) = trợ từ bổ ngữ', 地: '地 (de) = trợ từ trạng ngữ',
  他: '他 = anh ấy', 她: '她 = cô ấy', 它: '它 = nó (vật)',
});

export function create(ctx) {
  const { word, onDone } = ctx;
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'dictation' });
  const candidates = builderExamples(word);
  const example = candidates.length ? pickOne(candidates) : word.examples[0];
  const startedAt = now();
  let done = false;

  const play = (slow = false) => playText(example.zh, { rate: state.settings.tts_rate, slow });
  const input = h('textarea', {
    class: 'input input--hanzi', rows: 2, autocomplete: 'off', spellcheck: false,
    'aria-label': 'Gõ lại câu vừa nghe bằng chữ Hán hoặc pinyin',
    placeholder: 'Gõ chữ Hán hoặc pinyin (không cần dấu)',
    onKeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); check(); } },
  });

  function check() {
    if (done || !input.value.trim()) return;
    done = true;
    const answer = input.value.trim();
    let correct;
    let diffEl = null;
    let notes = [];
    if (HANZI.test(answer)) {
      const diff = diffChars(example.zh, answer);
      correct = normalizeHanzi(answer) === normalizeHanzi(example.zh);
      diffEl = h('p', { class: 'diff', lang: 'zh-CN', 'aria-label': 'So sánh từng chữ' },
        diff.map((d) => h('span', { class: `diff__${d.status}` }, d.char)));
      notes = diff.filter((d) => d.status === 'bad' && HOMOPHONE_NOTES[d.char]).map((d) => HOMOPHONE_NOTES[d.char]);
    } else {
      correct = normalizePinyin(answer) === normalizePinyin(example.pinyin);
    }
    footer.replaceChildren(
      feedback(correct, ''),
      diffEl,
      notes.length ? h('p', { class: 'small muted center' }, `Chú ý chữ đồng âm: ${notes.join(' · ')}`) : null,
      sentenceReveal(example),
    );
    onDone({ correct, responseMs: now() - startedAt });
  }

  body.append(
    h('p', { class: 'exercise__prompt' }, 'Nghe và chép lại cả câu'),
    h('div', { class: 'row', style: { justifyContent: 'center' } },
      h('button', { class: 'btn btn--primary', type: 'button', onClick: () => play() }, '🔊 Tốc độ thường'),
      h('button', { class: 'btn', type: 'button', onClick: () => play(true) }, '🐢 Chậm 0.75×')),
    h('p', { class: 'center muted small' }, `${[...normalizeHanzi(example.zh)].length} chữ`),
  );
  footer.append(input, h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, primaryButton('Kiểm tra ↵', check)));
  setTimeout(() => { play(); input.focus(); }, 350);

  return { el: root };
}
