// Trợ lý hội thoại AI — prompt theo cấp HSK, đọc phản hồi JSON của model, dựng hàng đợi kịch bản. Pure functions.

// Giới hạn độ dài câu & văn phạm theo cấp (HSK 7 = nhóm 7–9)
export const TALK_LEVELS = Object.freeze({
  1: { maxChars: 12, grammar: 'only very basic patterns: 是, 有, 在, 想, 要, 吗/呢 questions, simple 的' },
  2: { maxChars: 16, grammar: 'basic patterns plus 了, 过, 比, 因为…所以…, simple complements' },
  3: { maxChars: 22, grammar: 'patterns up to 把, 被, 如果…就…, 虽然…但是…, 得-complements' },
  4: { maxChars: 28, grammar: 'common compound sentences, 连…都…, 一边…一边…, simple idioms' },
  5: { maxChars: 36, grammar: 'longer compound sentences, 不仅…而且…, 即使…也…, common idioms' },
  6: { maxChars: 45, grammar: 'natural written/spoken mix, 与其…不如…, 否则, set phrases' },
  7: { maxChars: 60, grammar: 'near-native speech: idioms, 成语, abstract topics, subtle register' },
});

export const TALK_TOPICS = Object.freeze([
  { id: 'free', label: 'Trò chuyện tự do', prompt: 'small talk: meeting someone new, how their day was, hobbies' },
  { id: 'food', label: 'Ăn uống', prompt: 'food, restaurants, cooking, what to eat today' },
  { id: 'shopping', label: 'Mua sắm', prompt: 'shopping, prices, bargaining, online orders' },
  { id: 'work', label: 'Công việc & học tập', prompt: 'work or study, colleagues/classmates, schedules' },
  { id: 'travel', label: 'Du lịch & đi lại', prompt: 'travel plans, transport, directions, hotels' },
  { id: 'family', label: 'Gia đình & bạn bè', prompt: 'family, friends, weekends together' },
  { id: 'health', label: 'Sức khỏe', prompt: 'feeling unwell, doctor, healthy habits, sports' },
  { id: 'hobby', label: 'Sở thích & giải trí', prompt: 'movies, music, games, sports, weekend plans' },
]);

export const SUGGESTION_COUNT = 3;
export const FIRST_USER_MESSAGE = '（对话开始，请你先开口，自然地打招呼并提一个问题。）';

export function clampLevel(level) {
  return Math.min(7, Math.max(1, Number(level) || 1));
}

export function levelName(level) {
  return clampLevel(level) === 7 ? 'HSK 7–9' : `HSK ${clampLevel(level)}`;
}

const VI_RULE = '- "vi": accurate, natural Vietnamese translation of the Chinese — always Vietnamese, never English. Remember 汉语/中文 = "tiếng Trung" (not tiếng Việt), 中国 = "Trung Quốc".';

export function buildSystemPrompt({ level, topic, knownWords = [] }) {
  const lv = clampLevel(level);
  const p = TALK_LEVELS[lv];
  const topicText = topic?.trim() || TALK_TOPICS[0].prompt;
  return [
    'You are 小林, a friendly native Mandarin speaker in your twenties from Beijing, chatting casually with a Vietnamese learner.',
    `The learner's level is ${levelName(lv)} (HSK 3.0). Stay inside it: vocabulary at or below ${levelName(lv)}, ${p.grammar}.`,
    `Topic: ${topicText}.`,
    '',
    'How to sound like a real person, not a textbook:',
    '- Everyday spoken Chinese: natural particles (呢、吧、啊、嘛、哦), contractions and fillers (嗯、哎、对了、那…), no stiff written phrasing.',
    `- Short turns: 1–2 sentences, at most ${p.maxChars} Chinese characters per sentence.`,
    '- First react to what the learner just said (agree, be surprised, share a tiny detail about yourself), then ask ONE follow-up question. Vary your questions; never repeat one.',
    '- Never explain grammar or translate inside "reply". Never use lists or emojis. Do not switch to Vietnamese or English inside "reply.zh".',
    '- If the learner struggles or answers off-topic, simplify and gently steer back; if they answer well, add a little more depth.',
    knownWords.length ? `- Words the learner is currently studying — reuse them naturally when they fit: ${knownWords.join('、')}.` : '',
    '',
    'Reply with ONE JSON object and nothing else, exactly this shape:',
    '{"reply":{"zh":"…","vi":"…"},',
    ' "feedback":{"ok":true,"note_vi":"","better_zh":""}}',
    '',
    VI_RULE,
    '- "feedback": judge ONLY the learner\'s last message. If it is correct and natural, {"ok":true,"note_vi":"","better_zh":""}. If there is a mistake or it sounds unnatural, {"ok":false,"note_vi":"one short Vietnamese sentence explaining the fix","better_zh":"how a native would say it"}. On the very first turn feedback is always ok.',
  ].filter((l) => l !== '').join('\n');
}

