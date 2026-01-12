import { scrypt } from "@noble/hashes/scrypt";
import { argon2id } from "@noble/hashes/argon2";
import { randomBytes } from "@noble/hashes/utils";

// Version 1: scrypt (legacy)
// Version 2: Argon2id (current)
const CURRENT_VERSION = 2;

export type EncryptedPayload = {
  version: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

const toBase64 = (data: Uint8Array) =>
  btoa(String.fromCharCode(...data));
const fromBase64 = (b64: string) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// Legacy scrypt KDF for decrypting v1 payloads
async function deriveKeyScrypt(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const derived = scrypt(
    new TextEncoder().encode(password),
    salt,
    { N: 1 << 15, r: 8, p: 1, dkLen: 32 }
  );
  return crypto.subtle.importKey("raw", derived, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// Argon2id KDF - memory-hard, resistant to GPU/ASIC attacks
// Parameters chosen for browser environment balance of security and performance
async function deriveKeyArgon2id(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const derived = argon2id(
    new TextEncoder().encode(password),
    salt,
    { t: 3, m: 65536, p: 1, dkLen: 32 } // t=3 iterations, m=64MB, p=1 parallelism
  );
  return crypto.subtle.importKey("raw", derived, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(password: string, data: Uint8Array): Promise<EncryptedPayload> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKeyArgon2id(password, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return {
    version: CURRENT_VERSION,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext))
  };
}

export async function decryptSecret(password: string, payload: EncryptedPayload): Promise<Uint8Array> {
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);

  // Select KDF based on version for backward compatibility
  let key: CryptoKey;
  if (payload.version === 1) {
    // Legacy scrypt-based decryption
    key = await deriveKeyScrypt(password, salt);
  } else if (payload.version === 2) {
    // Current Argon2id-based decryption
    key = await deriveKeyArgon2id(password, salt);
  } else {
    throw new Error("Unsupported payload version");
  }

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    fromBase64(payload.ciphertext)
  );
  return new Uint8Array(plain);
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
