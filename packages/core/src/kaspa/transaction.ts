// src/core/kaspa/transaction.ts
// Kaspa transaction building and Schnorr signing implementation

// Minimum output value — outputs below this are considered dust and may be
// rejected by the network or create unspendable UTXOs.
export const DUST_LIMIT = 546n; // sompi

import { blake2b } from "@noble/hashes/blake2b";
import { schnorr, secp256k1 } from "@noble/curves/secp256k1";
import type { KaspaUTXO } from "./client";
import { hexToBytes, bytesToHex, concat } from "../utils";
import type { TransactionSigner } from "./signer";

// ============================================================================
// Types
// ============================================================================

export type TransactionOutpoint = {
  transactionId: string; // 64-char hex (32 bytes)
  index: number;
};

export type TransactionInput = {
  previousOutpoint: TransactionOutpoint;
  signatureScript: string; // Hex-encoded signature script
  sequence: bigint;
  sigOpCount: number;
};

export type ScriptPublicKey = {
  version: number;
  script: string; // Hex-encoded script
};

export type TransactionOutput = {
  value: bigint;
  scriptPublicKey: ScriptPublicKey;
};

export type Transaction = {
  version: number;
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  lockTime: bigint;
  subnetworkId: string; // 40-char hex (20 bytes) - usually all zeros for native
  gas: bigint;
  payload: string; // Hex-encoded payload (empty for standard tx)
};

export type SignedTransaction = Transaction & {
  id: string; // Transaction ID (hash)
};

// Sighash type constants
export const SIGHASH_ALL = 0x01;

// Default subnetwork ID for native Kaspa transactions (20 zero bytes)
export const SUBNETWORK_ID_NATIVE = "0000000000000000000000000000000000000000";

// ============================================================================
// Serialization Helpers
// ============================================================================


// Reverse bytes (for little-endian txid conversion)
function reverseBytes(bytes: Uint8Array): Uint8Array {
  const reversed = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    reversed[i] = bytes[bytes.length - 1 - i];
  }
  return reversed;
}

// Write uint16 little-endian
function writeUint16LE(value: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = value & 0xff;
  buf[1] = (value >> 8) & 0xff;
  return buf;
}

// Write uint32 little-endian
function writeUint32LE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = value & 0xff;
  buf[1] = (value >> 8) & 0xff;
  buf[2] = (value >> 16) & 0xff;
  buf[3] = (value >> 24) & 0xff;
  return buf;
}

// Write uint64 little-endian (from bigint)
function writeUint64LE(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    buf[i] = Number((value >> BigInt(i * 8)) & 0xffn);
  }
  return buf;
}

// Write variable-length integer (CompactSize)
function writeVarInt(value: number | bigint): Uint8Array {
  const n = typeof value === "bigint" ? Number(value) : value;
  if (n < 0xfd) {
    return new Uint8Array([n]);
  } else if (n <= 0xffff) {
    const buf = new Uint8Array(3);
    buf[0] = 0xfd;
    buf[1] = n & 0xff;
    buf[2] = (n >> 8) & 0xff;
    return buf;
  } else if (n <= 0xffffffff) {
    const buf = new Uint8Array(5);
    buf[0] = 0xfe;
    buf[1] = n & 0xff;
    buf[2] = (n >> 8) & 0xff;
    buf[3] = (n >> 16) & 0xff;
    buf[4] = (n >> 24) & 0xff;
    return buf;
  } else {
    const buf = new Uint8Array(9);
    buf[0] = 0xff;
    const big = BigInt(n);
    for (let i = 0; i < 8; i++) {
      buf[1 + i] = Number((big >> BigInt(i * 8)) & 0xffn);
    }
    return buf;
  }
}


// ============================================================================
// Blake2b Hashing (Kaspa uses Blake2b with specific personalization)
// ============================================================================

// Kaspa uses Blake2b-256 with domain separation via personalization string
function hashWithPersonalization(data: Uint8Array, personalization: string): Uint8Array {
  // Pad personalization to 16 bytes
  const persBytes = new Uint8Array(16);
  const persEncoded = new TextEncoder().encode(personalization);
  persBytes.set(persEncoded.slice(0, 16));

  return blake2b(data, { dkLen: 32, personalization: persBytes });
}

// Hash for transaction ID
export function hashTransactionId(data: Uint8Array): Uint8Array {
  return hashWithPersonalization(data, "TransactionId");
}