const stripFences = (s) => String(s).replace(/```(?:json)?/gi, '').trim();

function cleanLine(x) {
  if (!x || typeof x.zh !== 'string' || !x.zh.trim()) return null;
  return { zh: x.zh.trim(), pinyin: '', vi: String(x.vi ?? '').trim() };
}

// Raw model text → { reply, suggestions, feedback } | null (model returned something unusable)
export function parseTurn(raw) {
  const text = stripFences(raw);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let obj;
  try { obj = JSON.parse(text.slice(start, end + 1)); } catch { return null; }
  const reply = cleanLine(obj.reply);
  if (!reply) return null;
  const suggestions = (Array.isArray(obj.suggestions) ? obj.suggestions : []).map(cleanLine).filter(Boolean).slice(0, SUGGESTION_COUNT);
  const fb = obj.feedback ?? {};
  const feedback = fb.ok === false && (fb.note_vi || fb.better_zh)
    ? { ok: false, note: String(fb.note_vi ?? '').trim(), better: String(fb.better_zh ?? '').trim() }
    : { ok: true, note: '', better: '' };
  return { reply, suggestions, feedback };
}

// history: [{ role: 'assistant', raw } | { role: 'user', zh }] → messages for a chat API (keeps the last `keep` turns)
export function buildMessages(system, history, keep = 8) {
  const recent = history.slice(-keep);
  return [
    { role: 'system', content: system },
    { role: 'user', content: FIRST_USER_MESSAGE },
    ...recent.map((m) => (m.role === 'assistant' ? { role: 'assistant', content: m.raw } : { role: 'user', content: m.zh })),
  ];
}

// Kịch bản có sẵn: người học đóng vai `role`; trả về các lượt { who, line, mine }
export function scriptedTurns(situation, role) {
  return situation.lines.map((line) => ({ line, mine: line.who === role }));
}

export function scenariosForLevel(situations, level) {
  return situations.filter((s) => s.level <= clampLevel(level));
}

// Yêu cầu thứ hai (nhỏ hơn): 3 câu người học có thể đáp lại — model nhỏ làm việc này ổn định hơn khi tách riêng
export function buildSuggestionMessages({ level, topic, replyZh }) {
  const lv = clampLevel(level);
  const p = TALK_LEVELS[lv];
  return [
    { role: 'system', content: [
      `You help a Vietnamese learner (${levelName(lv)}) answer a native Mandarin speaker in a casual chat about: ${topic?.trim() || TALK_TOPICS[0].prompt}.`,
      `Give exactly ${SUGGESTION_COUNT} short, natural, spoken replies the learner could say next. Each at most ${p.maxChars} Chinese characters, vocabulary within ${levelName(lv)}, each with a DIFFERENT intent: (1) answer the question directly, (2) add a small personal detail, (3) ask the speaker something back.`,
      'Reply with ONE JSON object only: {"suggestions":[{"zh":"…","vi":"…"},{"zh":"…","vi":"…"},{"zh":"…","vi":"…"}]}',
      VI_RULE,
    ].join('\n') },
    { role: 'user', content: `The native speaker just said: 「${replyZh}」` },
  ];
}

const HAN = /\p{Script=Han}/u;

// Raw text → [{ zh, pinyin: '', vi }] (only entries that really contain Chinese)
export function parseSuggestions(raw, level = 1) {
  const text = stripFences(raw);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return [];
  let obj;
  try { obj = JSON.parse(text.slice(start, end + 1)); } catch { return []; }
  const limit = TALK_LEVELS[clampLevel(level)].maxChars * 2;
  const seen = new Set();
  return (Array.isArray(obj.suggestions) ? obj.suggestions : [])
    .map(cleanLine)
    .filter((x) => x && HAN.test(x.zh) && [...x.zh].length <= limit && !seen.has(x.zh) && seen.add(x.zh))
    .slice(0, SUGGESTION_COUNT);
}
