// src/core/kaspa/krc20-transaction.test.ts
// Test suite for KRC-20 inscription transactions

import { schnorr } from "@noble/curves/secp256k1";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  createKRC20TransferInscription,
  serializeInscription,
  createInscriptionRedeemScript,
  createP2SHScript,
  buildKRC20CommitTransaction,
  signCommitTransaction,
  buildKRC20RevealTransaction,
  signRevealTransaction,
  createKRC20Transfer,
  estimateKRC20TransferCost,
  type KRC20TransferInscription,
} from "./krc20-transaction";
import { calculateTransactionId, addressToScriptPublicKey } from "./transaction";
import { deriveAccountFromSeed, mnemonicToSeed } from "../crypto/mnemonic";
import type { KaspaUTXO } from "./client";

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

async function testInscriptionCreation(): Promise<void> {
  console.log("Testing inscription creation...");

  const inscription = createKRC20TransferInscription(
    "kasper",
    1000000n,
    "kaspa:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjuneqpk42"
  );

  assertEqual(inscription.p, "krc-20", "Protocol should be krc-20");
  assertEqual(inscription.op, "transfer", "Operation should be transfer");
  assertEqual(inscription.tick, "KASPER", "Ticker should be uppercase");
  assertEqual(inscription.amt, "1000000", "Amount should be string");
  assert(inscription.to.startsWith("kaspa:"), "To address should be Kaspa address");

  // Test serialization
  const serialized = serializeInscription(inscription);
  const json = new TextDecoder().decode(serialized);
  const parsed = JSON.parse(json);

  assertEqual(parsed.p, "krc-20", "Parsed protocol");
  assertEqual(parsed.op, "transfer", "Parsed operation");
  assertEqual(parsed.tick, "KASPER", "Parsed ticker");

  console.log("✓ Inscription creation tests passed");
}

async function testRedeemScriptCreation(): Promise<void> {
  console.log("Testing redeem script creation...");

  // Generate test keypair
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  privateKey[0] = 0x01; // Ensure non-zero
  const publicKey = schnorr.getPublicKey(privateKey);

  const inscription = createKRC20TransferInscription(
    "TEST",
    500n,
    "kaspa:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjuneqpk42"
  );
  const inscriptionData = serializeInscription(inscription);

  const redeemScript = createInscriptionRedeemScript(publicKey, inscriptionData);

  // Verify script structure:
  // OP_DATA_32 (0x20) + 32-byte pubkey + OP_CHECKSIG (0xac) + OP_FALSE (0x00) + OP_IF (0x63) + ...
  assertEqual(redeemScript[0], 0x20, "Should start with OP_DATA_32");
  assertEqual(redeemScript[33], 0xac, "Should have OP_CHECKSIG at position 33");
  assertEqual(redeemScript[34], 0x00, "Should have OP_FALSE at position 34");
  assertEqual(redeemScript[35], 0x63, "Should have OP_IF at position 35");

  // Verify pubkey is embedded
  const embeddedPubkey = redeemScript.slice(1, 33);
  assertEqual(bytesToHex(embeddedPubkey), bytesToHex(publicKey), "Pubkey should be embedded");

  // Verify "kasplex" marker is in the script
  const scriptStr = new TextDecoder().decode(redeemScript);
  assert(scriptStr.includes("kasplex"), "Script should contain 'kasplex' marker");

  // Verify script ends with OP_ENDIF (0x68)
  assertEqual(redeemScript[redeemScript.length - 1], 0x68, "Should end with OP_ENDIF");

  console.log("✓ Redeem script creation tests passed");
}

async function testP2SHScriptCreation(): Promise<void> {
  console.log("Testing P2SH script creation...");

  const testHash = new Uint8Array(32).fill(0xab);
  const p2shScript = createP2SHScript(testHash);

  assertEqual(p2shScript.version, 0, "Version should be 0");

  // P2SH script format: OP_HASH256 (0xaa) + OP_DATA_32 (0x20) + 32-byte hash + OP_EQUAL (0x87)
  const scriptBytes = hexToBytes(p2shScript.script);
  assertEqual(scriptBytes.length, 35, "P2SH script should be 35 bytes");
  assertEqual(scriptBytes[0], 0xaa, "Should start with OP_HASH256");
  assertEqual(scriptBytes[1], 0x20, "Should have OP_DATA_32");
  assertEqual(scriptBytes[34], 0x87, "Should end with OP_EQUAL");

  // Verify hash is embedded
  const embeddedHash = scriptBytes.slice(2, 34);
  assertEqual(bytesToHex(embeddedHash), bytesToHex(testHash), "Hash should be embedded");

  console.log("✓ P2SH script creation tests passed");
}