// Hash for signature (sighash)
export function hashTransactionSigningHash(data: Uint8Array): Uint8Array {
  return hashWithPersonalization(data, "TransactionSigningHash");
}

// Hash for previous outputs
function hashPreviousOutputs(data: Uint8Array): Uint8Array {
  return hashWithPersonalization(data, "TransactionPreviousOutputs");
}

// Hash for sequences
function hashSequences(data: Uint8Array): Uint8Array {
  return hashWithPersonalization(data, "TransactionSequences");
}

// Hash for sig op counts
function hashSigOpCounts(data: Uint8Array): Uint8Array {
  return hashWithPersonalization(data, "TransactionSigOpCounts");
}

// Hash for outputs
function hashOutputs(data: Uint8Array): Uint8Array {
  return hashWithPersonalization(data, "TransactionOutputs");
}

// ============================================================================
// Script Operations
// ============================================================================

// OP codes for Kaspa scripts
const OP_DATA_32 = 0x20; // Push 32 bytes
const OP_DATA_33 = 0x21; // Push 33 bytes
const OP_DATA_64 = 0x40; // Push 64 bytes
const OP_CHECKSIG = 0xac;
const OP_CHECKSIGECDSA = 0xab;

/**
 * Create a P2PK (Pay-to-Public-Key) script for Schnorr
 * Format: <OP_DATA_32> <32-byte x-only pubkey> <OP_CHECKSIG>
 */
export function createP2PKScript(pubkey: Uint8Array): ScriptPublicKey {
  // Get x-only pubkey (32 bytes)
  let xOnlyPubkey: Uint8Array;
  if (pubkey.length === 33) {
    // Compressed pubkey - extract x-coordinate
    xOnlyPubkey = pubkey.slice(1);
  } else if (pubkey.length === 32) {
    xOnlyPubkey = pubkey;
  } else {
    throw new Error(`Invalid pubkey length: ${pubkey.length}`);
  }

  // Script: OP_DATA_32 <pubkey> OP_CHECKSIG
  const script = new Uint8Array(1 + 32 + 1);
  script[0] = OP_DATA_32;
  script.set(xOnlyPubkey, 1);
  script[33] = OP_CHECKSIG;

  return {
    version: 0,
    script: bytesToHex(script),
  };
}

/**
 * Create a signature script for P2PK Schnorr
 * Format: <OP_DATA_64> <64-byte Schnorr signature>
 */
export function createSignatureScript(signature: Uint8Array): string {
  if (signature.length !== 64) {
    throw new Error(`Invalid signature length: ${signature.length}, expected 64`);
  }
  const script = new Uint8Array(1 + 64);
  script[0] = OP_DATA_64;
  script.set(signature, 1);
  return bytesToHex(script);
}

// ============================================================================
// Address Decoding
// ============================================================================

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const CHARSET_MAP = new Map<string, number>();
for (let i = 0; i < CHARSET.length; i++) {
  CHARSET_MAP.set(CHARSET[i], i);
}

