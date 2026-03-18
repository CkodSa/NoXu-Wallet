// src/core/kaspa/krc20-transaction.ts
// KRC-20 inscription transaction building (commit/reveal pattern)

import { blake2b } from "@noble/hashes/blake2b";
import { schnorr } from "@noble/curves/secp256k1";
import type { KaspaUTXO } from "./client";
import {
  type Transaction,
  type TransactionInput,
  type TransactionOutput,
  type ScriptPublicKey,
  type TransactionBuilderOptions,
  SUBNETWORK_ID_NATIVE,
  calculateSighash,
  calculateTransactionId,
  serializeForBroadcast,
  selectUtxos,
  calculateFee,
  addressToScriptPublicKey,
  createSignatureScript,
  SIGHASH_ALL,
} from "./transaction";

// ============================================================================
// Helpers
// ============================================================================

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ============================================================================
// Script OP Codes
// ============================================================================

const OP_FALSE = 0x00;
const OP_DATA_32 = 0x20;
const OP_DATA_64 = 0x40;
const OP_IF = 0x63;
const OP_ENDIF = 0x68;
const OP_EQUAL = 0x87;
const OP_HASH256 = 0xaa;
const OP_CHECKSIG = 0xac;

// Push data opcodes
function opPushData(data: Uint8Array): Uint8Array {
  const len = data.length;
  if (len <= 75) {
    // OP_DATA_1 to OP_DATA_75
    return concat(new Uint8Array([len]), data);
  } else if (len <= 255) {
    // OP_PUSHDATA1
    return concat(new Uint8Array([0x4c, len]), data);
  } else if (len <= 65535) {
    // OP_PUSHDATA2
    return concat(new Uint8Array([0x4d, len & 0xff, (len >> 8) & 0xff]), data);
  } else {
    // OP_PUSHDATA4
    return concat(
      new Uint8Array([0x4e, len & 0xff, (len >> 8) & 0xff, (len >> 16) & 0xff, (len >> 24) & 0xff]),
      data
    );
  }
}

// ============================================================================
// Blake2b Hashing
// ============================================================================

function hashWithPersonalization(data: Uint8Array, personalization: string): Uint8Array {
  const persBytes = new Uint8Array(16);
  const persEncoded = new TextEncoder().encode(personalization);
  persBytes.set(persEncoded.slice(0, 16));
  return blake2b(data, { dkLen: 32, personalization: persBytes });
}

// Script hashing for P2SH
function hashScript(script: Uint8Array): Uint8Array {
  return hashWithPersonalization(script, "TransactionScriptHash");
}

// ============================================================================
// KRC-20 Inscription Types
// ============================================================================

export interface KRC20Inscription {
  p: "krc-20";
  op: "deploy" | "mint" | "transfer";
  tick: string;
  [key: string]: string | number | undefined;
}

export interface KRC20TransferInscription extends KRC20Inscription {
  op: "transfer";
  amt: string;
  to: string;
}

export interface KRC20MintInscription extends KRC20Inscription {
  op: "mint";
}

export interface KRC20DeployInscription extends KRC20Inscription {
  op: "deploy";
  max: string;
  lim: string;
  dec?: string;
  pre?: string;
}

// ============================================================================
// Inscription Script Building
// ============================================================================

/**
 * Create a KRC-20 transfer inscription object
 */
export function createKRC20TransferInscription(
  tick: string,
  amount: bigint,
  toAddress: string
): KRC20TransferInscription {
  return {
    p: "krc-20",
    op: "transfer",
    tick: tick.toUpperCase(),
    amt: amount.toString(),
    to: toAddress,
  };
}

/**
 * Serialize inscription to JSON bytes
 */
export function serializeInscription(inscription: KRC20Inscription): Uint8Array {
  const json = JSON.stringify(inscription);
  return new TextEncoder().encode(json);
}

/**
 * Create the redeem script for KRC-20 inscription
 *
 * The script format is:
 * <pubkey> OP_CHECKSIG
 * OP_FALSE OP_IF
 *   "kasplex"
 *   <inscription_data>
 * OP_ENDIF
 *
 * This allows the inscription data to be embedded in the script
 * without affecting the spending conditions.
 */
