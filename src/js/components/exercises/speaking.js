// Mode 13 — Speaking & shadowing. Practice only: recognition never writes an FSRS rating.
import { h } from '../../utils/dom.js';
import { pickOne } from '../../utils/random.js';
import { playText } from '../../utils/audio.js';
import { similarity, diffChars } from '../../core/grader.js';
import { state } from '../../core/store.js';
import { builderExamples } from '../../core/exercise-picker.js';
import { exerciseShell, feedback, sentenceReveal, now } from './common.js';

const PASS_SIMILARITY = 0.8;
const RECORD_MAX_MS = 8000;

const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export function create(ctx) {
  const { word, onDone } = ctx;
  const { root, body, footer } = exerciseShell({ ...ctx, mode: 'speaking' });
  const candidates = builderExamples(word);
  const example = candidates.length ? pickOne(candidates) : word.examples[0];
  const startedAt = now();
  const status = h('p', { class: 'center muted', role: 'status' });
  const result = h('div', { class: 'stack' });
  let done = false;

  const listen = () => playText(example.zh, { rate: state.settings.tts_rate });

  const finish = (correct, extra = {}) => {
    if (done) return;
    done = true;
    onDone({ correct, responseMs: now() - startedAt, ...extra });
  };

  function recognise() {
    const rec = new Recognition();
    rec.lang = 'zh-CN';
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    status.textContent = '🎙️ Đang nghe… hãy đọc to câu trên';
    rec.onresult = (e) => {
      const alternatives = [...e.results[0]].map((r) => r.transcript);
      const best = alternatives.map((t) => ({ t, s: similarity(example.zh, t) })).sort((a, b) => b.s - a.s)[0];
      status.textContent = '';
      const correct = best.s >= PASS_SIMILARITY;
      result.replaceChildren(
        feedback(correct, `Độ khớp ${Math.round(best.s * 100)}%`),
        h('p', { class: 'diff', lang: 'zh-CN' }, diffChars(example.zh, best.t).map((d) => h('span', { class: `diff__${d.status}` }, d.char))),
        h('p', { class: 'center muted small' }, `Máy nghe được: «${best.t}»`),
      );
      finish(correct, { similarity: best.s });
    };
    rec.onerror = (e) => {
      status.textContent = e.error === 'not-allowed' ? 'Chưa được cấp quyền micro.' : 'Không nhận dạng được — chuyển sang tự đánh giá.';
      selfAssess();
    };
    rec.start();
  }

  // Fallback: record yourself, play it back next to the model, then self-assess
  async function recordAndCompare() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return selfAssess();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
        status.textContent = '';
        result.replaceChildren(h('audio', { controls: true, src: url }));
        selfAssess();
      };
      recorder.start();
      status.textContent = '⏺️ Đang ghi âm…';
      const stopBtn = h('button', { class: 'btn', type: 'button', onClick: () => recorder.state === 'recording' && recorder.stop() }, '⏹️ Dừng');
      result.replaceChildren(stopBtn);
      setTimeout(() => recorder.state === 'recording' && recorder.stop(), RECORD_MAX_MS);
    } catch {
      status.textContent = 'Không truy cập được micro.';
      selfAssess();
    }
  }

  function selfAssess() {
    result.append(h('div', { class: 'row', style: { justifyContent: 'center' } },
      h('button', { class: 'btn', type: 'button', onClick: () => finish(false) }, 'Chưa giống'),
      h('button', { class: 'btn btn--primary', type: 'button', onClick: () => finish(true) }, 'Giống câu mẫu')));
  }

  body.append(
    h('p', { class: 'exercise__prompt' }, 'Nghe câu mẫu rồi nhại lại'),
    sentenceReveal(example),
    h('div', { class: 'row', style: { justifyContent: 'center' } },
      h('button', { class: 'btn', type: 'button', onClick: listen }, '🔊 Nghe mẫu'),
      h('button', { class: 'btn btn--primary', type: 'button', onClick: () => (Recognition ? recognise() : recordAndCompare()) }, '🎙️ Nói')),
    status,
  );
  footer.append(result, h('p', { class: 'center muted small' }, 'Bài luyện nói không ảnh hưởng lịch ôn tập.'));
  setTimeout(listen, 350);

  return { el: root, onKey: (e) => { if (e.key === ' ') { listen(); return true; } return false; } };
}
