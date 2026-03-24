// packages/core/src/kaspa/signer.ts
// Pluggable transaction signing interface for software and hardware wallets

import { schnorr } from "@noble/curves/secp256k1";

/**
 * Interface for signing Kaspa transaction sighashes.
 * Implementations include software (in-memory private key) and
 * hardware wallets (Ledger device signing).
 */
export interface TransactionSigner {
  /** Sign a 32-byte sighash, returning a 64-byte Schnorr signature */
  sign(sighash: Uint8Array): Promise<Uint8Array>;
  /** The 32-byte x-only public key */
  publicKey: Uint8Array;
}

/**
 * Software signer that uses an in-memory private key.
 * This wraps the existing schnorr.sign() call for mnemonic-based wallets.
 */
export class SoftwareSigner implements TransactionSigner {
  public publicKey: Uint8Array;
  private privateKey: Uint8Array;

  constructor(privateKey: Uint8Array, publicKey: Uint8Array) {
    this.privateKey = privateKey;
    // Ensure x-only (32 bytes)
    this.publicKey = publicKey.length === 33 ? publicKey.slice(1) : publicKey;
  }

  async sign(sighash: Uint8Array): Promise<Uint8Array> {
    return schnorr.sign(sighash, this.privateKey);
  }
}