export function createInscriptionRedeemScript(
  pubkey: Uint8Array,
  inscriptionData: Uint8Array
): Uint8Array {
  // Get x-only pubkey (32 bytes)
  const xOnlyPubkey = pubkey.length === 33 ? pubkey.slice(1) : pubkey;

  // Protocol marker
  const kasplexMarker = new TextEncoder().encode("kasplex");

  // Build the redeem script:
  // <pubkey> OP_CHECKSIG OP_FALSE OP_IF <"kasplex"> <inscription> OP_ENDIF
  return concat(
    // Spending condition: <pubkey> OP_CHECKSIG
    new Uint8Array([OP_DATA_32]),
    xOnlyPubkey,
    new Uint8Array([OP_CHECKSIG]),
    // Inscription envelope (unexecuted due to OP_FALSE OP_IF)
    new Uint8Array([OP_FALSE, OP_IF]),
    opPushData(kasplexMarker),
    opPushData(inscriptionData),
    new Uint8Array([OP_ENDIF])
  );
}

/**
 * Create a P2SH script from a redeem script hash
 * Format: OP_HASH256 <32-byte hash> OP_EQUAL
 */
export function createP2SHScript(redeemScriptHash: Uint8Array): ScriptPublicKey {
  const script = concat(
    new Uint8Array([OP_HASH256]),
    new Uint8Array([OP_DATA_32]),
    redeemScriptHash,
    new Uint8Array([OP_EQUAL])
  );

  return {
    version: 0,
    script: bytesToHex(script),
  };
}

/**
 * Create the signature script for spending a P2SH output with inscription
 * Format: <signature> <redeem_script>
 */
export function createP2SHSignatureScript(
  signature: Uint8Array,
  redeemScript: Uint8Array
): string {
  // Signature: OP_DATA_64 <64-byte signature>
  const sigPart = concat(
    new Uint8Array([OP_DATA_64]),
    signature
  );

  // Redeem script as data
  const redeemPart = opPushData(redeemScript);

  return bytesToHex(concat(sigPart, redeemPart));
}

// ============================================================================
// KRC-20 Transaction Building
// ============================================================================

export type KRC20TransferOptions = TransactionBuilderOptions & {
  /** Amount for the commit output (P2SH) - default: 30000 sompi */
  commitOutputAmount?: bigint;
};

const DEFAULT_COMMIT_OUTPUT_AMOUNT = 30000n; // 0.0003 KAS - covers reveal tx fee

/**
 * Result of building KRC-20 commit transaction
 */
export type CommitTransactionResult = {
  tx: Transaction;
  txId: string;
  broadcastData: object;
  redeemScript: Uint8Array;
  redeemScriptHash: Uint8Array;
  p2shOutputIndex: number;
  commitOutputAmount: bigint;
};

/**
 * Build the commit transaction for KRC-20 transfer
 *
 * The commit transaction creates a P2SH output containing the inscription.
 * It has:
 * - Input(s): Regular P2PK UTXOs from the sender
 * - Output 0: P2SH output containing the inscription (to be spent by reveal)
 * - Output 1: Change back to sender (if any)
 */
export function buildKRC20CommitTransaction(
  utxos: KaspaUTXO[],
  publicKey: Uint8Array,
  inscription: KRC20TransferInscription,
  changeAddress: string,
  options: KRC20TransferOptions = {}
): {
  tx: Transaction;
  selectedUtxos: KaspaUTXO[];
  redeemScript: Uint8Array;
  redeemScriptHash: Uint8Array;
  p2shOutputIndex: number;
  commitOutputAmount: bigint;
} {
  const commitOutputAmount = options.commitOutputAmount ?? DEFAULT_COMMIT_OUTPUT_AMOUNT;

  // Create the inscription data
  const inscriptionData = serializeInscription(inscription);

  // Create the redeem script
  const redeemScript = createInscriptionRedeemScript(publicKey, inscriptionData);

  // Hash the redeem script for P2SH
  const redeemScriptHash = hashScript(redeemScript);

  // Create the P2SH output script
  const p2shScript = createP2SHScript(redeemScriptHash);

  // Select UTXOs for the commit transaction
  // We need: commitOutputAmount + fee for commit tx + some extra for reveal tx fee
  const { selected, total, fee } = selectUtxos(utxos, commitOutputAmount, options);
  const change = total - commitOutputAmount - fee;

  // Build outputs
  const outputs: TransactionOutput[] = [
    {
      value: commitOutputAmount,
      scriptPublicKey: p2shScript,
    },
  ];

  // Add change output if non-zero
  if (change > 0n) {
    outputs.push({
      value: change,
      scriptPublicKey: addressToScriptPublicKey(changeAddress),
    });
  }

  // Build inputs
  const inputs: TransactionInput[] = selected.map((utxo) => ({
    previousOutpoint: {
      transactionId: utxo.transactionId,
      index: utxo.index,
    },
    signatureScript: "",
    sequence: 0xffffffffffffffffn,
    sigOpCount: 1,
  }));

  const tx: Transaction = {
    version: 0,
    inputs,
    outputs,
    lockTime: 0n,
    subnetworkId: SUBNETWORK_ID_NATIVE,
    gas: 0n,
    payload: "",
  };

  return {
    tx,
    selectedUtxos: selected,
    redeemScript,
    redeemScriptHash,
    p2shOutputIndex: 0,
    commitOutputAmount,
  };
}