async function testCommitTransactionBuilding(): Promise<void> {
  console.log("Testing commit transaction building...");

  // Generate test keypair
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  privateKey[0] = 0x01;
  const publicKey = schnorr.getPublicKey(privateKey);

  // Create mock UTXOs
  const utxos: KaspaUTXO[] = [
    {
      transactionId: "a".repeat(64),
      index: 0,
      amountSompi: 1000000n,
      scriptPublicKey: "20" + bytesToHex(publicKey) + "ac",
    },
  ];

  const inscription = createKRC20TransferInscription(
    "TEST",
    100n,
    "kaspatest:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjeffnxvv7"
  );

  const result = buildKRC20CommitTransaction(
    utxos,
    publicKey,
    inscription,
    "kaspatest:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjeffnxvv7"
  );

  // Verify structure
  assertEqual(result.tx.inputs.length, 1, "Should have 1 input");
  assertEqual(result.tx.outputs.length, 2, "Should have 2 outputs (P2SH + change)");
  assertEqual(result.p2shOutputIndex, 0, "P2SH output should be at index 0");
  assertEqual(result.commitOutputAmount, 30000n, "Default commit output amount");

  // Verify P2SH output has correct script format
  const p2shOutput = result.tx.outputs[0];
  const p2shScriptBytes = hexToBytes(p2shOutput.scriptPublicKey.script);
  assertEqual(p2shScriptBytes[0], 0xaa, "P2SH output should start with OP_HASH256");

  // Verify redeemScript and hash match
  assert(result.redeemScript.length > 50, "Redeem script should be substantial");
  assertEqual(result.redeemScriptHash.length, 32, "Redeem script hash should be 32 bytes");

  console.log("✓ Commit transaction building tests passed");
}

async function testCommitTransactionSigning(): Promise<void> {
  console.log("Testing commit transaction signing...");

  // Generate test keypair
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  privateKey[0] = 0x01;
  const publicKey = schnorr.getPublicKey(privateKey);

  const utxos: KaspaUTXO[] = [
    {
      transactionId: "b".repeat(64),
      index: 0,
      amountSompi: 500000n,
      scriptPublicKey: "20" + bytesToHex(publicKey) + "ac",
    },
  ];

  const inscription = createKRC20TransferInscription(
    "TEST",
    50n,
    "kaspatest:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjeffnxvv7"
  );

  const { tx, selectedUtxos } = buildKRC20CommitTransaction(
    utxos,
    publicKey,
    inscription,
    "kaspatest:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjeffnxvv7"
  );

  // Sign the commit transaction
  const signedTx = signCommitTransaction(tx, privateKey, selectedUtxos);

  // Verify signature was added
  assert(signedTx.inputs[0].signatureScript.length > 0, "Should have signature script");
  assert(signedTx.inputs[0].signatureScript.startsWith("40"), "Should start with OP_DATA_64");

  // Verify signature is 64 bytes
  const sigHex = signedTx.inputs[0].signatureScript.slice(2);
  assertEqual(sigHex.length, 128, "Signature should be 64 bytes (128 hex chars)");

  console.log("✓ Commit transaction signing tests passed");
}

