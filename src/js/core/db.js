// IndexedDB layer (native API — no external dependency so the app works offline)
import { DB_NAME, DB_VERSION } from './constants.js';

const STORES = Object.freeze({
  words: { keyPath: 'id', indexes: [['hsk_level', 'hsk_level']] },
  cards: { keyPath: 'word_id', indexes: [['due', 'due'], ['state', 'state']] },
  attempts: { keyPath: 'id', autoIncrement: true, indexes: [['timestamp', 'timestamp'], ['word_id', 'word_id']] },
  meta: { keyPath: 'key' },
});

let dbPromise = null;

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, def] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath: def.keyPath, autoIncrement: !!def.autoIncrement });
        for (const [idx, path] of def.indexes ?? []) store.createIndex(idx, path);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; }, reject);
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export const db = {
  getAll: (store) => tx(store, 'readonly', (s) => promisify(s.getAll())),
  get: (store, key) => tx(store, 'readonly', (s) => promisify(s.get(key))),
  put: (store, value) => tx(store, 'readwrite', (s) => promisify(s.put(value))),
  add: (store, value) => tx(store, 'readwrite', (s) => promisify(s.add(value))),
  delete: (store, key) => tx(store, 'readwrite', (s) => promisify(s.delete(key))),
  clear: (store) => tx(store, 'readwrite', (s) => promisify(s.clear())),
  count: (store) => tx(store, 'readonly', (s) => promisify(s.count())),
  bulkPut: (store, values) => tx(store, 'readwrite', (s) => {
    for (const v of values) s.put(v);
  }),
};

export async function getMeta(key, fallback = null) {
  const row = await db.get('meta', key);
  return row ? row.value : fallback;
}

export async function setMeta(key, value) {
  await db.put('meta', { key, value });
}

export async function exportAll() {
  const [cards, attempts, meta] = await Promise.all([db.getAll('cards'), db.getAll('attempts'), db.getAll('meta')]);
  return { cards, attempts, meta };
}

export async function importAll(data) {
  if (Array.isArray(data.cards)) {
    await db.clear('cards');
    await db.bulkPut('cards', data.cards);
  }
  if (Array.isArray(data.attempts)) {
    await db.clear('attempts');
    await db.bulkPut('attempts', data.attempts);
  }
}

export async function resetProgress() {
  await Promise.all([db.clear('cards'), db.clear('attempts')]);
}
