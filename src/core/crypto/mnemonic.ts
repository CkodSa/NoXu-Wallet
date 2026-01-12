// src/core/crypto/mnemonic.ts

import {
  generateMnemonic,
  validateMnemonic,
  mnemonicToSeedSync,
} from "@scure/bip39";
import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import { sha256 } from "@noble/hashes/sha256";

export type WalletSeed = {
  mnemonic: string;
  seed: Uint8Array;
};

// Kaspa follows SLIP-44 coin type 972; align derivation with Kaspa CLI wallet (BIP44 path).
export const DERIVATION_PATH = "m/44'/972'/0'/0/0";

export type DerivedAccount = {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  address: string;
  derivationPath: string;
};

// Guards against weird bundler/tree-shake issues and makes failure obvious early.
function assertWordlist(list: unknown): asserts list is string[] {
  if (!Array.isArray(list)) {
    throw new Error("[wallet] Wordlist missing: expected array");
  }
  if (list.length !== 2048) {
    throw new Error(
      `[wallet] Wordlist corrupted: expected 2048 words, got ${list.length}`
    );
  }
  if (typeof list[0] !== "string") {
    throw new Error("[wallet] Wordlist invalid: expected array of strings");
  }
}

function normalizeMnemonic(mnemonic: string): string {
  // Trim + collapse multiple spaces/newlines to single spaces
  return mnemonic.trim().replace(/\s+/g, " ");
}

// Kaspa bech32 charset (same as standard bech32)
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

// Kaspa bech32 polymod for checksum calculation (uses BigInt for 40-bit precision)
function polymod(values: number[]): bigint {
  const GEN = [
    0x98f2bc8e61n,
    0x79b76d99e2n,
    0xf33e5fb3c4n,
    0xae2eabe2a8n,
    0x1e4f43e470n,
  ];
  let chk = 1n;
  for (const v of values) {
    const top = chk >> 35n;
    chk = ((chk & 0x07ffffffffn) << 5n) ^ BigInt(v);
    for (let i = 0n; i < 5n; i++) {
      if ((top >> i) & 1n) {
        chk ^= GEN[Number(i)];
      }
    }
  }
  return chk ^ 1n; // Kaspa XORs with 1 at the end
}

// Convert prefix to uint5 array (Kaspa-specific: only lower 5 bits, no high bits)
function prefixToUint5Array(prefix: string): number[] {
  const ret: number[] = [];
  for (const c of prefix) {
    ret.push(c.charCodeAt(0) & 31);
  }
  return ret;
}

// Create checksum for Kaspa bech32
function createChecksum(prefix: string, data: number[]): number[] {
  // Kaspa format: prefixLower5Bits + [0] + payload + [0,0,0,0,0,0,0,0]
  const prefixBits = prefixToUint5Array(prefix);
  const values = prefixBits
    .concat([0])
    .concat(data)
    .concat([0, 0, 0, 0, 0, 0, 0, 0]);
  const mod = polymod(values);
  const ret: number[] = [];
  for (let i = 0; i < 8; i++) {
    ret.push(Number((mod >> BigInt(5 * (7 - i))) & 31n));
  }
  return ret;
}

// Convert bytes to 5-bit words
function toWords(bytes: Uint8Array): number[] {
  const words: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const byte of bytes) {
    acc = (acc << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      words.push((acc >> bits) & 31);
    }
  }
  if (bits > 0) {
    words.push((acc << (5 - bits)) & 31);
  }
  return words;
}

// Encode Kaspa address with ":" separator instead of "1"
function kaspaBech32Encode(hrp: string, data: Uint8Array): string {
  const words = toWords(data);
  const checksum = createChecksum(hrp, words);
  const combined = words.concat(checksum);
  let result = hrp + ":";
  for (const w of combined) {
    result += CHARSET[w];
  }
  return result;
}

// Kaspa addresses use a custom format: prefix:type+pubkey_bech32
// - prefix: "kaspa" or "kaspatest"
// - separator: ":" (not "1" like standard bech32)
// - type: 0x00 for P2PK (schnorr/x-only pubkey - 32 bytes)
// - type: 0x01 for ECDSA P2PK (compressed pubkey - 33 bytes)
// - Kaspa primarily uses schnorr-style addresses (type 0x00 with 32-byte x-coordinate)
function pubkeyToKaspaAddress(pubkey: Uint8Array, isTestnet: boolean): string {
  const prefix = isTestnet ? "kaspatest" : "kaspa";

  // Extract the 32-byte x-coordinate from the compressed ECDSA pubkey
  // and use schnorr-style address (type 0x00) which is standard for Kaspa
  let payload: Uint8Array;

  if (pubkey.length === 33) {
    // Compressed ECDSA pubkey - extract x-coordinate (remove 02/03 prefix)
    // Use type 0x00 (schnorr P2PK) with 32-byte x-coordinate
    payload = new Uint8Array(1 + 32);
    payload[0] = 0x00; // Schnorr P2PK address type
    payload.set(pubkey.slice(1), 1); // Skip the 02/03 prefix byte
  } else if (pubkey.length === 32) {
    // Already 32 bytes (x-only format)
    payload = new Uint8Array(1 + 32);
    payload[0] = 0x00; // Schnorr P2PK type
    payload.set(pubkey, 1);
  } else {
    throw new Error(`Unexpected pubkey length: ${pubkey.length}`);
  }

  const address = kaspaBech32Encode(prefix, payload);
  return address;
}

export function createMnemonic(strength: 128 | 256 = 128): WalletSeed {
  assertWordlist(englishWordlist);
  const mnemonic = generateMnemonic(englishWordlist, strength);
  const seed = mnemonicToSeedSync(mnemonic);
  return { mnemonic, seed };
}

export function mnemonicToSeed(mnemonic: string): WalletSeed {
  assertWordlist(englishWordlist);

  const cleaned = normalizeMnemonic(mnemonic);
  if (!validateMnemonic(cleaned, englishWordlist)) {
    throw new Error("Invalid mnemonic");
  }
  return { mnemonic: cleaned, seed: mnemonicToSeedSync(cleaned) };
}

export function deriveAccountFromSeed(
  seed: Uint8Array,
  isTestnet = false
): DerivedAccount {
  const hd = HDKey.fromMasterSeed(seed);
  const derived = hd.derive(DERIVATION_PATH);

  if (!derived.privateKey || !derived.publicKey) {
    throw new Error("Failed to derive key");
  }

  const address = pubkeyToKaspaAddress(derived.publicKey, isTestnet);

  return {
    privateKey: derived.privateKey,
    publicKey: derived.publicKey,
    address,
    derivationPath: DERIVATION_PATH,
  };
}
