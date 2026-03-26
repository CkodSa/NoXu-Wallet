// React Native CryptoProvider implementation
import { setCryptoProvider, type CryptoProvider } from "@noxu/core";
import { Buffer } from "buffer";
import { argon2id as nobleArgon2id } from "@noble/hashes/argon2";

// Try to use native argon2 for performance, fall back to pure-JS
let nativeArgon2: typeof import("react-native-argon2").default | null = null;
try {
  const { NativeModules } = require("react-native");
  if (NativeModules.RNArgon2?.argon2) {
    nativeArgon2 = NativeModules.RNArgon2.argon2;
  }
} catch {
  // Native module not available, will use pure-JS fallback
}

const rnCryptoProvider: CryptoProvider = {
  async aesGcmEncrypt(
    key: Uint8Array,
    iv: Uint8Array,
    data: Uint8Array
  ): Promise<Uint8Array> {
    // react-native-quick-crypto installs crypto.subtle globally
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key.buffer as ArrayBuffer,
      "AES-GCM",
      false,
      ["encrypt"]
    );
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
      cryptoKey,
      data.buffer as ArrayBuffer
    );
    return new Uint8Array(ct);
  },

  async aesGcmDecrypt(
    key: Uint8Array,
    iv: Uint8Array,
    ciphertext: Uint8Array
  ): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key.buffer as ArrayBuffer,
      "AES-GCM",
      false,
      ["decrypt"]
    );
    try {
      const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
        cryptoKey,
        ciphertext.buffer as ArrayBuffer
      );
      return new Uint8Array(pt);
    } catch (err) {
      throw new Error("Decryption failed. The password may be incorrect.");
    }
  },

  async argon2id(
    password: Uint8Array,
    salt: Uint8Array,
    params: { t: number; m: number; p: number; dkLen: number }
  ): Promise<Uint8Array> {
    // Use native C implementation if available (faster), otherwise pure-JS
    if (nativeArgon2) {
      const passwordStr = new TextDecoder().decode(password);
      const saltHex = Buffer.from(salt).toString("hex");
      const result = await nativeArgon2(passwordStr, saltHex, {
        iterations: params.t,
        memory: params.m,
        parallelism: params.p,
        hashLength: params.dkLen,
        mode: "argon2id",
        saltEncoding: "hex",
      });
      return new Uint8Array(Buffer.from(result.rawHash, "hex"));
    }
    // Pure-JS fallback via @noble/hashes
    return nobleArgon2id(password, salt, params);
  },

  toBase64(data: Uint8Array): string {
    return Buffer.from(data).toString("base64");
  },

  fromBase64(b64: string): Uint8Array {
    return new Uint8Array(Buffer.from(b64, "base64"));
  },
};

/** Initialize the React Native crypto provider. Call once at app startup. */
export function initMobileCrypto(): void {
  setCryptoProvider(rnCryptoProvider);
}
