// Generates simple placeholder PNG app icons (solid rounded square + spine curve)
// without any native dependencies, by writing raw pixels and PNG-encoding with zlib.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const BG = [0x1c, 0x5c, 0xab, 255];
const FG = [255, 255, 255, 255];

function crc32(buf) {
  let c,
    table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256).map((_, n) => {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c;
    });
  }
  let crc = -1;
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function drawIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = c[3];
  };
  // rounded-rect background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.max(radius - x, x - (size - 1 - radius), 0);
      const cy = Math.max(radius - y, y - (size - 1 - radius), 0);
      if (cx * cx + cy * cy <= radius * radius) put(x, y, BG);
      else if (cx === 0 || cy === 0) put(x, y, BG);
    }
  }
  // S-shaped spine curve made of dots
  const stroke = size * 0.065;
  for (let t = 0; t <= 1; t += 0.002) {
    const y = size * (0.18 + 0.64 * t);
    const x = size * (0.5 + 0.13 * Math.sin(t * Math.PI * 2));
    for (let dy = -stroke; dy <= stroke; dy++) {
      for (let dx = -stroke; dx <= stroke; dx++) {
        if (dx * dx + dy * dy <= stroke * stroke) put(Math.round(x + dx), Math.round(y + dy), FG);
      }
    }
  }
  // head dot
  const hr = size * 0.085;
  for (let dy = -hr; dy <= hr; dy++) {
    for (let dx = -hr; dx <= hr; dx++) {
      if (dx * dx + dy * dy <= hr * hr)
        put(Math.round(size * 0.5 + dx), Math.round(size * 0.13 + dy), FG);
    }
  }
  return encodePng(size, px);
}

for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  writeFileSync(join(outDir, name), drawIcon(size));
  console.log(`wrote ${name} (${size}x${size})`);
}
