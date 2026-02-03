// src/core/kaspa/transaction.test.ts
// Test suite for Kaspa transaction signing

import { schnorr } from "@noble/curves/secp256k1";
import { hexToBytes, bytesToHex } from "@noble/hashes/utils";
import {
  createSignedTransaction,
  buildTransaction,
  signTransaction,
  calculateSighash,
  calculateTransactionId,
  addressToScriptPublicKey,
  decodeKaspaAddress,
  createP2PKScript,
  createSignatureScript,
  selectUtxos,
  calculateFee,
  SIGHASH_ALL,
  type Transaction,
  type KaspaUTXO,
} from "./transaction";
import { deriveAccountFromSeed, mnemonicToSeed } from "../crypto/mnemonic";

// Test utilities
function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// ============================================================================
// Test Cases
// ============================================================================

async function testAddressDecoding(): Promise<void> {
  console.log("Testing address decoding...");

  // Test mainnet Schnorr address
  const mainnetAddr = "kaspa:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjuneqpk42";
  const decoded = decodeKaspaAddress(mainnetAddr);

  assertEqual(decoded.type, 0x00, "Address type should be 0x00 (Schnorr P2PK)");
  assertEqual(decoded.payload.length, 32, "Payload should be 32 bytes (x-only pubkey)");

  // Test that we can convert back to scriptPublicKey
  const spk = addressToScriptPublicKey(mainnetAddr);
  assertEqual(spk.version, 0, "Script version should be 0");
  assert(spk.script.length === 68, "Script should be 34 bytes (68 hex chars)"); // OP_DATA_32 + 32 bytes + OP_CHECKSIG

  console.log("✓ Address decoding tests passed");
}

async function testScriptCreation(): Promise<void> {
  console.log("Testing script creation...");

  // Test P2PK script creation with 32-byte pubkey
  const xOnlyPubkey = new Uint8Array(32).fill(0xab);
  const spk = createP2PKScript(xOnlyPubkey);

  assertEqual(spk.version, 0, "Script version should be 0");
  assert(spk.script.startsWith("20"), "Script should start with OP_DATA_32 (0x20)");
  assert(spk.script.endsWith("ac"), "Script should end with OP_CHECKSIG (0xac)");
  assertEqual(spk.script.length, 68, "Script should be 34 bytes");

  // Test P2PK script creation with 33-byte compressed pubkey
  const compressedPubkey = new Uint8Array(33);
  compressedPubkey[0] = 0x02; // Compressed pubkey prefix
  compressedPubkey.fill(0xcd, 1);
  const spk2 = createP2PKScript(compressedPubkey);

  assertEqual(spk2.version, 0, "Script version should be 0");
  // Should extract x-coordinate (skip first byte)
  assert(spk2.script.includes("cd".repeat(32)), "Script should contain x-coordinate");

  // Test signature script creation
  const signature = new Uint8Array(64).fill(0x11);
  const sigScript = createSignatureScript(signature);
  assert(sigScript.startsWith("40"), "Sig script should start with OP_DATA_64 (0x40)");
  assertEqual(sigScript.length, 130, "Sig script should be 65 bytes (130 hex chars)");

  console.log("✓ Script creation tests passed");
}

async function testFeeCalculation(): Promise<void> {
  console.log("Testing fee calculation...");

  // Default fees
  const fee1 = calculateFee(1, 2);
  assertEqual(fee1, 4000n, "Fee for 1 input, 2 outputs should be 4000 sompi");

  const fee2 = calculateFee(3, 2);
  assertEqual(fee2, 6000n, "Fee for 3 inputs, 2 outputs should be 6000 sompi");

  // Custom fees
  const fee3 = calculateFee(2, 2, { feePerInput: 500n, feePerOutput: 500n, baseFee: 500n });
  assertEqual(fee3, 2500n, "Custom fee calculation");

  console.log("✓ Fee calculation tests passed");
}

async function testUtxoSelection(): Promise<void> {
  console.log("Testing UTXO selection...");

  const utxos: KaspaUTXO[] = [
    { transactionId: "a".repeat(64), index: 0, amountSompi: 1000000n, scriptPublicKey: "20" + "ab".repeat(32) + "ac" },
    { transactionId: "b".repeat(64), index: 0, amountSompi: 500000n, scriptPublicKey: "20" + "ab".repeat(32) + "ac" },
    { transactionId: "c".repeat(64), index: 0, amountSompi: 250000n, scriptPublicKey: "20" + "ab".repeat(32) + "ac" },
  ];

  // Should select largest UTXO first
  const result = selectUtxos(utxos, 100000n);
  assertEqual(result.selected.length, 1, "Should select 1 UTXO");
  assertEqual(result.selected[0].amountSompi, 1000000n, "Should select largest UTXO");
  assertEqual(result.total, 1000000n, "Total should be 1000000");
  assertEqual(result.fee, 4000n, "Fee should be 4000 sompi");

  // Should select multiple if needed
  const result2 = selectUtxos(utxos, 1200000n);
  assertEqual(result2.selected.length, 2, "Should select 2 UTXOs");
  assertEqual(result2.total, 1500000n, "Total should be 1500000");

  // Should throw on insufficient funds
  let threw = false;
  try {
    selectUtxos(utxos, 2000000n);
  } catch (e) {
    threw = true;
    assert((e as Error).message.includes("Insufficient funds"), "Should throw insufficient funds");
  }
  assert(threw, "Should throw on insufficient funds");

  console.log("✓ UTXO selection tests passed");
}

