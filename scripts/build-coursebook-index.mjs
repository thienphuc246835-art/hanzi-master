// Tạo src/js/data/coursebook/index.json từ các file lNN.json (chạy lại sau khi thêm bài): npm run coursebook-index
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'js', 'data', 'coursebook');
const lessons = readdirSync(dir)
  .filter((f) => /^l\d+\.json$/.test(f))
  .map((file) => {
    const l = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    return {
      number: l.number, file, title_zh: l.title_zh, title_vi: l.title_vi,
      words: l.texts.reduce((n, t) => n + t.vocab.length, 0), extra: l.extra.length, texts: l.texts.length,
    };
  })
  .sort((a, b) => a.number - b.number);

writeFileSync(join(dir, 'index.json'), `${JSON.stringify({ book: '发展汉语 · 初级综合 (I)', lessons }, null, 2)}\n`);
console.log(`coursebook index: ${lessons.length} lessons`);
