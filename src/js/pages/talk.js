// Trợ lý hội thoại (/talk) — trò chuyện với "người bản xứ": kịch bản có sẵn (offline) hoặc AI (Ollama chạy trên máy)
import { h, clear, append } from '../utils/dom.js';
import { icons } from '../utils/icons.js';
import { playText, stopAudio } from '../utils/audio.js';
import { listenOnce, stopListening, isSpeechInputSupported } from '../utils/speech-input.js';
import { listModels, chat, OLLAMA_DEFAULT_URL, OLLAMA_DEFAULT_MODEL } from '../utils/llm.js';
import { similarity, diffChars } from '../core/grader.js';
import { state } from '../core/store.js';
import { segment, indexWords } from './situations.js';
import { primaryMeaning } from '../components/word-detail.js';
import { STATE } from '../core/constants.js';
import {
  TALK_TOPICS, TALK_LEVELS, buildSystemPrompt, buildMessages, parseTurn, buildSuggestionMessages, parseSuggestions, scriptedTurns, scenariosForLevel, levelName,
} from '../core/talk.js';

const PREFS_KEY = 'hzm.talk.prefs';
const PASS_SIMILARITY = 0.8;
const KNOWN_WORDS_SAMPLE = 20;
const SITUATIONS_URL = 'src/js/data/situations.json';
const SCRIPT_MAX_LEVEL = 3;
const REPLY_MAX_TOKENS = 260;
const SUGGESTION_MAX_TOKENS = 320;

const DEFAULT_PREFS = { mode: 'ai', level: 1, topic: 'free', customTopic: '', url: OLLAMA_DEFAULT_URL, model: OLLAMA_DEFAULT_MODEL, pinyin: true, vi: true };

function readPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return { ...DEFAULT_PREFS }; }
}
function writePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

function sampleKnownWords(level) {
  const pool = state.words.filter((w) => (level === 7 ? w.hsk_level >= 7 : w.hsk_level === level) && w.simplified.length <= 3
    && state.cards.get(w.id)?.state !== undefined && state.cards.get(w.id).state !== STATE.NEW);
  return pool.sort(() => Math.random() - 0.5).slice(0, KNOWN_WORDS_SAMPLE).map((w) => w.simplified);
}

// Pinyin from the app's own vocabulary (model-written pinyin is unreliable): words first, then single characters
let charPinyin = null;
export function localPinyin(zh) {
  if (!charPinyin) {
    charPinyin = new Map();
    for (const w of state.words) for (const c of w.characters ?? []) if (c.pinyin && !charPinyin.has(c.char)) charPinyin.set(c.char, c.pinyin);
  }
  const parts = [];
  for (const s of segment(zh, indexWords())) {
    if (s.word) parts.push(s.word.pinyin);
    else if (charPinyin.has(s.text)) parts.push(charPinyin.get(s.text));
    else if (!/\p{Script=Han}/u.test(s.text)) parts.push(s.text); // punctuation stays; unknown Han characters are skipped
  }
  return parts.join(' ').replace(/\s+([，。！？、,.!?])/gu, '$1').replace(/^[，。！？、,.!?\s]+/u, '').trim();
}

const SKIP_GLOSS = new Set(['的', '了', '吗', '呢', '吧', '啊', '嘛', '哦', '我', '你', '他', '她', '是', '在', '很', '不', '也', '都', '就', '么', '什么', '过', '得', '地', '着', '把', '被', '还', '和', '又', '再', '才', '会', '要', '可', '个', '这', '那', '一', '二', '呀', '啦']);
const GLOSS_MAX_ITEMS = 6;
const GLOSS_MAX_CHARS = 22;
const HAN_RE = /\p{Script=Han}/u;