async function testRevealTransactionBuilding(): Promise<void> {
  console.log("Testing reveal transaction building...");

  // Generate test keypair
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  privateKey[0] = 0x01;
  const publicKey = schnorr.getPublicKey(privateKey);

  const inscription = createKRC20TransferInscription(
    "TEST",
    100n,
    "kaspatest:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjeffnxvv7"
  );
  const inscriptionData = serializeInscription(inscription);
  const redeemScript = createInscriptionRedeemScript(publicKey, inscriptionData);

  const commitTxId = "c".repeat(64);
  const commitOutputAmount = 30000n;

  const { tx, p2shUtxo } = buildKRC20RevealTransaction(
    commitTxId,
    0,
    commitOutputAmount,
    redeemScript,
    "kaspatest:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjeffnxvv7"
  );

  // Verify structure
  assertEqual(tx.inputs.length, 1, "Should have 1 input");
  assertEqual(tx.outputs.length, 1, "Should have 1 output");
  assertEqual(tx.inputs[0].previousOutpoint.transactionId, commitTxId, "Should reference commit tx");
  assertEqual(tx.inputs[0].previousOutpoint.index, 0, "Should reference correct output index");

  // Verify output amount (commit amount minus fee)
  assert(tx.outputs[0].value < commitOutputAmount, "Output should be less than input (fee deducted)");
  assert(tx.outputs[0].value > 0n, "Output should be positive");

  // Verify P2SH UTXO info
  assertEqual(p2shUtxo.value, commitOutputAmount, "P2SH UTXO value should match commit amount");

  console.log("✓ Reveal transaction building tests passed");
}

async function testRevealTransactionSigning(): Promise<void> {
  console.log("Testing reveal transaction signing...");

  // Generate test keypair
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  privateKey[0] = 0x01;
  const publicKey = schnorr.getPublicKey(privateKey);

  const inscription = createKRC20TransferInscription(
    "TEST",
    100n,
    "kaspatest:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjeffnxvv7"
  );
  const inscriptionData = serializeInscription(inscription);
  const redeemScript = createInscriptionRedeemScript(publicKey, inscriptionData);

  const commitTxId = "d".repeat(64);
  const commitOutputAmount = 30000n;

  const { tx, p2shUtxo } = buildKRC20RevealTransaction(
    commitTxId,
    0,
    commitOutputAmount,
    redeemScript,
    "kaspatest:qz7ulu4c25dh7fzec9zjyrmlhnkzrg4wmf89q7gzr3gfrsj3uz6xjeffnxvv7"
  );

  // Sign the reveal transaction
  const signedTx = signRevealTransaction(tx, privateKey, redeemScript, p2shUtxo);

  // Verify signature script was added
  assert(signedTx.inputs[0].signatureScript.length > 0, "Should have signature script");

  // P2SH signature script format: OP_DATA_64 <signature> <redeem_script_push> <redeem_script>
  const sigScript = signedTx.inputs[0].signatureScript;
  assert(sigScript.startsWith("40"), "Should start with OP_DATA_64 for signature");

  // The signature script should contain both the signature and the redeem script
  // Signature is 64 bytes = 128 hex chars, plus OP_DATA_64 = 130 hex chars minimum
  assert(sigScript.length > 130, "Signature script should include redeem script");

  console.log("✓ Reveal transaction signing tests passed");
}

async function testEndToEndKRC20Transfer(): Promise<void> {
  console.log("Testing end-to-end KRC-20 transfer...");

  // Use test mnemonic
  const testMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const { seed } = mnemonicToSeed(testMnemonic);
  const account = deriveAccountFromSeed(seed, true); // testnet

  console.log(`  Derived address: ${account.address}`);

  // Create mock UTXOs
  const utxos: KaspaUTXO[] = [
    {
      transactionId: "e".repeat(64),
      index: 0,
      amountSompi: 100000n, // 0.001 KAS
      scriptPublicKey: addressToScriptPublicKey(account.address).script,
    },
  ];

  // Execute full transfer
  const result = createKRC20Transfer(
    utxos,
    account.privateKey,
    account.publicKey,
    "TEST",
    1000n,
    account.address, // Send to self for testing
    account.address
  );

  // Verify commit transaction
  assertEqual(result.commitTx.inputs.length, 1, "Commit should have 1 input");
  assertEqual(result.commitTx.outputs.length, 2, "Commit should have 2 outputs");
  assert(result.commitTx.inputs[0].signatureScript.length > 0, "Commit should be signed");
  assertEqual(result.commitTxId.length, 64, "Commit TX ID should be 64 hex chars");

  // Verify reveal transaction
  assertEqual(result.revealTx.inputs.length, 1, "Reveal should have 1 input");
  assertEqual(result.revealTx.outputs.length, 1, "Reveal should have 1 output");
  assert(result.revealTx.inputs[0].signatureScript.length > 0, "Reveal should be signed");
  assertEqual(result.revealTxId.length, 64, "Reveal TX ID should be 64 hex chars");

  // Verify reveal references commit
  assertEqual(
    result.revealTx.inputs[0].previousOutpoint.transactionId,
    result.commitTxId,
    "Reveal should reference commit TX"
  );

  // Verify inscription
  assertEqual(result.inscription.p, "krc-20", "Inscription protocol");
  assertEqual(result.inscription.op, "transfer", "Inscription operation");
  assertEqual(result.inscription.tick, "TEST", "Inscription ticker");
  assertEqual(result.inscription.amt, "1000", "Inscription amount");

  // Verify broadcast data format
  assert("transaction" in result.commitBroadcastData, "Commit broadcast data should have transaction");
  assert("transaction" in result.revealBroadcastData, "Reveal broadcast data should have transaction");

  console.log(`  Commit TX ID: ${result.commitTxId}`);
  console.log(`  Reveal TX ID: ${result.revealTxId}`);
  console.log("✓ End-to-end KRC-20 transfer tests passed");
}

