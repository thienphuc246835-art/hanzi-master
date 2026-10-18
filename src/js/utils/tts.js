// Text-to-speech (Web Speech API) + small audio cues

let zhVoice = null;
let voicesReady = null;

export const isTtsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  zhVoice = voices.find((v) => /zh[-_]CN/i.test(v.lang)) ??
    voices.find((v) => /^zh/i.test(v.lang) && !/HK|TW/i.test(v.lang)) ??
    voices.find((v) => /^zh/i.test(v.lang)) ?? null;
  return zhVoice;
}

// Resolves to true when a Chinese voice is available (voices load asynchronously)
export function initTts(timeoutMs = 1500) {
  if (!isTtsSupported()) return Promise.resolve(false);
  if (voicesReady) return voicesReady;
  voicesReady = new Promise((resolve) => {
    if (pickVoice()) return resolve(true);
    const done = () => resolve(!!pickVoice());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, timeoutMs);
  });
  return voicesReady;
}

export function hasChineseVoice() {
  return !!zhVoice;
}

export function stopSpeaking() {
  if (isTtsSupported()) speechSynthesis.cancel();
}

export function speak(text, { rate = 0.85 } = {}) {
  return new Promise((resolve) => {
    if (!isTtsSupported() || !text) return resolve(false);
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (zhVoice) u.voice = zhVoice;
    u.rate = rate;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    speechSynthesis.speak(u);
  });
}

let audioCtx = null;

export function beep({ freq = 880, ms = 260 } = {}) {
  return new Promise((resolve) => {
    try {
      audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + ms / 1000);
      osc.onended = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Read a sequence of text parts; `null` parts are replaced by a beep (Mode 6 listening)
export async function speakWithBeeps(parts, { rate = 0.85, isCancelled = () => false } = {}) {
  for (const part of parts) {
    if (isCancelled()) return;
    if (part === null) await beep();
    else if (part.trim()) await speak(part, { rate });
  }
}
