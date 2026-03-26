// LedgerSigner — implements TransactionSigner by delegating to Ledger device
//
// The hw-app-kaspa library works differently from our per-sighash signer interface:
// it takes a full transaction and signs ALL inputs on-device. So we provide both:
// 1. A per-sighash `sign()` for the TransactionSigner interface (used for simple KAS sends)
// 2. A `signFullTransaction()` for efficient batch signing via the device

import type Transport from "@ledgerhq/hw-transport";
import Kaspa from "hw-app-kaspa";
import {
  Transaction as LedgerTransaction,
  TransactionInput as LedgerInput,
  TransactionOutput as LedgerOutput,
} from "hw-app-kaspa/src/transaction";
import type { TransactionSigner } from "@noxu/core";
import type {
  Transaction,
  ScriptPublicKey,
} from "@noxu/core";
import { hexToBytes } from "@noxu/core";

/**
 * LedgerSigner implements TransactionSigner for use with the Ledger device.
 *
 * Note: The `sign(sighash)` method is NOT directly supported by the Ledger —
 * the device computes sighashes internally. For KAS transactions, use
 * `signFullTransaction()` which sends the full tx to the device.
 *
 * The `sign()` method throws an error — callers should use the full-transaction
 * signing flow via the popup UI instead.
 */
export class LedgerSigner implements TransactionSigner {
  public publicKey: Uint8Array;
  private transport: Transport;
  private derivationPath: string;

  constructor(transport: Transport, derivationPath: string, publicKey: Uint8Array) {
    this.transport = transport;
    this.derivationPath = derivationPath;
    this.publicKey = publicKey.length === 33 ? publicKey.slice(1) : publicKey;
  }

  /**
   * Per-sighash signing is not supported by Ledger.
   * Use signFullTransaction() instead.
   */
  async sign(_sighash: Uint8Array): Promise<Uint8Array> {
    throw new Error(
      "Ledger does not support per-sighash signing. Use signFullTransaction() instead."
    );
  }

  /**
   * Sign a complete transaction on the Ledger device.
   * The device computes sighashes internally and returns signatures.
   *
   * @returns The transaction with signatureScript fields populated.
   */
  async signFullTransaction(
    tx: Transaction,
    utxos: Array<{ value: bigint; scriptPublicKey: ScriptPublicKey }>
  ): Promise<Transaction> {
    const kaspa = new Kaspa(this.transport);

    // Convert our Transaction to hw-app-kaspa's Transaction format
    const ledgerInputs = tx.inputs.map((input, i) => {
      return new LedgerInput({
        value: Number(utxos[i].value),
        prevTxId: input.previousOutpoint.transactionId,
        outpointIndex: input.previousOutpoint.index,
        addressType: 0, // Schnorr
        addressIndex: 0, // Default address index
      });
    });

    const ledgerOutputs = tx.outputs.map((output) => {
      return new LedgerOutput({
        value: Number(output.value),
        scriptPublicKey: output.scriptPublicKey.script,
      });
    });

    const ledgerTx = new LedgerTransaction({
      version: tx.version,
      inputs: ledgerInputs,
      outputs: ledgerOutputs,
      changeAddressType: 0,
      changeAddressIndex: 0,
    });

    // Sign on device — this mutates ledgerTx.inputs with signatures
    await kaspa.signTransaction(ledgerTx);

    // Extract signatures and build signatureScript for each input
    const signedInputs = tx.inputs.map((input, i) => {
      const sig = ledgerInputs[i].signature;
      if (!sig) {
        throw new Error(`Ledger did not return signature for input ${i}`);
      }
      // signatureScript format: OP_DATA_64 <64-byte signature>
      return {
        ...input,
        signatureScript: "40" + sig,
      };
    });

    return { ...tx, inputs: signedInputs };
  }

  /**
   * Get the Kaspa app version from the Ledger device.
   */
  async getVersion(): Promise<string> {
    const kaspa = new Kaspa(this.transport);
    const { version } = await kaspa.getVersion();
    return version;
  }
}

/**
 * Get the public key from a Ledger device for a given derivation path.
 */
export async function getLedgerPublicKey(
  transport: Transport,
  derivationPath: string,
  display = false
): Promise<Uint8Array> {
  const kaspa = new Kaspa(transport);
  const pubKeyBuffer = await kaspa.getPublicKey(derivationPath, display);
  return new Uint8Array(pubKeyBuffer);
}
