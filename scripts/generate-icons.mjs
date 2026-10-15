/**
 * Generates the Roose Flow brand icons.
 *
 * Written as a script rather than checked-in binaries so the mark can be
 * re-rendered at any size if the branding changes. Encodes PNG by hand via
 * zlib to avoid pulling an image dependency into the project.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const SIZES = [16, 48, 128];
const SUPERSAMPLE = 4;

/* -------------------------------------------------------------- */
/* PNG encoding                                                     */
/* -------------------------------------------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha

  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------------- */
/* Artwork                                                          */
/* -------------------------------------------------------------- */

// Navy plate carrying an amber chevron: the forward motion of a queue being
// worked through, and it stays legible at 16px where finer marks mud up.
const PLATE_TOP = [0x2b, 0x54, 0xc8];
const PLATE_BOTTOM = [0x17, 0x2f, 0x74];
const CHEVRON = [0xf5, 0x9e, 0x0b];

const INSET = 0.045;
const CORNER = 0.23;
const CHEVRON_WIDTH = 0.115;

/** Signed distance to a rounded square centred on the unit square. */
function roundedSquareDistance(x, y) {
  const half = 0.5 - INSET - CORNER;
  const qx = Math.abs(x - 0.5) - half;
  const qy = Math.abs(y - 0.5) - half;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - CORNER;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function chevronDistance(x, y) {
  return Math.min(
    distanceToSegment(x, y, 0.37, 0.28, 0.63, 0.5),
    distanceToSegment(x, y, 0.37, 0.72, 0.63, 0.5)
  );
}

/** Colour at a point, or null where the icon is transparent. */
function sample(x, y) {
  if (roundedSquareDistance(x, y) > 0) return null;
  if (chevronDistance(x, y) <= CHEVRON_WIDTH / 2) return CHEVRON;

  return [
    Math.round(PLATE_TOP[0] + (PLATE_BOTTOM[0] - PLATE_TOP[0]) * y),
    Math.round(PLATE_TOP[1] + (PLATE_BOTTOM[1] - PLATE_TOP[1]) * y),
    Math.round(PLATE_TOP[2] + (PLATE_BOTTOM[2] - PLATE_TOP[2]) * y),
  ];
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const total = SUPERSAMPLE * SUPERSAMPLE;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      // Supersampled, since PNG carries no antialiasing of its own.
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (px + (sx + 0.5) / SUPERSAMPLE) / size;
          const y = (py + (sy + 0.5) / SUPERSAMPLE) / size;
          const colour = sample(x, y);
          if (!colour) continue;
          r += colour[0];
          g += colour[1];
          b += colour[2];
          covered++;
        }
      }

      if (covered === 0) continue;

      const offset = (py * size + px) * 4;
      rgba[offset] = Math.round(r / covered);
      rgba[offset + 1] = Math.round(g / covered);
      rgba[offset + 2] = Math.round(b / covered);
      rgba[offset + 3] = Math.round((covered / total) * 255);
    }
  }

  return rgba;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(file, encodePng(size, render(size)));
  console.log(`wrote ${file}`);
}
