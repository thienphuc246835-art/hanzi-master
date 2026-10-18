// Real recorded audio from the imported deck, with TTS as fallback
import { speak, stopSpeaking } from './tts.js';

const AUDIO_BASE = 'src/assets/audio/';
let current = null;
let audioIndex = new Map(); // Chinese text → audio file name

export function setAudioIndex(index) {
  audioIndex = index;
}

export function hasRecordedAudio(text) {
  return audioIndex.has(text);
}

export function stopAudio() {
  if (current) {
    current.pause();
    current = null;
  }
  stopSpeaking();
}

export function playFile(file, { rate = 1 } = {}) {
  return new Promise((resolve) => {
    stopAudio();
    const el = new Audio(AUDIO_BASE + file);
    el.playbackRate = rate;
    current = el;
    el.onended = () => resolve(true);
    el.onerror = () => resolve(false);
    el.play().catch(() => resolve(false));
  });
}

// Play the recording for this exact text if the deck has one, otherwise synthesise it
export async function playText(text, { rate = 0.85, slow = false } = {}) {
  const file = audioIndex.get(text);
  if (file) {
    const ok = await playFile(file, { rate: slow ? 0.75 : 1 });
    if (ok) return true;
  }
  return speak(text, { rate: slow ? rate * 0.75 : rate });
}
