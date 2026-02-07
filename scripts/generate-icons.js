/**
 * Generate PWA icon PNGs using Node.js built-in modules only.
 * Creates blue square icons with a white "T" clock shape at 192x192 and 512x512.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

function createIcon(size) {
  // Colors
  const bgR = 37, bgG = 99, bgB = 235;   // #2563eb (blue)
  const fgR = 255, fgG = 255, fgB = 255;  // white

  // Build raw pixel data
  const raw = Buffer.alloc(size * (1 + size * 3));
  const center = size / 2;
  const radius = size * 0.38;
  const innerRadius = radius * 0.85;
  const lineWidth = size * 0.06;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (1 + size * 3);
    raw[rowOffset] = 0; // filter byte: none

    for (let x = 0; x < size; x++) {
      const px = rowOffset + 1 + x * 3;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = bgR, g = bgG, b = bgB;

      // Draw circle outline
      if (dist <= radius && dist >= innerRadius) {
        r = fgR; g = fgG; b = fgB;
      }
      // Draw clock center dot
      else if (dist <= lineWidth * 1.2) {
        r = fgR; g = fgG; b = fgB;
      }
      // Draw hour hand (pointing to 12 o'clock - upward)
      else if (Math.abs(dx) <= lineWidth / 2 && dy < 0 && dy > -radius * 0.55 && dist < innerRadius) {
        r = fgR; g = fgG; b = fgB;
      }
      // Draw minute hand (pointing to 3 o'clock - rightward)
      else if (Math.abs(dy) <= lineWidth / 2 && dx > 0 && dx < radius * 0.7 && dist < innerRadius) {
        r = fgR; g = fgG; b = fgB;
      }

      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }

  // Compress
  const compressed = zlib.deflateSync(raw, { level: 9 });

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Generate icons
const publicDir = path.join(__dirname, '..', 'public');

const sizes = [192, 512];
for (const size of sizes) {
  const png = createIcon(size);
  const filePath = path.join(publicDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created ${filePath} (${png.length} bytes)`);
}

// Also create a favicon (32x32)
const favicon = createIcon(32);
fs.writeFileSync(path.join(publicDir, 'favicon.png'), favicon);
console.log(`Created favicon.png (${favicon.length} bytes)`);

console.log('Done!');