// Convert 5-bit words to bytes
function fromWords(words: number[]): Uint8Array {
  let acc = 0;
  let bits = 0;
  const bytes: number[] = [];

  for (const word of words) {
    acc = (acc << 5) | word;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Bech32 polymod checksum for Kaspa addresses (CashAddr-style)
 */
function polymod(values: number[]): bigint {
  const GENERATORS = [
    0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n,
    0xae2eabe2a8n, 0x1e4f43e470n,
  ];
  let chk = 1n;
  for (const v of values) {
    const b = chk >> 35n;
    chk = ((chk & 0x07ffffffffn) << 5n) ^ BigInt(v);
    for (let i = 0; i < 5; i++) {
      if ((b >> BigInt(i)) & 1n) chk ^= GENERATORS[i];
    }
  }
  return chk ^ 1n;
}

/**
 * Verify the bech32 checksum of a Kaspa address
 */
function verifyChecksum(prefix: string, data: number[]): boolean {
  const prefixData = [...prefix].map((c) => c.charCodeAt(0) & 0x1f);
  prefixData.push(0); // separator
  return polymod([...prefixData, ...data]) === 0n;
}

/**
 * Decode a Kaspa address to get the public key hash/script
 * Returns the type byte and payload
 */
export function decodeKaspaAddress(address: string): { type: number; payload: Uint8Array } {
  const colonIdx = address.indexOf(":");
  if (colonIdx === -1) throw new Error("Invalid address. Please enter a valid Kaspa address.");

  const prefix = address.slice(0, colonIdx);
  const data = address.slice(colonIdx + 1);

  if (data.length < 9) throw new Error("The address is too short. Please check and try again.");

  // Decode ALL bech32 characters to 5-bit words (including checksum)
  const allWords: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const val = CHARSET_MAP.get(data[i]);
    if (val === undefined) throw new Error("The address contains invalid characters. Please check and try again.");
    allWords.push(val);
  }

  // Verify checksum
  if (!verifyChecksum(prefix, allWords)) {
    throw new Error("This address appears to be invalid or corrupted. Please double-check it.");
  }

  // Exclude 8-char checksum for payload
  const words = allWords.slice(0, -8);

  // Convert to bytes
  const payload = fromWords(words);

  if (payload.length < 1) throw new Error("This address is invalid. Please enter a valid Kaspa address.");

  return {
    type: payload[0],
    payload: payload.slice(1),
  };
}

/**
 * Convert a Kaspa address to its scriptPublicKey
 */
export function addressToScriptPublicKey(address: string): ScriptPublicKey {
  const { type, payload } = decodeKaspaAddress(address);

  if (type === 0x00 && payload.length === 32) {
    // Schnorr P2PK
    const script = new Uint8Array(1 + 32 + 1);
    script[0] = OP_DATA_32;
    script.set(payload, 1);
    script[33] = OP_CHECKSIG;
    return { version: 0, script: bytesToHex(script) };
  } else if (type === 0x01 && payload.length === 33) {
    // ECDSA P2PK
    const script = new Uint8Array(1 + 33 + 1);
    script[0] = OP_DATA_33;
    script.set(payload, 1);
    script[34] = OP_CHECKSIGECDSA;
    return { version: 0, script: bytesToHex(script) };
  } else {
    throw new Error("This address type is not supported by NoXu Wallet.");
  }
}

// ============================================================================
// Sighash Calculation (BIP-341-like for Kaspa)
// ============================================================================

/**
 * Serialize an outpoint for hashing
 */
function serializeOutpoint(outpoint: TransactionOutpoint): Uint8Array {
  // Transaction ID is stored as big-endian hex, but serialized as little-endian bytes
  const txidBytes = reverseBytes(hexToBytes(outpoint.transactionId));
  const indexBytes = writeUint32LE(outpoint.index);
  return concat(txidBytes, indexBytes);
}

/**
 * Serialize a script public key for hashing
 */
function serializeScriptPublicKey(spk: ScriptPublicKey): Uint8Array {
  const scriptBytes = hexToBytes(spk.script);
  return concat(
    writeUint16LE(spk.version),
    writeVarInt(scriptBytes.length),
    scriptBytes
  );
}

/**
 * Serialize an output for hashing
 */
function serializeOutput(output: TransactionOutput): Uint8Array {
  return concat(
    writeUint64LE(output.value),
    serializeScriptPublicKey(output.scriptPublicKey)
  );
}

export type SighashReusedValues = {
  previousOutputsHash?: Uint8Array;
  sequencesHash?: Uint8Array;
  sigOpCountsHash?: Uint8Array;
  outputsHash?: Uint8Array;
};

/**
 * Calculate the sighash for a transaction input
 *
 * Kaspa sighash algorithm (similar to BIP-341):
 * 1. Hash all previous outpoints
 * 2. Hash all sequences
 * 3. Hash all sig op counts
 * 4. Hash all outputs
 * 5. Combine with input-specific data
 */
export function calculateSighash(
  tx: Transaction,
  inputIndex: number,
  utxo: { value: bigint; scriptPublicKey: ScriptPublicKey },
  sighashType: number = SIGHASH_ALL,
  reusedValues: SighashReusedValues = {}
): Uint8Array {
  const input = tx.inputs[inputIndex];
  if (!input) throw new Error(`Invalid input index: ${inputIndex}`);

  // Hash previous outputs (cached)
  if (!reusedValues.previousOutputsHash) {
    const prevOutsData = concat(
      ...tx.inputs.map((inp) => serializeOutpoint(inp.previousOutpoint))
    );
    reusedValues.previousOutputsHash = hashPreviousOutputs(prevOutsData);
  }

  // Hash sequences (cached)
  if (!reusedValues.sequencesHash) {
    const seqData = concat(...tx.inputs.map((inp) => writeUint64LE(inp.sequence)));
    reusedValues.sequencesHash = hashSequences(seqData);
  }

  // Hash sig op counts (cached)
  if (!reusedValues.sigOpCountsHash) {
    const sigOpData = new Uint8Array(tx.inputs.length);
    for (let i = 0; i < tx.inputs.length; i++) {
      sigOpData[i] = tx.inputs[i].sigOpCount;
    }
    reusedValues.sigOpCountsHash = hashSigOpCounts(sigOpData);
  }

  // Hash outputs (cached)
  if (!reusedValues.outputsHash) {
    const outsData = concat(...tx.outputs.map((out) => serializeOutput(out)));
    reusedValues.outputsHash = hashOutputs(outsData);
  }

  // Build the sighash preimage
  const preimage = concat(
    // Transaction version (2 bytes, little-endian)
    writeUint16LE(tx.version),
    // Previous outputs hash (32 bytes)
    reusedValues.previousOutputsHash,
    // Sequences hash (32 bytes)
    reusedValues.sequencesHash,
    // Sig op counts hash (32 bytes)
    reusedValues.sigOpCountsHash,
    // Current input's outpoint (36 bytes)
    serializeOutpoint(input.previousOutpoint),
    // Current input's script public key (version + varint + script)
    serializeScriptPublicKey(utxo.scriptPublicKey),
    // Current input's value (8 bytes)
    writeUint64LE(utxo.value),
    // Current input's sequence (8 bytes)
    writeUint64LE(input.sequence),
    // Current input's sig op count (1 byte)
    new Uint8Array([input.sigOpCount]),
    // Outputs hash (32 bytes)
    reusedValues.outputsHash,
    // Lock time (8 bytes)
    writeUint64LE(tx.lockTime),
    // Subnetwork ID (20 bytes)
    hexToBytes(tx.subnetworkId),
    // Gas (8 bytes)
    writeUint64LE(tx.gas),
    // Payload hash (32 bytes of zeros for empty payload)
    tx.payload.length > 0
      ? hashWithPersonalization(hexToBytes(tx.payload), "TransactionPayload")
      : new Uint8Array(32),
    // Sighash type (1 byte)
    new Uint8Array([sighashType])
  );

  return hashTransactionSigningHash(preimage);
}

// ============================================================================
// Transaction Signing
// ============================================================================

/**
 * Sign a transaction input with Schnorr signature
 */
export function signInput(
  tx: Transaction,
  inputIndex: number,
  privateKey: Uint8Array,
  utxo: { value: bigint; scriptPublicKey: ScriptPublicKey },
  sighashType: number = SIGHASH_ALL,
  reusedValues: SighashReusedValues = {}
): Uint8Array {
  const sighash = calculateSighash(tx, inputIndex, utxo, sighashType, reusedValues);

  // Sign with Schnorr (BIP-340 style)
  // Note: @noble/curves schnorr.sign expects 32-byte private key
  const signature = schnorr.sign(sighash, privateKey);

  return signature;
}

/**
 * Sign all inputs of a transaction
 */
export function signTransaction(
  tx: Transaction,
  privateKey: Uint8Array,
  utxos: Array<{ value: bigint; scriptPublicKey: ScriptPublicKey }>,
  sighashType: number = SIGHASH_ALL
): Transaction {
  if (utxos.length !== tx.inputs.length) {
    throw new Error("UTXO count must match input count");
  }

  const reusedValues: SighashReusedValues = {};
  const signedInputs = tx.inputs.map((input, i) => {
    const signature = signInput(tx, i, privateKey, utxos[i], sighashType, reusedValues);
    return {
      ...input,
      signatureScript: createSignatureScript(signature),
    };
  });

  return {
    ...tx,
    inputs: signedInputs,
  };
}

// ============================================================================
// Transaction ID Calculation
// ============================================================================

/**
 * Serialize a transaction for ID calculation (without signatures)
 */
export function serializeTransactionForId(tx: Transaction): Uint8Array {
  const parts: Uint8Array[] = [];

  // Version (2 bytes)
  parts.push(writeUint16LE(tx.version));

  // Number of inputs
  parts.push(writeVarInt(tx.inputs.length));

  // Inputs (without signature scripts)
  for (const input of tx.inputs) {
    parts.push(serializeOutpoint(input.previousOutpoint));
    // Empty signature script for ID calculation
    parts.push(writeVarInt(0));
    parts.push(writeUint64LE(input.sequence));
  }

  // Number of outputs
  parts.push(writeVarInt(tx.outputs.length));

  // Outputs
  for (const output of tx.outputs) {
    parts.push(serializeOutput(output));
  }

  // Lock time (8 bytes)
  parts.push(writeUint64LE(tx.lockTime));

  // Subnetwork ID (20 bytes)
  parts.push(hexToBytes(tx.subnetworkId));

  // Gas (8 bytes)
  parts.push(writeUint64LE(tx.gas));

  // Payload
  const payloadBytes = tx.payload.length > 0 ? hexToBytes(tx.payload) : new Uint8Array(0);
  parts.push(writeVarInt(payloadBytes.length));
  if (payloadBytes.length > 0) {
    parts.push(payloadBytes);
  }

  return concat(...parts);
}

/**
 * Calculate the transaction ID
 */
export function calculateTransactionId(tx: Transaction): string {
  const serialized = serializeTransactionForId(tx);
  const hash = hashTransactionId(serialized);
  // Transaction ID is displayed as big-endian hex
  return bytesToHex(reverseBytes(hash));
}

// ============================================================================
// Transaction Building
// ============================================================================

export type TransactionBuilderOptions = {
  feePerInput?: bigint; // Fee per input in sompi (default: 1000)
  feePerOutput?: bigint; // Fee per output in sompi (default: 1000)
  baseFee?: bigint; // Base transaction fee (default: 1000)
};

const DEFAULT_FEE_PER_INPUT = 1000n;
const DEFAULT_FEE_PER_OUTPUT = 1000n;
const DEFAULT_BASE_FEE = 1000n;

/**
 * Calculate the fee for a transaction
 */
export function calculateFee(
  numInputs: number,
  numOutputs: number,
  options: TransactionBuilderOptions = {}
): bigint {
  const feePerInput = options.feePerInput ?? DEFAULT_FEE_PER_INPUT;
  const feePerOutput = options.feePerOutput ?? DEFAULT_FEE_PER_OUTPUT;
  const baseFee = options.baseFee ?? DEFAULT_BASE_FEE;

  return baseFee + feePerInput * BigInt(numInputs) + feePerOutput * BigInt(numOutputs);
}

/**
 * Select UTXOs for a transaction (simple largest-first selection)
 */
export function selectUtxos(
  utxos: KaspaUTXO[],
  amountNeeded: bigint,
  options: TransactionBuilderOptions = {}
): { selected: KaspaUTXO[]; total: bigint; fee: bigint } {
  // Sort by amount descending (largest first)
  const sorted = [...utxos].sort((a, b) => {
    if (a.amountSompi > b.amountSompi) return -1;
    if (a.amountSompi < b.amountSompi) return 1;
    return 0;
  });

  const selected: KaspaUTXO[] = [];
  let total = 0n;

  for (const utxo of sorted) {
    selected.push(utxo);
    total += utxo.amountSompi;

    // Calculate fee with current selection (assume 2 outputs: recipient + change)
    const fee = calculateFee(selected.length, 2, options);

    if (total >= amountNeeded + fee) {
      return { selected, total, fee };
    }
  }

  // Couldn't select enough
  const finalFee = calculateFee(selected.length, 2, options);
  throw new Error(
    `Insufficient funds: need ${amountNeeded + finalFee} sompi, have ${total} sompi`
  );
}

/**
 * Build an unsigned transaction
 */
export function buildTransaction(
  utxos: KaspaUTXO[],
  toAddress: string,
  amount: bigint,
  changeAddress: string,
  options: TransactionBuilderOptions = {}
): { tx: Transaction; selectedUtxos: KaspaUTXO[] } {
  const { selected, total, fee } = selectUtxos(utxos, amount, options);
  const change = total - amount - fee;

  const outputs: TransactionOutput[] = [
    {
      value: amount,
      scriptPublicKey: addressToScriptPublicKey(toAddress),
    },
  ];

  // Add change output if above dust limit — dust outputs are uneconomical
  // to spend and may be rejected by the network
  if (change >= DUST_LIMIT) {
    outputs.push({
      value: change,
      scriptPublicKey: addressToScriptPublicKey(changeAddress),
    });
  }
  // If change < DUST_LIMIT, it's absorbed into the fee (miner tip)

  const inputs: TransactionInput[] = selected.map((utxo) => ({
    previousOutpoint: {
      transactionId: utxo.transactionId,
      index: utxo.index,
    },
    signatureScript: "", // Will be filled during signing
    sequence: 0xffffffffffffffffn, // Max sequence (no RBF)
    sigOpCount: 1, // P2PK has 1 sig op
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

  return { tx, selectedUtxos: selected };
}

// ============================================================================
// Transaction Serialization for Broadcast
// ============================================================================

/**
 * Serialize a signed transaction for network broadcast
 * Returns the format expected by Kaspa RPC API
 */
export function serializeForBroadcast(tx: Transaction): object {
  return {
    transaction: {
      version: tx.version,
      inputs: tx.inputs.map((input) => ({
        previousOutpoint: {
          transactionId: input.previousOutpoint.transactionId,
          index: input.previousOutpoint.index,
        },
        signatureScript: input.signatureScript,
        sequence: input.sequence.toString(),
        sigOpCount: input.sigOpCount,
      })),
      outputs: tx.outputs.map((output) => ({
        value: output.value.toString(),
        scriptPublicKey: {
          version: output.scriptPublicKey.version,
          scriptPublicKey: output.scriptPublicKey.script,
        },
      })),
      lockTime: tx.lockTime.toString(),
      subnetworkId: tx.subnetworkId,
      gas: tx.gas.toString(),
      payload: tx.payload || "",
    },
  };
}

// ============================================================================
// High-Level API
// ============================================================================

/**
 * Build, sign, and prepare a transaction for broadcast
 */
export function createSignedTransaction(
  utxos: KaspaUTXO[],
  toAddress: string,
  amount: bigint,
  changeAddress: string,
  privateKey: Uint8Array,
  options: TransactionBuilderOptions = {}
): { signedTx: Transaction; txId: string; broadcastData: object } {
  // Build unsigned transaction
  const { tx, selectedUtxos } = buildTransaction(utxos, toAddress, amount, changeAddress, options);

  // Create UTXO info for signing
  const utxoInfos = selectedUtxos.map((utxo) => ({
    value: utxo.amountSompi,
    scriptPublicKey: {
      version: 0,
      script: utxo.scriptPublicKey,
    },
  }));

  // Sign the transaction
  const signedTx = signTransaction(tx, privateKey, utxoInfos);

  // Calculate transaction ID
  const txId = calculateTransactionId(signedTx);

  // Prepare for broadcast
  const broadcastData = serializeForBroadcast(signedTx);

  return { signedTx, txId, broadcastData };
}

// ============================================================================
// Async Signer Variants (for hardware wallets)
// ============================================================================

/**
 * Sign all inputs using a TransactionSigner (async, supports hardware wallets)
 */
export async function signTransactionWithSigner(
  tx: Transaction,
  signer: TransactionSigner,
  utxos: Array<{ value: bigint; scriptPublicKey: ScriptPublicKey }>,
  sighashType: number = SIGHASH_ALL
): Promise<Transaction> {
  if (utxos.length !== tx.inputs.length) {
    throw new Error("UTXO count must match input count");
  }

  const reusedValues: SighashReusedValues = {};
  const signedInputs = [];

  for (let i = 0; i < tx.inputs.length; i++) {
    const sighash = calculateSighash(tx, i, utxos[i], sighashType, reusedValues);
    const signature = await signer.sign(sighash);
    signedInputs.push({
      ...tx.inputs[i],
      signatureScript: createSignatureScript(signature),
    });
  }

  return { ...tx, inputs: signedInputs };
}

/**
 * Build, sign (async), and prepare a transaction for broadcast
 */
export async function createSignedTransactionWithSigner(
  utxos: KaspaUTXO[],
  toAddress: string,
  amount: bigint,
  changeAddress: string,
  signer: TransactionSigner,
  options: TransactionBuilderOptions = {}
): Promise<{ signedTx: Transaction; txId: string; broadcastData: object }> {
  const { tx, selectedUtxos } = buildTransaction(utxos, toAddress, amount, changeAddress, options);

  const utxoInfos = selectedUtxos.map((utxo) => ({
    value: utxo.amountSompi,
    scriptPublicKey: {
      version: 0,
      script: utxo.scriptPublicKey,
    },
  }));

  const signedTx = await signTransactionWithSigner(tx, signer, utxoInfos);
  const txId = calculateTransactionId(signedTx);
  const broadcastData = serializeForBroadcast(signedTx);

  return { signedTx, txId, broadcastData };
}
