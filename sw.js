// Service worker — offline-first app shell + data cache (CLAUDE.md §10.1)
const CACHE = 'hzm-v4';
const MEDIA_CACHE = 'hzm-media-v1';

const APP_SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'src/assets/icons/icon.svg',
  'src/css/tokens.css',
  'src/css/main.css',
  'src/css/components.css',
  'src/css/animations.css',
  'src/js/app.js',
  'src/js/core/constants.js',
  'src/js/core/srs.js',
  'src/js/core/scheduler.js',
  'src/js/core/exercise-picker.js',
  'src/js/core/grader.js',
  'src/js/core/distractors.js',
  'src/js/core/db.js',
  'src/js/core/store.js',
  'src/js/core/session.js',
  'src/js/utils/dom.js',
  'src/js/utils/ui.js',
  'src/js/utils/tts.js',
  'src/js/utils/pinyin.js',
  'src/js/utils/random.js',
  'src/js/utils/date.js',
  'src/js/utils/drag.js',
  'src/js/utils/audio.js',
  'src/js/utils/strokes.js',
  'src/js/utils/icons.js',
  'src/js/core/text.js',
  'src/js/pages/lessons.js',
  'src/js/pages/lesson.js',
  'src/js/pages/reading.js',
  'src/js/components/flashcard.js',
  'src/js/components/word-detail.js',
  'src/js/components/progress.js',
  'src/js/components/hsk-navigator.js',
  'src/js/components/word-board.js',
  'src/js/components/exercises/index.js',
  'src/js/components/exercises/common.js',
  'src/js/components/exercises/listening.js',
  'src/js/components/exercises/cloze.js',
  'src/js/components/exercises/writing.js',
  'src/js/components/exercises/multiple-choice.js',
  'src/js/components/exercises/cloze-passage.js',
  'src/js/components/exercises/matching.js',
  'src/js/components/exercises/sentence-builder.js',
  'src/js/components/exercises/tone-drill.js',
  'src/js/components/exercises/radical-assembly.js',
  'src/js/components/exercises/dictation.js',
  'src/js/components/exercises/translation.js',
  'src/js/components/exercises/speaking.js',
  'src/js/components/exercises/collocation.js',
  'src/js/components/exercises/speed-round.js',
  'src/js/pages/dashboard.js',
  'src/js/pages/study.js',
  'src/js/pages/browse.js',
  'src/js/pages/stats.js',
  'src/js/pages/settings.js',
  'src/js/pages/onboarding.js',
  'src/js/pages/practice.js',
  'src/js/pages/writing.js',
  'src/js/utils/writing-sheet.js',
  'src/js/data/manifest.json',
  'src/js/data/lessons.json',
  'src/js/data/hanzi.json',
  'src/js/data/collocations.json',
  'src/js/data/radicals.json',
  // Vocabulary files (~20 MB) are cached at runtime on first load
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MEDIA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Same-origin: network first (fresh code/data), cache fallback when offline.
// Cross-origin (fonts, HanziWriter, stroke data): cache first, then network.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Audio, images and stroke data never change: cache-first in a separate cache
  if (sameOrigin && /\/src\/(assets\/|js\/data\/strokes\/)/.test(url.pathname)) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then((cache) => cache.match(request).then((hit) => hit ?? fetch(request).then((res) => {
        if (res.ok && res.status === 200) cache.put(request, res.clone());
        return res;
      }))),
    );
    return;
  }

  if (sameOrigin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match('index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => hit ?? fetch(request).then((res) => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    })),
  );
});