async function testTransactionBuilding(): Promise<void> {
  console.log("Testing transaction building...");

  const utxos: KaspaUTXO[] = [
    {
      transactionId: "a".repeat(64),
      index: 0,
      amountSompi: 1000000n,
      scriptPublicKey: "20" + "ab".repeat(32) + "ac"
    },
  ];

  // Use a valid testnet address format
  const toAddress = "kaspatest:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjeffnxvv7";
  const changeAddress = "kaspatest:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjeffnxvv7";

  const { tx, selectedUtxos } = buildTransaction(utxos, toAddress, 100000n, changeAddress);

  assertEqual(tx.version, 0, "Transaction version should be 0");
  assertEqual(tx.inputs.length, 1, "Should have 1 input");
  assertEqual(tx.outputs.length, 2, "Should have 2 outputs (recipient + change)");
  assertEqual(tx.inputs[0].previousOutpoint.transactionId, "a".repeat(64), "Input txid");
  assertEqual(tx.inputs[0].previousOutpoint.index, 0, "Input index");
  assertEqual(tx.outputs[0].value, 100000n, "Output value");

  const expectedChange = 1000000n - 100000n - 4000n; // total - amount - fee
  assertEqual(tx.outputs[1].value, expectedChange, "Change value");

  console.log("✓ Transaction building tests passed");
}

async function testSighashCalculation(): Promise<void> {
  console.log("Testing sighash calculation...");

  const tx: Transaction = {
    version: 0,
    inputs: [{
      previousOutpoint: { transactionId: "a".repeat(64), index: 0 },
      signatureScript: "",
      sequence: 0xffffffffffffffffn,
      sigOpCount: 1,
    }],
    outputs: [{
      value: 100000n,
      scriptPublicKey: { version: 0, script: "20" + "bb".repeat(32) + "ac" },
    }],
    lockTime: 0n,
    subnetworkId: "0".repeat(40),
    gas: 0n,
    payload: "",
  };

  const utxo = {
    value: 1000000n,
    scriptPublicKey: { version: 0, script: "20" + "aa".repeat(32) + "ac" },
  };

  const sighash = calculateSighash(tx, 0, utxo, SIGHASH_ALL);

  assertEqual(sighash.length, 32, "Sighash should be 32 bytes");
  assert(sighash.some(b => b !== 0), "Sighash should not be all zeros");

  // Verify determinism - same inputs should produce same sighash
  const sighash2 = calculateSighash(tx, 0, utxo, SIGHASH_ALL);
  assertEqual(
    bytesToHex(sighash),
    bytesToHex(sighash2),
    "Sighash should be deterministic"
  );

  console.log("✓ Sighash calculation tests passed");
}

async function testTransactionSigning(): Promise<void> {
  console.log("Testing transaction signing...");

  // Generate a test keypair
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);

  // Ensure private key is valid for secp256k1 (not zero, not >= curve order)
  privateKey[0] = 0x01; // Ensure non-zero

  const publicKey = schnorr.getPublicKey(privateKey);

  const tx: Transaction = {
    version: 0,
    inputs: [{
      previousOutpoint: { transactionId: "a".repeat(64), index: 0 },
      signatureScript: "",
      sequence: 0xffffffffffffffffn,
      sigOpCount: 1,
    }],
    outputs: [{
      value: 100000n,
      scriptPublicKey: { version: 0, script: "20" + bytesToHex(publicKey) + "ac" },
    }],
    lockTime: 0n,
    subnetworkId: "0".repeat(40),
    gas: 0n,
    payload: "",
  };

  const utxos = [{
    value: 1000000n,
    scriptPublicKey: { version: 0, script: "20" + bytesToHex(publicKey) + "ac" },
  }];

  const signedTx = signTransaction(tx, privateKey, utxos);

  // Verify signature script was added
  assert(signedTx.inputs[0].signatureScript.length > 0, "Signature script should be set");
  assert(signedTx.inputs[0].signatureScript.startsWith("40"), "Should start with OP_DATA_64");

  // Extract and verify signature
  const sigScript = signedTx.inputs[0].signatureScript;
  const signatureHex = sigScript.slice(2); // Remove OP_DATA_64
  const signature = hexToBytes(signatureHex);

  assertEqual(signature.length, 64, "Signature should be 64 bytes");

  // Verify signature is valid
  const sighash = calculateSighash(tx, 0, utxos[0], SIGHASH_ALL);
  const isValid = schnorr.verify(signature, sighash, publicKey);
  assert(isValid, "Signature should be valid");

  console.log("✓ Transaction signing tests passed");
}

