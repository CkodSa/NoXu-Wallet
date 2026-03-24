import { scrypt } from "@noble/hashes/scrypt";
import { randomBytes } from "@noble/hashes/utils";
import { getCryptoProvider } from "../platform";

// Version 1: scrypt (legacy)
// Version 2: Argon2id (current)
const CURRENT_VERSION = 2;

export type EncryptedPayload = {
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

// Full Argon2id parameters — same security on all platforms.
// On mobile, the platform CryptoProvider runs this natively (C) off the main thread.
// On extension, it runs via pure-JS @noble/hashes.
const ARGON2_PARAMS = {
  t: 3,      // iterations
  m: 65536,  // 64MB memory
  p: 1,      // parallelism
  dkLen: 32, // 256-bit key
};

// Legacy scrypt KDF for decrypting v1 payloads
function deriveKeyRawScrypt(password: string, salt: Uint8Array): Uint8Array {
  return scrypt(
    new TextEncoder().encode(password),
    salt,
    { N: 1 << 15, r: 8, p: 1, dkLen: 32 }
  );
}

// Argon2id KDF — delegates to platform CryptoProvider (native on mobile, pure-JS on extension)
async function deriveKeyArgon2id(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const crypto = getCryptoProvider();
  return crypto.argon2id(
    new TextEncoder().encode(password),
    salt,
    ARGON2_PARAMS
  );
}

export async function encryptSecret(password: string, data: Uint8Array): Promise<EncryptedPayload> {
  const crypto = getCryptoProvider();
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const keyRaw = await deriveKeyArgon2id(password, salt);
  const ciphertext = await crypto.aesGcmEncrypt(keyRaw, iv, data);
  return {
    version: CURRENT_VERSION,
    salt: crypto.toBase64(salt),
    iv: crypto.toBase64(iv),
    ciphertext: crypto.toBase64(ciphertext),
  };
}

export async function decryptSecret(password: string, payload: EncryptedPayload): Promise<Uint8Array> {
  const crypto = getCryptoProvider();
  const salt = crypto.fromBase64(payload.salt);
  const iv = crypto.fromBase64(payload.iv);

  // Select KDF based on version for backward compatibility
  let keyRaw: Uint8Array;
  if (payload.version === 1) {
    // Legacy scrypt-based decryption
    keyRaw = deriveKeyRawScrypt(password, salt);
  } else if (payload.version === 2) {
    // Current Argon2id-based decryption
    keyRaw = await deriveKeyArgon2id(password, salt);
  } else {
    throw new Error("Unsupported payload version");
  }

  try {
    return await crypto.aesGcmDecrypt(keyRaw, iv, crypto.fromBase64(payload.ciphertext));
  } catch (err) {
    // AES-GCM throws when password is wrong (auth tag mismatch)
    if (err instanceof Error && (err.message.includes("OperationError") || err.message.includes("decrypt"))) {
      throw new Error("Incorrect password");
    }
    throw err;
  }
}

// Check if a payload needs migration to the newer encryption version
export function needsMigration(payload: EncryptedPayload): boolean {
  return payload.version < CURRENT_VERSION;
}

// Re-encrypt data with the current encryption version
export async function migrateEncryption(
  password: string,
  payload: EncryptedPayload
): Promise<EncryptedPayload> {
  const decrypted = await decryptSecret(password, payload);
  const migrated = await encryptSecret(password, decrypted);
  // Clear decrypted data from memory
  decrypted.fill(0);
  return migrated;
}
