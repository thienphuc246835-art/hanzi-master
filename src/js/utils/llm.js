// Ollama client (model chạy trên máy người học). Không cần khoá API, không gửi dữ liệu ra ngoài.
export const OLLAMA_DEFAULT_URL = 'http://localhost:11434';
export const OLLAMA_DEFAULT_MODEL = 'qwen2.5:3b';
// Smaller context = less RAM and faster prompt processing (enough for the prompt + ~8 turns)
const NUM_CTX = 3072;
const RETRIES_ON_500 = 2;
const RETRY_DELAY_MS = 3000;
const TAGS_TIMEOUT_MS = 4000;
const CHAT_TIMEOUT_MS = 180000;

const trimUrl = (base) => String(base || OLLAMA_DEFAULT_URL).replace(/\/+$/, '');

async function fetchJson(url, options = {}, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  options.signal?.addEventListener('abort', () => ctrl.abort());
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal });
    if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

// → ['qwen2.5:3b', …]; throws when the server is unreachable (not running, or CORS blocked)
export async function listModels(base) {
  const data = await fetchJson(`${trimUrl(base)}/api/tags`, {}, TAGS_TIMEOUT_MS);
  return (data.models ?? []).map((m) => m.name);
}

// Non-streaming JSON-mode chat → assistant text
export async function chat({ base, model, messages, temperature = 0.8, maxTokens = 700, signal }) {
  const request = () => fetchJson(`${trimUrl(base)}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, format: 'json', keep_alive: '30m', options: { temperature, num_predict: maxTokens, num_ctx: NUM_CTX } }),
    signal,
  }, CHAT_TIMEOUT_MS);
  // A 500 right after (re)loading a model on a low-RAM machine is usually transient: retry a couple of times
  for (let attempt = 0; ; attempt++) {
    try {
      const data = await request();
      return data.message?.content ?? '';
    } catch (e) {
      if (e.status !== 500 || attempt >= RETRIES_ON_500 || signal?.aborted) throw e;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}