/**
 * Sign the commit transaction
 */
export function signCommitTransaction(
  tx: Transaction,
  privateKey: Uint8Array,
  utxos: KaspaUTXO[]
): Transaction {
  const utxoInfos = utxos.map((utxo) => ({
    value: utxo.amountSompi,
    scriptPublicKey: {
      version: 0,
      script: utxo.scriptPublicKey,
    },
  }));

  const signedInputs = tx.inputs.map((input, i) => {
    const sighash = calculateSighash(tx, i, utxoInfos[i], SIGHASH_ALL);
    const signature = schnorr.sign(sighash, privateKey);
    return {
      ...input,
      signatureScript: createSignatureScript(signature),
    };
  });

  return { ...tx, inputs: signedInputs };
}

/**
 * Result of building KRC-20 reveal transaction
 */
export type RevealTransactionResult = {
  tx: Transaction;
  txId: string;
  broadcastData: object;
};

/**
 * Build the reveal transaction for KRC-20 transfer
 *
 * The reveal transaction spends the P2SH output from the commit transaction.
 * It has:
 * - Input: The P2SH output from commit transaction
 * - Output: Small amount to recipient (or back to sender)
 */
export function buildKRC20RevealTransaction(
  commitTxId: string,
  p2shOutputIndex: number,
  commitOutputAmount: bigint,
  redeemScript: Uint8Array,
  recipientAddress: string,
  options: KRC20TransferOptions = {}
): {
  tx: Transaction;
  p2shUtxo: { value: bigint; scriptPublicKey: ScriptPublicKey };
} {
  // The reveal tx fee
  const fee = calculateFee(1, 1, options);
  const outputAmount = commitOutputAmount - fee;

  if (outputAmount <= 0n) {
    throw new Error("Commit output amount too small to cover reveal transaction fee");
  }

  // Create P2SH scriptPublicKey for the input (needed for sighash)
  const redeemScriptHash = hashScript(redeemScript);
  const p2shScriptPubKey = createP2SHScript(redeemScriptHash);

  // Build the reveal transaction
  const tx: Transaction = {
    version: 0,
    inputs: [
      {
        previousOutpoint: {
          transactionId: commitTxId,
          index: p2shOutputIndex,
        },
        signatureScript: "", // Will be filled during signing
        sequence: 0xffffffffffffffffn,
        sigOpCount: 1,
      },
    ],
    outputs: [
      {
        value: outputAmount,
        scriptPublicKey: addressToScriptPublicKey(recipientAddress),
      },
    ],
    lockTime: 0n,
    subnetworkId: SUBNETWORK_ID_NATIVE,
    gas: 0n,
    payload: "",
  };

  return {
    tx,
    p2shUtxo: {
      value: commitOutputAmount,
      scriptPublicKey: p2shScriptPubKey,
    },
  };
}

/**
 * Sign the reveal transaction
 *
 * The reveal transaction spends a P2SH output, so the signature script
 * must include both the signature and the redeem script.
 */
