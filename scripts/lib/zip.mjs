// Minimal read-only ZIP reader (supports ZIP64, stored & deflate) — enough for Anki .apkg files
import { open } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';

const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX32 = 0xffffffff;

export async function openZip(file) {
  const fh = await open(file, 'r');
  const { size } = await fh.stat();

  const read = async (position, length) => {
    const buf = Buffer.alloc(length);
    await fh.read(buf, 0, length, position);
    return buf;
  };

  // End of central directory: last 22 bytes + up to 64 KB comment
  const tailLen = Math.min(size, 22 + 0xffff);
  const tail = await read(size - tailLen, tailLen);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === SIG_EOCD) { eocd = i; break; }
  if (eocd < 0) throw new Error('Not a zip file (EOCD not found)');
  let entriesTotal = tail.readUInt16LE(eocd + 10);
  let cdSize = tail.readUInt32LE(eocd + 12);
  let cdOffset = tail.readUInt32LE(eocd + 16);

  if (entriesTotal === 0xffff || cdOffset === MAX32 || cdSize === MAX32) {
    const locPos = size - tailLen + eocd - 20;
    const loc = await read(locPos, 20);
    if (loc.readUInt32LE(0) !== SIG_ZIP64_LOCATOR) throw new Error('ZIP64 locator missing');
    const z64 = await read(Number(loc.readBigUInt64LE(8)), 56);
    if (z64.readUInt32LE(0) !== SIG_ZIP64_EOCD) throw new Error('ZIP64 EOCD missing');
    entriesTotal = Number(z64.readBigUInt64LE(32));
    cdSize = Number(z64.readBigUInt64LE(40));
    cdOffset = Number(z64.readBigUInt64LE(48));
  }

  const cd = await read(cdOffset, cdSize);
  const entries = new Map();
  let p = 0;
  for (let n = 0; n < entriesTotal; n++) {
    if (cd.readUInt32LE(p) !== SIG_CENTRAL) throw new Error(`Bad central header at entry ${n}`);
    const method = cd.readUInt16LE(p + 10);
    let compressedSize = cd.readUInt32LE(p + 20);
    let uncompressedSize = cd.readUInt32LE(p + 24);
    const nameLen = cd.readUInt16LE(p + 28);
    const extraLen = cd.readUInt16LE(p + 30);
    const commentLen = cd.readUInt16LE(p + 32);
    let localOffset = cd.readUInt32LE(p + 42);
    const name = cd.toString('utf8', p + 46, p + 46 + nameLen);
    // ZIP64 extra field supplies the values that are saturated at 0xFFFFFFFF
    let e = p + 46 + nameLen;
    const extraEnd = e + extraLen;
    while (e + 4 <= extraEnd) {
      const id = cd.readUInt16LE(e);
      const len = cd.readUInt16LE(e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (uncompressedSize === MAX32) { uncompressedSize = Number(cd.readBigUInt64LE(q)); q += 8; }
        if (compressedSize === MAX32) { compressedSize = Number(cd.readBigUInt64LE(q)); q += 8; }
        if (localOffset === MAX32) { localOffset = Number(cd.readBigUInt64LE(q)); q += 8; }
      }
      e += 4 + len;
    }
    entries.set(name, { name, method, compressedSize, uncompressedSize, localOffset });
    p = extraEnd + commentLen;
  }

  async function readEntry(name) {
    const entry = entries.get(name);
    if (!entry) throw new Error(`Entry not found: ${name}`);
    const header = await read(entry.localOffset, 30);
    if (header.readUInt32LE(0) !== SIG_LOCAL) throw new Error(`Bad local header: ${name}`);
    const dataStart = entry.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    const raw = await read(dataStart, entry.compressedSize);
    if (entry.method === 0) return raw;
    if (entry.method === 8) return inflateRawSync(raw);
    throw new Error(`Unsupported compression method ${entry.method} for ${name}`);
  }

  return { entries, readEntry, close: () => fh.close() };
}
