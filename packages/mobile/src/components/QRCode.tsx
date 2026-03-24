import React, { useMemo } from "react";
import Svg, { Rect } from "react-native-svg";

/**
 * QR Code encoder — Version 4, byte mode, ECC-L.
 * Generates a valid 33x33 QR code. Supports up to 78 bytes of data
 * (enough for kaspa: addresses which are ~72 bytes).
 */

const SIZE = 33; // Version 4: 4*4+17 = 33x33 modules
const DATA_CODEWORDS = 80;
const ECC_CODEWORDS = 20;
const TOTAL_DATA_BITS = DATA_CODEWORDS * 8; // 640

// GF(256) arithmetic for Reed-Solomon
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = val;
    GF_LOG[val] = i;
    val = val << 1;
    if (val >= 256) val ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsEncode(data: number[], eccLen: number): number[] {
  const gen = [1];
  for (let i = 0; i < eccLen; i++) {
    const newGen = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j];
      newGen[j + 1] ^= gfMul(gen[j], GF_EXP[i]);
    }
    gen.length = newGen.length;
    for (let j = 0; j < newGen.length; j++) gen[j] = newGen[j];
  }

  const msg = [...data, ...new Array(eccLen).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

function createMatrix(): number[][] {
  return Array.from({ length: SIZE }, () => new Array(SIZE).fill(-1));
}

function setModule(matrix: number[][], r: number, c: number, val: number) {
  if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) matrix[r][c] = val;
}

function addFinderPattern(matrix: number[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const onBorder = r === 0 || r === 6 || c === 0 || c === 6;
      const val = inOuter ? (onBorder || inInner ? 1 : 0) : 0;
      setModule(matrix, row + r, col + c, val);
    }
  }
}

function addAlignmentPattern(matrix: number[][], row: number, col: number) {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const val =
        Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0) ? 1 : 0;
      setModule(matrix, row + r, col + c, val);
    }
  }
}

function addTimingPatterns(matrix: number[][]) {
  for (let i = 8; i < SIZE - 8; i++) {
    const val = i % 2 === 0 ? 1 : 0;
    if (matrix[6][i] === -1) matrix[6][i] = val;
    if (matrix[i][6] === -1) matrix[i][6] = val;
  }
}

function reserveFormatBits(matrix: number[][]) {
  for (let i = 0; i <= 8; i++) {
    if (matrix[8][i] === -1) matrix[8][i] = 0;
    if (matrix[i][8] === -1) matrix[i][8] = 0;
  }
  for (let i = SIZE - 8; i < SIZE; i++) {
    if (matrix[8][i] === -1) matrix[8][i] = 0;
  }
  for (let i = SIZE - 7; i < SIZE; i++) {
    if (matrix[i][8] === -1) matrix[i][8] = 0;
  }
  // Dark module
  matrix[SIZE - 8][8] = 1;
}

function encodeData(data: string): number[] {
  const bytes = new TextEncoder().encode(data);
  // Version 4-L byte mode: 78 byte capacity
  const capacity = 78;
  if (bytes.length > capacity)
    throw new Error(`Data too long: ${bytes.length} > ${capacity}`);

  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };

  // Mode indicator: byte mode = 0100
  pushBits(0b0100, 4);
  // Character count (Versions 1-9 byte mode: 8 bits)
  pushBits(bytes.length, 8);
  // Data
  for (const b of bytes) pushBits(b, 8);
  // Terminator (up to 4 bits)
  const remaining = TOTAL_DATA_BITS - bits.length;
  pushBits(0, Math.min(4, remaining));
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);
  // Pad codewords
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < TOTAL_DATA_BITS) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert to codewords
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
    codewords.push(byte);
  }

  // Version 4-L: 1 block, 80 data codewords, 20 ECC codewords
  const ecc = rsEncode(codewords, ECC_CODEWORDS);
  return [...codewords, ...ecc];
}

function placeData(matrix: number[][], codewords: number[]) {
  const bits: number[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  }

  let bitIdx = 0;
  let col = SIZE - 1;
  while (col >= 0) {
    if (col === 6) col--; // Skip timing column
    const upward = ((SIZE - 1 - col) >> 1) % 2 === 0;

    for (let row = 0; row < SIZE; row++) {
      const r = upward ? SIZE - 1 - row : row;
      for (let dc = 0; dc <= 1; dc++) {
        const c = col - dc;
        if (c < 0) continue;
        if (matrix[r][c] !== -1) continue;
        matrix[r][c] = bitIdx < bits.length ? bits[bitIdx++] : 0;
      }
    }
    col -= 2;
  }
}

function applyMask(matrix: number[][], reserved: number[][]): number[][] {
  const result = matrix.map((r) => [...r]);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (reserved[r][c] !== -1) continue;
      if ((r + c) % 2 === 0) result[r][c] ^= 1;
    }
  }
  return result;
}

function writeFormatBits(matrix: number[][]) {
  // Format info for ECC-L (01) + mask 0 (000)
  // After BCH and XOR mask: 111011111000100
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];

  for (let i = 0; i < 8; i++) {
    const c = i < 6 ? i : i + 1;
    matrix[8][c] = formatBits[i];
  }
  for (let i = 8; i < 15; i++) {
    matrix[8][SIZE - 15 + i] = formatBits[i];
  }
  for (let i = 0; i < 7; i++) {
    matrix[SIZE - 1 - i][8] = formatBits[i];
  }
  for (let i = 7; i < 15; i++) {
    const r = i < 9 ? 15 - i : 14 - i;
    matrix[r][8] = formatBits[i];
  }
}

function generateQR(data: string): number[][] {
  const matrix = createMatrix();
  const reserved = createMatrix();

  // Finder patterns
  addFinderPattern(matrix, 0, 0);
  addFinderPattern(matrix, 0, SIZE - 7);
  addFinderPattern(matrix, SIZE - 7, 0);

  // Version 4 alignment pattern at (26, 26)
  addAlignmentPattern(matrix, 26, 26);

  addTimingPatterns(matrix);
  reserveFormatBits(matrix);

  // Mark reserved
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (matrix[r][c] !== -1) reserved[r][c] = matrix[r][c];
    }
  }

  // Encode and place data
  const codewords = encodeData(data);
  placeData(matrix, codewords);

  // Apply mask
  const masked = applyMask(matrix, reserved);

  // Restore reserved
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (reserved[r][c] !== -1) masked[r][c] = reserved[r][c];
    }
  }

  writeFormatBits(masked);
  return masked;
}

type QRCodeProps = {
  data: string;
  size: number;
};

export default function QRCode({ data, size }: QRCodeProps) {
  const matrix = useMemo(() => {
    if (!data) return null;
    try {
      return generateQR(data);
    } catch {
      return null;
    }
  }, [data]);

  if (!matrix) return null;

  const cellSize = size / (SIZE + 8); // 4 modules quiet zone each side
  const offset = cellSize * 4; // quiet zone offset
  const totalSize = size;

  const rects: { x: number; y: number }[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (matrix[r][c] === 1) {
        rects.push({ x: offset + c * cellSize, y: offset + r * cellSize });
      }
    }
  }

  return (
    <Svg width={totalSize} height={totalSize}>
      <Rect width={totalSize} height={totalSize} fill="white" rx={4} />
      {rects.map((r, i) => (
        <Rect
          key={i}
          x={r.x}
          y={r.y}
          width={cellSize + 0.5}
          height={cellSize + 0.5}
          fill="#1a1a2e"
          rx={cellSize * 0.1}
        />
      ))}
    </Svg>
  );
}