async function testTransactionIdCalculation(): Promise<void> {
  console.log("Testing transaction ID calculation...");

  const tx: Transaction = {
    version: 0,
    inputs: [{
      previousOutpoint: { transactionId: "a".repeat(64), index: 0 },
      signatureScript: "40" + "bb".repeat(64),
      sequence: 0xffffffffffffffffn,
      sigOpCount: 1,
    }],
    outputs: [{
      value: 100000n,
      scriptPublicKey: { version: 0, script: "20" + "cc".repeat(32) + "ac" },
    }],
    lockTime: 0n,
    subnetworkId: "0".repeat(40),
    gas: 0n,
    payload: "",
  };

  const txId = calculateTransactionId(tx);

  assertEqual(txId.length, 64, "Transaction ID should be 64 hex chars (32 bytes)");
  assert(txId.match(/^[0-9a-f]+$/), "Transaction ID should be hex");

  // Verify determinism
  const txId2 = calculateTransactionId(tx);
  assertEqual(txId, txId2, "Transaction ID should be deterministic");

  // Verify that signature doesn't affect txid (Kaspa uses SegWit-like txid)
  const tx2 = { ...tx, inputs: [{ ...tx.inputs[0], signatureScript: "40" + "dd".repeat(64) }] };
  const txId3 = calculateTransactionId(tx2);
  assertEqual(txId, txId3, "Transaction ID should not depend on signature");

  console.log("✓ Transaction ID calculation tests passed");
}

async function testEndToEndSigning(): Promise<void> {
  console.log("Testing end-to-end transaction creation...");

  // Use a test mnemonic
  const testMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const { seed } = mnemonicToSeed(testMnemonic);
  const account = deriveAccountFromSeed(seed, true); // testnet

  console.log(`  Derived address: ${account.address}`);

  // Create mock UTXOs
  const utxos: KaspaUTXO[] = [
    {
      transactionId: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      index: 0,
      amountSompi: 10000000n, // 0.1 KAS
      scriptPublicKey: addressToScriptPublicKey(account.address).script,
    },
  ];

  // Create a signed transaction
  const { signedTx, txId, broadcastData } = createSignedTransaction(
    utxos,
    account.address, // Send to self for testing
    1000000n, // 0.01 KAS
    account.address,
    account.privateKey
  );

  // Verify the result
  assertEqual(signedTx.inputs.length, 1, "Should have 1 input");
  assertEqual(signedTx.outputs.length, 2, "Should have 2 outputs");
  assert(signedTx.inputs[0].signatureScript.length > 0, "Input should be signed");
  assertEqual(txId.length, 64, "Transaction ID should be 64 hex chars");
  assert(broadcastData !== null, "Broadcast data should be present");

  // Verify signature
  const signature = hexToBytes(signedTx.inputs[0].signatureScript.slice(2));
  const xOnlyPubkey = account.publicKey.length === 33
    ? account.publicKey.slice(1)
    : account.publicKey;

  const utxoInfo = {
    value: utxos[0].amountSompi,
    scriptPublicKey: { version: 0, script: utxos[0].scriptPublicKey },
  };

  // Recreate unsigned tx for sighash
  const unsignedTx = { ...signedTx, inputs: signedTx.inputs.map(i => ({ ...i, signatureScript: "" })) };
  const sighash = calculateSighash(unsignedTx, 0, utxoInfo, SIGHASH_ALL);

  const isValid = schnorr.verify(signature, sighash, xOnlyPubkey);
  assert(isValid, "End-to-end signature should be valid");

  console.log(`  Transaction ID: ${txId}`);
  console.log("✓ End-to-end signing tests passed");
}

// ============================================================================
// Run All Tests
// ============================================================================

export async function runAllTests(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Kaspa Transaction Signing Tests");
  console.log("=".repeat(60));
  console.log("");

  try {
    await testAddressDecoding();
    await testScriptCreation();
    await testFeeCalculation();
    await testUtxoSelection();
    await testTransactionBuilding();
    await testSighashCalculation();
    await testTransactionSigning();
    await testTransactionIdCalculation();
    await testEndToEndSigning();

    console.log("");
    console.log("=".repeat(60));
    console.log("All tests passed! ✓");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("");
    console.error("=".repeat(60));
    console.error("TEST FAILED:");
    console.error((error as Error).message);
    console.error((error as Error).stack);
    console.error("=".repeat(60));
    throw error;
  }
}

// Auto-run if executed directly
if (typeof window === "undefined" && typeof process !== "undefined") {
  runAllTests().catch(console.error);
}