const shortMeaning = (word) => {
  const m = primaryMeaning(word, 1).split(/[;；(（]/)[0].trim();
  return [...m].length > GLOSS_MAX_CHARS ? `${[...m].slice(0, GLOSS_MAX_CHARS).join('')}…` : m;
};

// Nghĩa từng từ lấy từ bộ từ vựng của app — đáng tin hơn bản dịch của model nhỏ
export function wordGloss(zh) {
  const seen = new Set();
  const items = [];
  for (const s of segment(zh, indexWords())) {
    if (!s.word || SKIP_GLOSS.has(s.text) || seen.has(s.text)) continue;
    seen.add(s.text);
    items.push(`${s.text} ${shortMeaning(s.word)}`);
  }
  return items.slice(0, GLOSS_MAX_ITEMS).join(' · ');
}

// Model nhỏ hay lẫn chữ Hán vào bản dịch tiếng Việt: bỏ bản dịch hỏng, giữ nghĩa từng từ
const withPinyin = (line) => ({
  ...line,
  pinyin: localPinyin(line.zh),
  vi: line.vi && !HAN_RE.test(line.vi) ? line.vi : '',
  gloss: wordGloss(line.zh),
  viUnreliable: !line.vi || HAN_RE.test(line.vi),
});

// Prefer a larger Qwen when installed (more natural Chinese), else any Qwen, else the first model
export function pickModel(models, current) {
  if (models.includes(current)) return current;
  return models.find((m) => /qwen.*3b/i.test(m)) ?? models.find((m) => /qwen/i.test(m)) ?? models[0];
}

const speak = (zh) => playText(zh, { rate: state.settings.tts_rate });

export function render(root) {
  const prefs = readPrefs();
  let situations = null;
  let session = null; // active chat session (has stop())

  const seg = (options, current, onPick, label) => h('div', { class: 'segmented', role: 'group', 'aria-label': label },
    options.map(([value, text]) => h('button', {
      class: 'segmented__opt', type: 'button', 'aria-pressed': String(current === value),
      onClick: (e) => { onPick(value); e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); },
    }, text)));

  // ---------------- Setup ----------------
  function showSetup() {
    session?.stop();
    session = null;
    clear(root);
    const dynamic = h('div', { class: 'stack' });
    const paintDynamic = () => {
      clear(dynamic);
      if (prefs.mode === 'ai') dynamic.append(topicPicker(), ollamaBox());
      else dynamic.append(scenarioPicker());
    };

    const topicPicker = () => {
      const custom = h('input', { class: 'input', type: 'text', placeholder: 'Hoặc nhập chủ đề riêng (tiếng Việt/Anh/Trung), vd: phỏng vấn xin việc', value: prefs.customTopic,
        onInput: (e) => { prefs.customTopic = e.target.value; writePrefs(prefs); } });
      return h('div', { class: 'stack' },
        h('h2', { class: 'card__title' }, 'Chủ đề'),
        seg(TALK_TOPICS.map((t) => [t.id, t.label]), prefs.topic, (v) => { prefs.topic = v; writePrefs(prefs); }, 'Chủ đề'),
        custom);
    };

    const ollamaBox = () => {
      const status = h('p', { class: 'small', role: 'status' });
      const modelSel = h('select', { class: 'select', 'aria-label': 'Model', onChange: (e) => { prefs.model = e.target.value; writePrefs(prefs); } });
      const urlInput = h('input', { class: 'input', type: 'url', value: prefs.url, 'aria-label': 'Địa chỉ Ollama', onChange: (e) => { prefs.url = e.target.value.trim() || OLLAMA_DEFAULT_URL; writePrefs(prefs); check(); } });
      async function check() {
        status.textContent = 'Đang kiểm tra Ollama…';
        status.className = 'small muted';
        try {
          const models = await listModels(prefs.url);
          if (!models.length) { status.textContent = 'Ollama đang chạy nhưng chưa có model. Chạy: ollama pull qwen2.5:3b'; status.className = 'small tone-1'; return; }
          modelSel.replaceChildren(...models.map((m) => h('option', { value: m }, m)));
          prefs.model = pickModel(models, prefs.model);
          modelSel.value = prefs.model;
          writePrefs(prefs);
          status.textContent = `✓ Đã kết nối Ollama (${models.length} model).`;
          status.className = 'small tone-3';
        } catch {
          status.textContent = 'Chưa kết nối được Ollama. Xem hướng dẫn bên dưới rồi bấm "Kiểm tra".';
          status.className = 'small tone-1';
        }
      }
      setTimeout(check, 0);
      return h('div', { class: 'stack' },
        h('h2', { class: 'card__title' }, 'Trợ lý AI (Ollama trên máy bạn)'),
        h('div', { class: 'row' }, urlInput, modelSel, h('button', { class: 'btn btn--small', type: 'button', onClick: check }, 'Kiểm tra')),
        status,
        h('details', { class: 'small' },
          h('summary', {}, 'Hướng dẫn cài đặt (làm một lần)'),
          h('ol', { class: 'tips' },
            h('li', {}, 'Cài Ollama từ ollama.com rồi mở lên.'),
            h('li', {}, 'Mở Terminal, tải model: ', h('code', {}, 'ollama pull qwen2.5:3b'), ' (máy yếu dùng ', h('code', {}, 'qwen2.5:1.5b'), '; máy mạnh dùng ', h('code', {}, 'qwen2.5:7b'), ' để tự nhiên hơn).'),
            h('li', {}, 'Nếu dùng bản web trên GitHub Pages, cho phép trang gọi Ollama: đặt biến môi trường ', h('code', {}, 'OLLAMA_ORIGINS=https://thienphuc246835-art.github.io'), ' rồi khởi động lại Ollama. Chạy bản local (localhost) thì không cần.'),
            h('li', {}, 'Dùng Chrome hoặc Edge để nhận dạng giọng nói.'))));
    };

    const scenarioPicker = () => {
      const box = h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'Đang tải kịch bản…'));
      const paint = () => {
        const list = scenariosForLevel(situations, Math.min(prefs.level, SCRIPT_MAX_LEVEL));
        append(clear(box), [
          h('h2', { class: 'card__title' }, 'Chọn tình huống'),
          prefs.level > SCRIPT_MAX_LEVEL ? h('p', { class: 'muted small' }, `Kịch bản có sẵn mới có đến HSK ${SCRIPT_MAX_LEVEL}. Chọn chế độ Trợ lý AI để luyện cấp cao hơn.`) : null,
          h('div', { class: 'grid grid--2' }, list.map((s) => h('div', { class: 'card stack' },
            h('strong', {}, `${s.icon} ${s.title_vi}`),
            h('span', { class: 'hanzi muted', lang: 'zh-CN' }, s.title_zh),
            h('div', { class: 'row' },
              h('button', { class: 'btn btn--small btn--primary', type: 'button', onClick: () => startScripted(s, 'B') }, 'Tôi đóng vai B (trả lời)'),
              h('button', { class: 'btn btn--small', type: 'button', onClick: () => startScripted(s, 'A') }, 'Tôi mở lời (vai A)')))))]);
      };
      (async () => {
        try { situations ??= await (await fetch(SITUATIONS_URL)).json(); paint(); } catch { box.textContent = 'Không tải được kịch bản.'; }
      })();
      return box;
    };

    root.append(
      h('header', { class: 'page-head' }, h('div', {},
        h('h1', {}, 'Trò chuyện với trợ lý'),
        h('p', { class: 'page-head__sub' }, 'Trợ lý hỏi, bạn chọn câu trả lời gợi ý rồi đọc theo — hoặc tự nói theo ý mình. Mọi câu đều có audio, pinyin và nghĩa.'))),
      h('section', { class: 'card stack' },
        h('h2', { class: 'card__title' }, 'Chế độ'),
        seg([['ai', 'Trợ lý AI — nói tự do'], ['script', 'Kịch bản có sẵn — offline']], prefs.mode, (v) => { prefs.mode = v; writePrefs(prefs); paintDynamic(); }, 'Chế độ'),
        h('h2', { class: 'card__title' }, 'Cấp độ'),
        seg([[1, 'HSK 1'], [2, 'HSK 2'], [3, 'HSK 3'], [4, 'HSK 4'], [5, 'HSK 5'], [6, 'HSK 6'], [7, 'HSK 7–9']], prefs.level,
          (v) => { prefs.level = v; writePrefs(prefs); if (prefs.mode === 'script') paintDynamic(); }, 'Cấp độ'),
        dynamic,
        prefs.mode === 'ai' ? h('div', { class: 'row' }, h('button', { class: 'btn btn--primary', type: 'button', onClick: startAi }, icons.play(), 'Bắt đầu trò chuyện')) : null,
        isSpeechInputSupported() ? null : h('p', { class: 'small tone-1' }, 'Trình duyệt này không hỗ trợ nhận dạng giọng nói — bạn vẫn nghe được và tự đánh giá khi đọc theo. Dùng Chrome/Edge để được chấm điểm.')));
    paintDynamic();
  }

  // ---------------- Chat shell ----------------
  function chatShell(title, sub) {
    clear(root);
    const log = h('div', { class: 'dialogue talk-log', 'aria-live': 'polite' });
    const panel = h('section', { class: 'card stack talk-panel' });
    const dialogueClass = () => { log.classList.toggle('hide-pinyin', !prefs.pinyin); log.classList.toggle('hide-vi', !prefs.vi); };
    const toggle = (key, label) => {
      const btn = h('button', { class: 'toggle-btn', type: 'button' });
      const paint = () => { btn.setAttribute('aria-pressed', String(prefs[key])); btn.replaceChildren(prefs[key] ? icons.eye() : icons.eyeOff(), `${prefs[key] ? 'Ẩn' : 'Hiện'} ${label}`); dialogueClass(); };
      btn.addEventListener('click', () => { prefs[key] = !prefs[key]; writePrefs(prefs); paint(); });
      paint();
      return btn;
    };
    root.append(
      h('header', { class: 'page-head' },
        h('div', {}, h('h1', {}, title), h('p', { class: 'page-head__sub' }, sub)),
        h('div', { class: 'row' }, toggle('pinyin', 'pinyin'), toggle('vi', 'nghĩa'),
          h('button', { class: 'btn btn--small', type: 'button', onClick: showSetup }, 'Kết thúc'))),
      log, panel);
    const scroll = () => panel.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return { log, panel, scroll };
  }

  function bubble(side, line, { note } = {}) {
    const el = h('div', { class: `bubble bubble--${side}` },
      h('div', { class: 'bubble__zh hanzi', lang: 'zh-CN' }, line.zh,
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Nghe lại', onClick: () => speak(line.zh) }, icons.sound())),
      line.pinyin ? h('div', { class: 'bubble__py pinyin' }, line.pinyin) : null,
      line.vi ? h('div', { class: 'bubble__vi' }, line.vi) : null,
      line.gloss ? h('div', { class: 'bubble__gloss' }, line.viUnreliable ? 'Nghĩa từng từ: ' : '', line.gloss) : null,
      note ?? null);
    return el;
  }

  function feedbackNote(fb) {
    if (!fb || fb.ok) return null;
    return h('div', { class: 'talk-note small' },
      h('strong', {}, '💡 Gợi ý sửa: '), fb.note,
      fb.better ? h('div', {}, 'Người bản xứ nói: ', h('span', { class: 'hanzi', lang: 'zh-CN' }, fb.better), ' ',
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Nghe', onClick: () => speak(fb.better) }, icons.sound())) : null);
  }

  // One suggested answer: hear it, read it aloud, get scored, send it
  function suggestionCard(sug, onSend) {
    const result = h('div', { class: 'stack small' });
    let best = 0;
    const read = async () => {
      if (!isSpeechInputSupported()) { result.replaceChildren(h('p', { class: 'muted' }, 'Hãy đọc to câu này, rồi bấm "Gửi câu này".')); return; }
      result.replaceChildren(h('p', { class: 'muted' }, '🎙️ Đang nghe… hãy đọc to câu trên'));
      try {
        const alts = await listenOnce();
        const top = alts.map((t) => ({ t, s: similarity(sug.zh, t) })).sort((a, b) => b.s - a.s)[0];
        best = Math.max(best, top.s);
        const ok = top.s >= PASS_SIMILARITY;
        result.replaceChildren(
          h('p', { class: ok ? 'tone-3' : 'tone-1' }, ok ? `✓ Chuẩn! Độ khớp ${Math.round(top.s * 100)}%` : `Độ khớp ${Math.round(top.s * 100)}% — thử lại nhé`),
          h('p', { class: 'diff', lang: 'zh-CN' }, diffChars(sug.zh, top.t).map((d) => h('span', { class: `diff__${d.status}` }, d.char))),
          h('p', { class: 'muted' }, `Máy nghe được: «${top.t}»`));
      } catch (e) {
        result.replaceChildren(h('p', { class: 'tone-1' }, e.message === 'not-allowed' ? 'Chưa được cấp quyền micro.' : 'Không nghe được — bấm 🎙️ để thử lại.'));
      }
    };
    return h('div', { class: 'card stack' },
      h('div', { class: 'hanzi', lang: 'zh-CN', style: { fontSize: '1.25rem' } }, sug.zh),
      sug.pinyin ? h('div', { class: 'pinyin bubble__py' }, sug.pinyin) : null,
      sug.vi ? h('div', { class: 'bubble__vi' }, sug.vi) : null,
      sug.gloss ? h('div', { class: 'bubble__gloss' }, sug.viUnreliable ? 'Nghĩa từng từ: ' : '', sug.gloss) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn btn--small', type: 'button', onClick: () => speak(sug.zh) }, icons.sound(), 'Nghe mẫu'),
        h('button', { class: 'btn btn--small', type: 'button', onClick: read }, '🎙️ Đọc theo'),
        h('button', { class: 'btn btn--small btn--primary', type: 'button', onClick: () => onSend({ zh: sug.zh, pinyin: sug.pinyin, vi: sug.vi }, best) }, 'Gửi câu này')),
      result);
  }

  // Free speaking / typing (AI mode)
  function freeBox(onSend) {
    const input = h('input', { class: 'input', type: 'text', lang: 'zh-CN', placeholder: 'Tự nói hoặc gõ câu trả lời bằng tiếng Trung…', 'aria-label': 'Câu trả lời tự do' });
    const status = h('p', { class: 'small muted', role: 'status' });
    const send = () => { const zh = input.value.trim(); if (zh) onSend({ zh }, null); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
    const mic = async () => {
      if (!isSpeechInputSupported()) { status.textContent = 'Trình duyệt chưa hỗ trợ nhận dạng giọng nói — hãy gõ câu trả lời.'; return; }
      status.textContent = '🎙️ Đang nghe…';
      try { input.value = (await listenOnce())[0] ?? ''; status.textContent = 'Kiểm tra lại câu rồi bấm Gửi (sửa được nếu máy nghe sai).'; } catch { status.textContent = 'Không nghe được — thử lại hoặc gõ.'; }
    };
    return h('div', { class: 'stack' },
      h('h3', { class: 'small muted' }, 'Hoặc nói theo ý mình'),
      h('div', { class: 'row' }, input,
        h('button', { class: 'btn btn--small', type: 'button', 'aria-label': 'Nói', onClick: mic }, '🎙️ Nói'),
        h('button', { class: 'btn btn--small btn--primary', type: 'button', onClick: send }, 'Gửi')),
      status);
  }

  // ---------------- Scripted mode ----------------
  function startScripted(situation, role) {
    const { log, panel, scroll } = chatShell(`${situation.icon} ${situation.title_vi}`, `${levelName(situation.level)} · bạn đóng vai ${role}`);
    const turns = scriptedTurns(situation, role);
    const scores = [];
    let i = 0;
    let stopped = false;
    session = { stop() { stopped = true; stopAudio(); stopListening(); } };

    const finish = () => {
      const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) : null;
      append(clear(panel), [h('h2', {}, '🎉 Hoàn thành hội thoại'),
        avg !== null ? h('p', {}, `Độ khớp trung bình khi đọc theo: ${avg}%`) : null,
        h('ul', { class: 'tips' }, situation.tips.map((t) => h('li', {}, t))),
        h('div', { class: 'row' }, h('button', { class: 'btn btn--primary', type: 'button', onClick: () => startScripted(situation, role) }, 'Nói lại'),
          h('button', { class: 'btn', type: 'button', onClick: showSetup }, 'Chọn tình huống khác'))]);
      scroll();
    };

    const advance = async () => {
      while (!stopped && i < turns.length && !turns[i].mine) {
        const line = turns[i].line;
        log.append(bubble('left', { zh: line.zh, pinyin: line.py, vi: line.vi }));
        scroll();
        await speak(line.zh);
        i += 1;
      }
      if (stopped) return;
      if (i >= turns.length) { finish(); return; }
      const mine = turns[i].line;
      clear(panel).append(h('h2', { class: 'card__title' }, 'Đến lượt bạn — đọc theo câu này'),
        suggestionCard({ zh: mine.zh, pinyin: mine.py, vi: mine.vi }, (line, score) => {
          if (score !== null) scores.push(score);
          log.append(bubble('right', line));
          i += 1;
          advance();
        }));
      scroll();
    };
    advance();
  }

  // ---------------- AI mode ----------------
  function startAi() {
    const topic = prefs.customTopic.trim() || TALK_TOPICS.find((t) => t.id === prefs.topic)?.prompt;
    const system = buildSystemPrompt({ level: prefs.level, topic, knownWords: sampleKnownWords(prefs.level) });
    const { log, panel, scroll } = chatShell('Trò chuyện với 小林', `${levelName(prefs.level)} · tối đa ${TALK_LEVELS[prefs.level].maxChars} chữ/câu · model ${prefs.model}`);
    const history = [];
    let lastUserEl = null;
    let stopped = false;
    let ctrl = null;
    session = { stop() { stopped = true; ctrl?.abort(); stopAudio(); stopListening(); } };

    const modelError = (e) => {
      if (e.status === 404) return `Ollama chưa có model «${prefs.model}». Chạy: ollama pull ${prefs.model} — hoặc chọn model khác ở màn hình cài đặt.`;
      if (e.status === 500) return 'Ollama báo lỗi, thường do hết RAM khi nhiều model cùng chạy. Hãy chạy «ollama stop <tên model không dùng>» rồi thử lại.';
      return e.name === 'AbortError' ? 'Quá thời gian chờ model.' : 'Không gọi được Ollama. Kiểm tra Ollama đang chạy và quyền truy cập (OLLAMA_ORIGINS).';
    };

    // Lượt 1: trợ lý nói (kèm nhận xét câu trước của người học). Lượt 2 (nhỏ hơn): 3 câu gợi ý để đáp lại.
    async function assistantTurn() {
      clear(panel).append(h('p', { class: 'muted center', role: 'status' }, '小林 đang suy nghĩ… (model chạy trên máy nên có thể mất vài giây)'));
      scroll();
      ctrl = new AbortController();
      let turn = null;
      let rawReply = '';
      try {
        for (let attempt = 0; attempt < 2 && !turn; attempt++) {
          rawReply = await chat({ base: prefs.url, model: prefs.model, messages: buildMessages(system, history), maxTokens: REPLY_MAX_TOKENS, signal: ctrl.signal });
          turn = parseTurn(rawReply);
        }
      } catch (e) {
        if (!stopped) showError(modelError(e));
        return;
      }
      if (stopped) return;
      if (!turn) { showError('Model trả lời sai định dạng. Thử lại hoặc dùng model lớn hơn (qwen2.5:3b / 7b).'); return; }
      history.push({ role: 'assistant', raw: rawReply });

      // Attach correction of the learner's previous message to their bubble
      const note = feedbackNote(turn.feedback);
      if (note && lastUserEl) lastUserEl.append(note);
      log.append(bubble('left', withPinyin(turn.reply)));
      speak(turn.reply.zh);
      clear(panel).append(h('p', { class: 'muted center', role: 'status' }, 'Đang nghĩ các câu gợi ý cho bạn…'));
      scroll();

      let suggestions = [];
      try {
        for (let attempt = 0; attempt < 2 && suggestions.length < 2; attempt++) {
          const raw = await chat({ base: prefs.url, model: prefs.model, signal: ctrl.signal, temperature: 0.7, maxTokens: SUGGESTION_MAX_TOKENS,
            messages: buildSuggestionMessages({ level: prefs.level, topic, replyZh: turn.reply.zh }) });
          const got = parseSuggestions(raw, prefs.level);
          if (got.length > suggestions.length) suggestions = got;
        }
      } catch (e) {
        if (!stopped) showError(modelError(e));
        return;
      }
      if (stopped) return;
      showUserTurn(suggestions);
      scroll();
    }

    function showError(message) {
      clear(panel).append(h('p', { class: 'tone-1' }, message),
        h('div', { class: 'row' }, h('button', { class: 'btn btn--primary', type: 'button', onClick: assistantTurn }, 'Thử lại'),
          h('button', { class: 'btn', type: 'button', onClick: showSetup }, 'Đổi cài đặt')));
    }

    function showUserTurn(suggestions) {
      const send = (line) => {
        stopAudio();
        stopListening();
        history.push({ role: 'user', zh: line.zh });
        lastUserEl = bubble('right', withPinyin(line));
        log.append(lastUserEl);
        assistantTurn();
      };
      clear(panel).append(
        h('h2', { class: 'card__title' }, 'Đến lượt bạn — chọn câu gợi ý và đọc theo'),
        ...(suggestions.length ? [] : [h('p', { class: 'muted small' }, 'Lần này model không đưa ra được câu gợi ý — hãy tự nói hoặc gõ câu trả lời bên dưới.')]),
        ...suggestions.map((s) => suggestionCard(withPinyin(s), send)),
        freeBox(send));
    }

    // Use a model that is actually installed (the saved/default one may be missing)
    listModels(prefs.url).then((models) => {
      if (models.length && !models.includes(prefs.model)) {
        prefs.model = pickModel(models, prefs.model);
        writePrefs(prefs);
      }
    }).catch(() => {}).finally(() => { if (!stopped) assistantTurn(); });
  }

  showSetup();
  return { destroy() { session?.stop(); } };
}
