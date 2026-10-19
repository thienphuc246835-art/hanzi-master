// Handwriting practice sheets (layout from voviet.png) — pure functions that build SVG strings.
// Per character: row 1 = model glyph + strokes appearing one by one, row 2 = grey trace, row 3 = blank.
export const SHEET = Object.freeze({
  width: 595,
  height: 842,
  cols: 11,
  rowsPerChar: 3,
  charsPerPage: 5,
  marginX: 40,
  top: 78,
});

const GLYPH_SIZE = 1024;
const GLYPH_PAD = 0.08;
const GHOST_COLOR = '#b9b9b9';
const GRID_COLOR = '#6b6b6b';
const GUIDE_COLOR = '#b4b4b4';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Unique Han characters of the given words, in order of appearance
export function uniqueChars(texts) {
  const seen = new Set();
  for (const t of texts) {
    for (const ch of String(t)) if (/\p{Script=Han}/u.test(ch)) seen.add(ch);
  }
  return [...seen];
}

export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Number of strokes shown in progressive cell j (1-based, of `steps` cells)
export function strokesShown(strokeCount, j, steps) {
  if (strokeCount <= steps) return Math.min(j, strokeCount);
  return Math.ceil((j * strokeCount) / steps);
}

// Glyph as <g> at (x, y) in a box of `size`; strokes = HanziWriter path list; null data → text fallback
function glyph(data, char, x, y, size, count, fill) {
  const pad = size * GLYPH_PAD;
  const inner = size - pad * 2;
  if (!data) {
    return `<text x="${x + size / 2}" y="${y + size * 0.78}" font-size="${inner}" text-anchor="middle" fill="${fill}" font-family="KaiTi,'Noto Serif SC','Songti SC',serif">${esc(char)}</text>`;
  }
  const s = inner / GLYPH_SIZE;
  const paths = data.strokes.slice(0, count).map((d) => `<path d="${d}"/>`).join('');
  return `<g fill="${fill}" transform="translate(${(x + pad).toFixed(2)} ${(y + pad).toFixed(2)}) scale(${s.toFixed(5)} ${-s.toFixed(5)}) translate(0 -900)">${paths}</g>`;
}

function cell(x, y, size, guides) {
  const m = size / 2;
  let out = `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" fill="none" stroke="${GRID_COLOR}" stroke-width="0.8"/>`;
  if (guides) {
    out += `<path d="M${(x + m).toFixed(2)} ${y.toFixed(2)}V${(y + size).toFixed(2)}M${x.toFixed(2)} ${(y + m).toFixed(2)}H${(x + size).toFixed(2)}" stroke="${GUIDE_COLOR}" stroke-width="0.6" stroke-dasharray="3 2.5" fill="none"/>`;
  }
  return out;
}

// Build one A4 page. chars: [{ char, data }]; opts: { title, page, pages, guides, steps }
export function buildPage(chars, opts = {}) {
  const { title = '', page = 1, pages = 1, guides = true, ghostCells = true } = opts;
  const { width, height, cols, rowsPerChar, marginX, top } = SHEET;
  const size = (width - marginX * 2) / cols;
  const steps = cols - 1;
  const parts = [];

  parts.push(`<text x="${marginX}" y="38" font-size="15" font-weight="700" fill="#222" font-family="Inter,Arial,sans-serif">HànZì Master</text>`);
  parts.push(`<text x="${marginX}" y="54" font-size="8.5" fill="#777" font-family="Inter,Arial,sans-serif">Bảng tập viết chữ Hán${title ? ` · ${esc(title)}` : ''}</text>`);
  parts.push(`<text x="${width - marginX}" y="${height - 28}" font-size="9" text-anchor="end" fill="#777" font-family="Inter,Arial,sans-serif">${page}/${pages}</text>`);

  chars.forEach(({ char, data }, ci) => {
    const y0 = top + ci * rowsPerChar * size;
    for (let r = 0; r < rowsPerChar; r++) {
      for (let c = 0; c < cols; c++) parts.push(cell(marginX + c * size, y0 + r * size, size, guides));
    }
    const total = data ? data.strokes.length : 1;
    // Row 1: model + progressive strokes (grey), the last cells show the whole character
    parts.push(glyph(data, char, marginX, y0, size, total, '#111'));
    for (let j = 1; j <= steps; j++) {
      const count = strokesShown(total, j, steps);
      parts.push(glyph(data, char, marginX + j * size, y0 + 0, size, count, GHOST_COLOR));
    }
    // Row 2: full grey trace in every cell
    if (ghostCells) {
      for (let c = 0; c < cols; c++) parts.push(glyph(data, char, marginX + c * size, y0 + size, size, total, GHOST_COLOR));
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="sheet-page" role="img" aria-label="Trang tập viết ${page}/${pages}"><rect width="${width}" height="${height}" fill="#fff"/>${parts.join('')}</svg>`;
}

// All pages for a character list
export function buildPages(chars, opts = {}) {
  const groups = chunk(chars, SHEET.charsPerPage);
  return groups.map((g, i) => buildPage(g, { ...opts, page: i + 1, pages: groups.length }));
}
