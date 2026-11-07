import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const W = 256;
const H = 256;
const NAVY = [7, 11, 24, 255];
const CREAM = [244, 236, 216, 255];
const PINK = [255, 77, 154, 255];

function create() {
  const data = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i += 1) {
    data.set(NAVY, i * 4);
  }
  return data;
}

function put(data, x, y, color) {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || py < 0 || px >= W || py >= H) return;
  data.set(color, (py * W + px) * 4);
}

function disc(data, cx, cy, r0, r1, color) {
  for (let y = cy - r1 - 1; y <= cy + r1 + 1; y += 1) {
    for (let x = cx - r1 - 1; x <= cx + r1 + 1; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r1 && d >= r0) put(data, x, y, color);
    }
  }
}

function pointInPoly(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.00001) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function fillPoly(data, points, color) {
  let minX = W;
  let minY = H;
  let maxX = 0;
  let maxY = 0;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y += 1) {
    for (let x = Math.floor(minX); x <= Math.ceil(maxX); x += 1) {
      if (pointInPoly(x, y, points)) put(data, x, y, color);
    }
  }
}

function ringPoly(data, points, color, width) {
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!pointInPoly(x, y, points)) continue;
      const shrunk = points.map(([px, py]) => {
        const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
        const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
        return [cx + (px - cx) * (1 - width), cy + (py - cy) * (1 - width)];
      });
      if (!pointInPoly(x, y, shrunk)) put(data, x, y, color);
    }
  }
}

function hex(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

function star(cx, cy, outer, inner) {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

function chevron(data, x, y, size) {
  for (let t = 0; t <= 1; t += 0.012) {
    const x1 = x - t * size;
    const y1 = y + t * size;
    const x2 = x + t * size;
    const y2 = y + t * size;
    for (let n = -3; n <= 3; n += 1) {
      put(data, x1 + n * 0.6, y1, PINK);
      put(data, x1, y1 + n * 0.6, PINK);
      put(data, x2 + n * 0.6, y2, PINK);
      put(data, x2, y2 + n * 0.6, PINK);
    }
  }
}

const FONT = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b01010, 0b00100],
};

function text(data, word, x, y, scale) {
  let cursor = x;
  for (const ch of word) {
    const glyph = FONT[ch];
    if (!glyph) {
      cursor += 6 * scale;
      continue;
    }
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        if (glyph[row] & (1 << (4 - col))) {
          for (let sy = 0; sy < scale; sy += 1) {
            for (let sx = 0; sx < scale; sx += 1) {
              put(data, cursor + col * scale + sx, y + row * scale + sy, CREAM);
            }
          }
        }
      }
    }
    cursor += 6 * scale;
  }
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(pixels) {
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y += 1) {
    raw[y * (W * 4 + 1)] = 0;
    pixels.subarray(y * W * 4, (y + 1) * W * 4).forEach((value, index) => {
      raw[y * (W * 4 + 1) + 1 + index] = value;
    });
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function badge(kind) {
  const data = create();
  for (let i = 0; i < 8; i += 1) {
    for (let x = 8; x < W - 8; x += 1) {
      put(data, x, 8 + i, CREAM);
      put(data, x, H - 16 + i, CREAM);
    }
    for (let y = 8; y < H - 8; y += 1) {
      put(data, 8 + i, y, CREAM);
      put(data, W - 16 + i, y, CREAM);
    }
  }
  if (kind === "novice") disc(data, 100, 108, 48, 62, CREAM);
  if (kind === "pilot") {
    ringPoly(data, hex(100, 108, 64), CREAM, 0.18);
    ringPoly(data, hex(100, 108, 36), CREAM, 0.22);
  }
  if (kind === "ace") fillPoly(data, star(100, 108, 68, 30), CREAM);
  const count = kind === "novice" ? 1 : kind === "pilot" ? 2 : 3;
  const start = count === 1 ? 96 : count === 2 ? 78 : 60;
  for (let i = 0; i < count; i += 1) chevron(data, 188, start + i * 36, 16);
  const label = kind === "novice" ? "NOVICE" : kind === "pilot" ? "PILOT" : "ACE";
  text(data, label, kind === "pilot" ? 78 : kind === "ace" ? 96 : 70, 196, 3);
  return png(data);
}

const dir = path.join(process.cwd(), "public", "badges");
fs.mkdirSync(dir, { recursive: true });
for (const kind of ["novice", "pilot", "ace"]) {
  fs.writeFileSync(path.join(dir, `${kind}.png`), badge(kind));
}
console.log("wrote badge pngs");
