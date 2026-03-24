// Web CryptoProvider implementation using browser crypto.subtle + btoa/atob
import { setCryptoProvider, type CryptoProvider } from "@noxu/core";
import { argon2id as nobleArgon2id } from "@noble/hashes/argon2";

const webCryptoProvider: CryptoProvider = {
  async aesGcmEncrypt(key: Uint8Array, iv: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, data);
    return new Uint8Array(ct);
  },

  async aesGcmDecrypt(key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
    try {
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext);
      return new Uint8Array(pt);
    } catch (err) {
      if (err instanceof DOMException && err.name === "OperationError") {
        throw new Error("OperationError: decrypt failed");
      }
      throw err;
    }
  },

  toBase64(data: Uint8Array): string {
    return btoa(String.fromCharCode(...data));
  },

  async argon2id(
    password: Uint8Array,
    salt: Uint8Array,
    params: { t: number; m: number; p: number; dkLen: number }
  ): Promise<Uint8Array> {
    // Pure-JS Argon2id — fine for desktop/extension where the browser runs it efficiently
    return nobleArgon2id(password, salt, params);
  },

  fromBase64(b64: string): Uint8Array {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  },
};

/** Initialize the web crypto provider. Call once at startup. */
export function initWebCrypto(): void {
  setCryptoProvider(webCryptoProvider);
}