export function signRevealTransaction(
  tx: Transaction,
  privateKey: Uint8Array,
  redeemScript: Uint8Array,
  p2shUtxo: { value: bigint; scriptPublicKey: ScriptPublicKey }
): Transaction {
  // For P2SH, we need to sign with the redeem script's script pubkey
  // Extract the pubkey from the redeem script and create the corresponding scriptPubKey
  // The redeem script starts with: OP_DATA_32 <32-byte-pubkey> OP_CHECKSIG
  const xOnlyPubkey = redeemScript.slice(1, 33);

  // Create the script pubkey for signing (P2PK format)
  const signingScriptPubKey: ScriptPublicKey = {
    version: 0,
    script: bytesToHex(concat(
      new Uint8Array([OP_DATA_32]),
      xOnlyPubkey,
      new Uint8Array([OP_CHECKSIG])
    )),
  };

  // Calculate sighash using the redeem script's spending conditions
  const sighash = calculateSighash(
    tx,
    0,
    { value: p2shUtxo.value, scriptPublicKey: signingScriptPubKey },
    SIGHASH_ALL
  );

  // Sign
  const signature = schnorr.sign(sighash, privateKey);

  // Create the P2SH signature script (signature + redeem script)
  const signatureScript = createP2SHSignatureScript(signature, redeemScript);

  return {
    ...tx,
    inputs: [
      {
        ...tx.inputs[0],
        signatureScript,
      },
    ],
  };
}

// ============================================================================
// High-Level KRC-20 Transfer API
// ============================================================================

export type KRC20TransferResult = {
  commitTx: Transaction;
  commitTxId: string;
  commitBroadcastData: object;
  revealTx: Transaction;
  revealTxId: string;
  revealBroadcastData: object;
  inscription: KRC20TransferInscription;
};

/**
 * Build and sign both commit and reveal transactions for a KRC-20 transfer
 *
 * @param utxos - Available UTXOs for the sender
 * @param privateKey - Sender's private key
 * @param publicKey - Sender's public key
 * @param tick - Token ticker (e.g., "KASPER")
 * @param amount - Amount to transfer in base units
 * @param toAddress - Recipient address
 * @param changeAddress - Address for change from commit tx
 * @param options - Transaction options
 * @returns Both signed transactions ready for broadcast
 */
export function createKRC20Transfer(
  utxos: KaspaUTXO[],
  privateKey: Uint8Array,
  publicKey: Uint8Array,
  tick: string,
  amount: bigint,
  toAddress: string,
  changeAddress: string,
  options: KRC20TransferOptions = {}
): KRC20TransferResult {
  // Create the inscription
  const inscription = createKRC20TransferInscription(tick, amount, toAddress);

  // Build commit transaction
  const {
    tx: unsignedCommitTx,
    selectedUtxos,
    redeemScript,
    p2shOutputIndex,
    commitOutputAmount,
  } = buildKRC20CommitTransaction(utxos, publicKey, inscription, changeAddress, options);

  // Sign commit transaction
  const commitTx = signCommitTransaction(unsignedCommitTx, privateKey, selectedUtxos);
  const commitTxId = calculateTransactionId(commitTx);
  const commitBroadcastData = serializeForBroadcast(commitTx);

  // Build reveal transaction (using commit tx id)
  const { tx: unsignedRevealTx, p2shUtxo } = buildKRC20RevealTransaction(
    commitTxId,
    p2shOutputIndex,
    commitOutputAmount,
    redeemScript,
    toAddress, // Send reveal output to recipient
    options
  );

  // Sign reveal transaction
  const revealTx = signRevealTransaction(unsignedRevealTx, privateKey, redeemScript, p2shUtxo);
  const revealTxId = calculateTransactionId(revealTx);
  const revealBroadcastData = serializeForBroadcast(revealTx);

  return {
    commitTx,
    commitTxId,
    commitBroadcastData,
    revealTx,
    revealTxId,
    revealBroadcastData,
    inscription,
  };
}

/**
 * Estimate the total KAS cost for a KRC-20 transfer
 *
 * @param numInputs - Expected number of inputs for commit tx
 * @param options - Transaction options
 * @returns Total cost in sompi (commit fee + reveal fee + commit output)
 */
export function estimateKRC20TransferCost(
  numInputs: number = 1,
  options: KRC20TransferOptions = {}
): bigint {
  const commitOutputAmount = options.commitOutputAmount ?? DEFAULT_COMMIT_OUTPUT_AMOUNT;

  // Commit tx: numInputs -> 2 outputs (P2SH + change)
  const commitFee = calculateFee(numInputs, 2, options);

  // Reveal tx: 1 input (P2SH) -> 1 output
  const revealFee = calculateFee(1, 1, options);

  // Total: commit fee + commit output (which pays for reveal fee + recipient output)
  return commitFee + commitOutputAmount;
}
