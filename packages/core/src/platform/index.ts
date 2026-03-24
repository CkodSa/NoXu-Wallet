// Platform abstraction layer
// Each platform (extension, mobile) provides its own implementation

export interface CryptoProvider {
  /** AES-GCM encrypt */
  aesGcmEncrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array>;
  /** AES-GCM decrypt */
  aesGcmDecrypt(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array>;
  /** Argon2id key derivation — runs natively on mobile, pure-JS on extension */
  argon2id(password: Uint8Array, salt: Uint8Array, params: { t: number; m: number; p: number; dkLen: number }): Promise<Uint8Array>;
  /** Encode bytes to base64 string */
  toBase64(data: Uint8Array): string;
  /** Decode base64 string to bytes */
  fromBase64(b64: string): Uint8Array;
}

export interface StorageProvider {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

// Global singleton for platform crypto
let _crypto: CryptoProvider | null = null;

export function setCryptoProvider(provider: CryptoProvider): void {
  _crypto = provider;
}

export function getCryptoProvider(): CryptoProvider {
  if (!_crypto) {
    throw new Error(
      "CryptoProvider not initialized. Call setCryptoProvider() before using encryption."
    );
  }
  return _crypto;
}