async function testCostEstimation(): Promise<void> {
  console.log("Testing cost estimation...");

  // Default estimation (1 input)
  const cost1 = estimateKRC20TransferCost(1);
  // Cost = commit fee (base + 1*input + 2*output) + commit output amount
  // Default: 1000 + 1000 + 2000 + 30000 = 34000
  assertEqual(cost1, 34000n, "Default cost estimation for 1 input");

  // Multiple inputs
  const cost2 = estimateKRC20TransferCost(3);
  // 1000 + 3000 + 2000 + 30000 = 36000
  assertEqual(cost2, 36000n, "Cost estimation for 3 inputs");

  // Custom options
  const cost3 = estimateKRC20TransferCost(1, {
    commitOutputAmount: 50000n,
    baseFee: 500n,
    feePerInput: 500n,
    feePerOutput: 500n,
  });
  // 500 + 500 + 1000 + 50000 = 52000
  assertEqual(cost3, 52000n, "Custom cost estimation");

  console.log("✓ Cost estimation tests passed");
}

async function testTransactionIdDeterminism(): Promise<void> {
  console.log("Testing transaction ID determinism...");

  // Use fixed seed for reproducibility
  const testMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const { seed } = mnemonicToSeed(testMnemonic);
  const account = deriveAccountFromSeed(seed, true);

  const utxos: KaspaUTXO[] = [
    {
      transactionId: "f".repeat(64),
      index: 0,
      amountSompi: 100000n,
      scriptPublicKey: addressToScriptPublicKey(account.address).script,
    },
  ];

  // Create transfer twice with same inputs
  const result1 = createKRC20Transfer(
    utxos,
    account.privateKey,
    account.publicKey,
    "SAME",
    100n,
    account.address,
    account.address
  );

  const result2 = createKRC20Transfer(
    utxos,
    account.privateKey,
    account.publicKey,
    "SAME",
    100n,
    account.address,
    account.address
  );

  // Transaction IDs should be the same (deterministic signing in Schnorr)
  // Note: Schnorr signing in @noble/curves is deterministic (RFC 6979)
  assertEqual(result1.commitTxId, result2.commitTxId, "Commit TX IDs should be deterministic");
  assertEqual(result1.revealTxId, result2.revealTxId, "Reveal TX IDs should be deterministic");

  console.log("✓ Transaction ID determinism tests passed");
}

// ============================================================================
// Run All Tests
// ============================================================================

export async function runAllTests(): Promise<void> {
  console.log("=".repeat(60));
  console.log("KRC-20 Transaction Tests");
  console.log("=".repeat(60));
  console.log("");

  try {
    await testInscriptionCreation();
    await testRedeemScriptCreation();
    await testP2SHScriptCreation();
    await testCommitTransactionBuilding();
    await testCommitTransactionSigning();
    await testRevealTransactionBuilding();
    await testRevealTransactionSigning();
    await testEndToEndKRC20Transfer();
    await testCostEstimation();
    await testTransactionIdDeterminism();

    console.log("");
    console.log("=".repeat(60));
    console.log("All KRC-20 tests passed! ✓");
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
