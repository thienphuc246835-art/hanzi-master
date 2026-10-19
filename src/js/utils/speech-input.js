// Nhận dạng giọng nói (Web Speech API, zh-CN) — trả về các phương án nhận dạng, tốt nhất trước
const Recognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export const isSpeechInputSupported = () => !!Recognition;

let active = null;

export function stopListening() {
  active?.abort();
  active = null;
}

// Rejects with an Error whose message is the SpeechRecognition error code ('not-allowed', 'no-speech', …)
export function listenOnce({ lang = 'zh-CN', maxAlternatives = 3 } = {}) {
  return new Promise((resolve, reject) => {
    if (!Recognition) { reject(new Error('unsupported')); return; }
    stopListening();
    const rec = new Recognition();
    active = rec;
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = maxAlternatives;
    rec.onresult = (e) => resolve([...e.results[0]].map((r) => r.transcript));
    rec.onerror = (e) => reject(new Error(e.error));
    rec.onend = () => { if (active === rec) active = null; };
    try { rec.start(); } catch (e) { reject(e); }
  });
}
