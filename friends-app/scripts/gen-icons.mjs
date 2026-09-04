/**
 * PWA 아이콘 생성기 — 의존성 없이 Node 내장 zlib만으로 PNG를 만든다.
 * 모티브: 모니카네 보라색 문 + 노란 액자 + 엿보기 구멍(peephole).
 *
 * 사용: node scripts/gen-icons.mjs  →  public/icons/icon-{192,512}.png
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');
mkdirSync(outDir, { recursive: true });

// ── 미니 PNG 인코더 ─────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // 스캔라인마다 filter byte(0) 프리픽스
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── 픽셀 드로잉 ─────────────────────────────────────────────────────
function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function makeCanvas(size) {
  const buf = Buffer.alloc(size * size * 4);
  return {
    buf,
    set(x, y, [r, g, b]) {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const i = (y * size + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    },
  };
}

function fillRoundedRect(cv, x0, y0, w, h, radius, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      // 모서리 반경 밖이면 스킵
      const cx = x < x0 + radius ? x0 + radius : x > x0 + w - 1 - radius ? x0 + w - 1 - radius : x;
      const cy = y < y0 + radius ? y0 + radius : y > y0 + h - 1 - radius ? y0 + h - 1 - radius : y;
      if ((x - cx) ** 2 + (y - cy) ** 2 > radius ** 2) continue;
      cv.set(x, y, color);
    }
  }
}

function fillCircle(cv, cx, cy, r, color) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r ** 2) cv.set(x, y, color);
    }
  }
}

/** 액자: 바깥 사각형을 채우고 안쪽을 배경색으로 되칠해 테두리만 남긴다. */
function frame(cv, x0, y0, w, h, thickness, frameColor, innerColor) {
  fillRoundedRect(cv, x0, y0, w, h, Math.round(thickness * 1.2), frameColor);
  fillRoundedRect(
    cv,
    x0 + thickness,
    y0 + thickness,
    w - thickness * 2,
    h - thickness * 2,
    Math.round(thickness * 0.8),
    innerColor,
  );
}

const PURPLE = hex('#6b3fa0');
const PURPLE_DK = hex('#55317f');
const YELLOW = hex('#f0b429');
const CREAM = hex('#faf7f1');

function drawIcon(size) {
  const cv = makeCanvas(size);
  const u = size / 100; // 100 기준 좌표계

  // 배경: 보라 문 (전체, maskable 대응 여백 포함 그라데이션 흉내로 두 톤)
  fillRoundedRect(cv, 0, 0, size, size, Math.round(18 * u), PURPLE);
  fillRoundedRect(cv, 0, Math.round(55 * u), size, Math.round(45 * u), Math.round(18 * u), PURPLE_DK);
  // 하단 모서리만 어둡게 되며 중간 경계가 생기므로 위쪽을 다시 덮는다
  fillRoundedRect(cv, 0, 0, size, Math.round(62 * u), Math.round(18 * u), PURPLE);

  // 노란 액자 (중앙 상단)
  frame(
    cv,
    Math.round(31 * u),
    Math.round(22 * u),
    Math.round(38 * u),
    Math.round(46 * u),
    Math.round(6 * u),
    YELLOW,
    PURPLE,
  );

  // 액자 속 엿보기 구멍
  fillCircle(cv, Math.round(50 * u), Math.round(45 * u), Math.round(7 * u), CREAM);

  // 문손잡이 (오른쪽 하단)
  fillCircle(cv, Math.round(78 * u), Math.round(74 * u), Math.round(4.5 * u), YELLOW);

  return encodePng(size, cv.buf);
}

for (const size of [192, 512]) {
  const png = drawIcon(size);
  const file = path.join(outDir, `icon-${size}.png`);
  writeFileSync(file, png);
  console.log(`✓ ${file} (${png.length.toLocaleString()} bytes)`);
}
