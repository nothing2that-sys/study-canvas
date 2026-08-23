import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..", "public", "app");

// 순수 JS로 유효한 단색/그라데이션 PNG 파일을 생성하는 유틸리티
function createPngBuffer(width, height, bgColor = [23, 63, 53, 255]) {
  const bytesPerPixel = 4;
  const scanlineLength = 1 + width * bytesPerPixel;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * bytesPerPixel;
      // 중앙 원형 마크
      const cx = width / 2;
      const cy = height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      const isInner = dist < width * 0.4;

      if (isInner) {
        rawData[pixelOffset] = 245; // R
        rawData[pixelOffset + 1] = 243; // G
        rawData[pixelOffset + 2] = 238; // B
        rawData[pixelOffset + 3] = 255; // A
      } else {
        rawData[pixelOffset] = bgColor[0];
        rawData[pixelOffset + 1] = bgColor[1];
        rawData[pixelOffset + 2] = bgColor[2];
        rawData[pixelOffset + 3] = bgColor[3];
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG 헤더 및 청크 조립
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR 청크
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = makeChunk("IHDR", ihdrData);
  const idatChunk = makeChunk("IDAT", compressedData);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const chunk = Buffer.alloc(8 + length + 4);
  chunk.writeUInt32BE(length, 0);
  chunk.write(type, 4, 4, "ascii");
  data.copy(chunk, 8);

  const crcTarget = chunk.subarray(4, 8 + length);
  const crcValue = calculateCrc32(crcTarget);
  chunk.writeUInt32BE(crcValue >>> 0, 8 + length);

  return chunk;
}

function calculateCrc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xEDB88320);
    }
  }
  return (crc ^ -1) >>> 0;
}

const icons = [
  { name: "icon-180.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512 }
];

for (const icon of icons) {
  const filePath = path.join(appDir, icon.name);
  const buffer = createPngBuffer(icon.size, icon.size);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated icon: ${filePath} (${icon.size}x${icon.size})`);
}
