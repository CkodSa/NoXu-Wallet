// src/core/kaspa/integration-test.ts
// Integration test for Kaspa transaction signing
// Can be used with testnet (manual node) or mainnet (tiny amounts)

import { mnemonicToSeed, deriveAccountFromSeed, createMnemonic } from "../crypto/mnemonic";
import { KaspaClient, type KaspaUTXO } from "./client";
import { NETWORKS, type KaspaNetwork } from "../networks";
import {
  createSignedTransaction,
  serializeForBroadcast,
  calculateTransactionId,
  addressToScriptPublicKey,
} from "./transaction";
import {
  createKRC20Transfer,
  estimateKRC20TransferCost,
} from "./krc20-transaction";

// ============================================================================
// Test Configuration
// ============================================================================

const TEST_CONFIG = {
  // Use testnet for free testing (requires manual RPC setup)
  // Use mainnet for real testing (costs tiny amount of KAS)
  network: "mainnet" as KaspaNetwork,

  // For mainnet testing, send this tiny amount (0.001 KAS = ~$0.0001)
  testAmountSompi: 100000n, // 0.001 KAS

  // Custom RPC URL (leave empty to use default)
  customRpcUrl: "",
};

// ============================================================================
// Test Utilities
// ============================================================================

function formatKAS(sompi: bigint): string {
  const kas = Number(sompi) / 1e8;
  return kas.toFixed(8) + " KAS";
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Integration Tests
// ============================================================================

/**
 * Generate a new test wallet and display the address
 */
export async function generateTestWallet(isTestnet: boolean = false): Promise<{
  mnemonic: string;
  address: string;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}> {
  console.log("\n📝 Generating new test wallet...\n");

  const { mnemonic, seed } = createMnemonic(128); // 12 words
  const account = deriveAccountFromSeed(seed, isTestnet);

  console.log("=".repeat(60));
  console.log("NEW TEST WALLET");
  console.log("=".repeat(60));
  console.log(`\nMnemonic (SAVE THIS!):\n${mnemonic}\n`);
  console.log(`Address: ${account.address}`);
  console.log(`Network: ${isTestnet ? "TESTNET" : "MAINNET"}`);
  console.log(`\nDerivation Path: ${account.derivationPath}`);
  console.log("=".repeat(60));

  if (isTestnet) {
    console.log("\n💰 Get testnet KAS from faucet:");
    console.log("   https://faucet-t11.kaspanet.io");
  } else {
    console.log("\n💰 Send a small amount of KAS to this address to test");
  }

  return {
    mnemonic,
    address: account.address,
    publicKey: account.publicKey,
    privateKey: account.privateKey,
  };
}

/**
 * Check balance and UTXOs for an address
 */
export async function checkBalance(address: string, network: KaspaNetwork = "mainnet"): Promise<{
  balance: bigint;
  utxos: KaspaUTXO[];
}> {
  const config = { ...NETWORKS[network] };
  if (TEST_CONFIG.customRpcUrl) {
    config.rpcUrl = TEST_CONFIG.customRpcUrl;
  }

  const client = new KaspaClient(config);

  console.log(`\n🔍 Checking balance for ${address.slice(0, 20)}...`);

  try {
    const balance = await client.getBalance(address);
    const utxos = await client.getUTXOs(address);

    console.log(`   Balance: ${formatKAS(BigInt(balance))}`);
    console.log(`   UTXOs: ${utxos.length}`);

    if (utxos.length > 0) {
      console.log("\n   UTXO Details:");
      for (const utxo of utxos.slice(0, 5)) {
        console.log(`   - ${utxo.transactionId.slice(0, 16)}...:${utxo.index} = ${formatKAS(utxo.amountSompi)}`);
      }
      if (utxos.length > 5) {
        console.log(`   ... and ${utxos.length - 5} more`);
      }
    }

    return { balance: BigInt(balance), utxos };
  } catch (error: any) {
    console.error(`   Error: ${error.message}`);
    return { balance: 0n, utxos: [] };
  }
}

/**
 * Build a transaction without broadcasting (dry run)
 */
export async function dryRunTransaction(
  mnemonic: string,
  toAddress: string,
  amountSompi: bigint,
  network: KaspaNetwork = "mainnet"
): Promise<{
  success: boolean;
  txId?: string;
  broadcastData?: object;
  error?: string;
}> {
  console.log("\n🔧 Building transaction (dry run)...\n");

  try {
    // Derive account
    const { seed } = mnemonicToSeed(mnemonic);
    const isTestnet = network === "testnet";
    const account = deriveAccountFromSeed(seed, isTestnet);

    console.log(`   From: ${account.address}`);
    console.log(`   To: ${toAddress}`);
    console.log(`   Amount: ${formatKAS(amountSompi)}`);

    // Get UTXOs
    const config = { ...NETWORKS[network] };
    const client = new KaspaClient(config);
    const utxos = await client.getUTXOs(account.address);

    if (utxos.length === 0) {
      return { success: false, error: "No UTXOs available - wallet has no funds" };
    }

    console.log(`   Available UTXOs: ${utxos.length}`);

    // Build and sign transaction
    const { signedTx, txId, broadcastData } = createSignedTransaction(
      utxos,
      toAddress,
      amountSompi,
      account.address,
      account.privateKey
    );

    console.log("\n✅ Transaction built successfully!");
    console.log(`   Transaction ID: ${txId}`);
    console.log(`   Inputs: ${signedTx.inputs.length}`);
    console.log(`   Outputs: ${signedTx.outputs.length}`);

    // Show output details
    for (let i = 0; i < signedTx.outputs.length; i++) {
      const out = signedTx.outputs[i];
      const label = i === 0 ? "Recipient" : "Change";
      console.log(`   Output ${i} (${label}): ${formatKAS(out.value)}`);
    }

    // Show the broadcast data structure
    console.log("\n📦 Broadcast data preview:");
    console.log(JSON.stringify(broadcastData, null, 2).slice(0, 500) + "...");

    return { success: true, txId, broadcastData };
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Actually broadcast a transaction (use with caution!)
 */
export async function broadcastTransaction(
  mnemonic: string,
  toAddress: string,
  amountSompi: bigint,
  network: KaspaNetwork = "mainnet"
): Promise<{
  success: boolean;
  txId?: string;
  explorerUrl?: string;
  error?: string;
}> {
  console.log("\n🚀 Broadcasting transaction...\n");

  try {
    // Derive account
    const { seed } = mnemonicToSeed(mnemonic);
    const isTestnet = network === "testnet";
    const account = deriveAccountFromSeed(seed, isTestnet);

    // Get config
    const config = { ...NETWORKS[network] };
    if (TEST_CONFIG.customRpcUrl) {
      config.rpcUrl = TEST_CONFIG.customRpcUrl;
    }

    const client = new KaspaClient(config);

    console.log(`   From: ${account.address}`);
    console.log(`   To: ${toAddress}`);
    console.log(`   Amount: ${formatKAS(amountSompi)}`);
    console.log(`   Network: ${network}`);

    // Execute the transaction
    const txId = await client.buildSignBroadcast(account, toAddress, amountSompi);

    const explorerUrl = config.explorerBaseUrl
      ? `${config.explorerBaseUrl}${txId}`
      : undefined;

    console.log("\n✅ Transaction broadcast successful!");
    console.log(`   Transaction ID: ${txId}`);
    if (explorerUrl) {
      console.log(`   Explorer: ${explorerUrl}`);
    }

    return { success: true, txId, explorerUrl };
  } catch (error: any) {
    console.error(`\n❌ Broadcast failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Test KRC-20 transfer building (dry run)
 */
export async function dryRunKRC20Transfer(
  mnemonic: string,
  toAddress: string,
  tick: string,
  amount: bigint,
  network: KaspaNetwork = "mainnet"
): Promise<{
  success: boolean;
  commitTxId?: string;
  revealTxId?: string;
  error?: string;
}> {
  console.log("\n🎨 Building KRC-20 transfer (dry run)...\n");

  try {
    // Derive account
    const { seed } = mnemonicToSeed(mnemonic);
    const isTestnet = network === "testnet";
    const account = deriveAccountFromSeed(seed, isTestnet);

    console.log(`   From: ${account.address}`);
    console.log(`   To: ${toAddress}`);
    console.log(`   Token: ${tick}`);
    console.log(`   Amount: ${amount.toString()}`);

    // Get UTXOs
    const config = { ...NETWORKS[network] };
    const client = new KaspaClient(config);
    const utxos = await client.getUTXOs(account.address);

    if (utxos.length === 0) {
      return { success: false, error: "No UTXOs available - wallet has no KAS for fees" };
    }

    // Estimate cost
    const cost = estimateKRC20TransferCost(1);
    console.log(`   Estimated cost: ${formatKAS(cost)}`);

    // Build transfer
    const transfer = createKRC20Transfer(
      utxos,
      account.privateKey,
      account.publicKey,
      tick,
      amount,
      toAddress,
      account.address
    );

    console.log("\n✅ KRC-20 transfer built successfully!");
    console.log(`   Commit TX ID: ${transfer.commitTxId}`);
    console.log(`   Reveal TX ID: ${transfer.revealTxId}`);
    console.log(`\n   Inscription: ${JSON.stringify(transfer.inscription)}`);

    return {
      success: true,
      commitTxId: transfer.commitTxId,
      revealTxId: transfer.revealTxId,
    };
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// CLI Runner
// ============================================================================

async function runInteractiveTest(): Promise<void> {
  console.log("=".repeat(60));
  console.log("KASPA TRANSACTION INTEGRATION TEST");
  console.log("=".repeat(60));

  const args = process.argv.slice(2);
  const command = args[0] || "help";

  switch (command) {
    case "generate":
    case "gen": {
      const isTestnet = args.includes("--testnet") || args.includes("-t");
      await generateTestWallet(isTestnet);
      break;
    }

    case "balance":
    case "bal": {
      const address = args[1];
      if (!address) {
        console.error("Usage: balance <address> [--testnet]");
        break;
      }
      const network: KaspaNetwork = args.includes("--testnet") ? "testnet" : "mainnet";
      await checkBalance(address, network);
      break;
    }

    case "dry-run":
    case "dry": {
      const mnemonic = args[1];
      const toAddress = args[2];
      const amount = args[3];
      if (!mnemonic || !toAddress || !amount) {
        console.error('Usage: dry-run "<mnemonic>" <to-address> <amount-sompi>');
        break;
      }
      const network: KaspaNetwork = args.includes("--testnet") ? "testnet" : "mainnet";
      await dryRunTransaction(mnemonic, toAddress, BigInt(amount), network);
      break;
    }

    case "send": {
      const mnemonic = args[1];
      const toAddress = args[2];
      const amount = args[3];
      if (!mnemonic || !toAddress || !amount) {
        console.error('Usage: send "<mnemonic>" <to-address> <amount-sompi>');
        console.error("\n⚠️  WARNING: This will broadcast a real transaction!");
        break;
      }
      const network: KaspaNetwork = args.includes("--testnet") ? "testnet" : "mainnet";

      console.log("\n⚠️  WARNING: This will broadcast a REAL transaction!");
      console.log(`   Network: ${network}`);
      console.log(`   Amount: ${formatKAS(BigInt(amount))}`);
      console.log("\n   Proceeding in 3 seconds... (Ctrl+C to cancel)");

      await sleep(3000);
      await broadcastTransaction(mnemonic, toAddress, BigInt(amount), network);
      break;
    }

    case "krc20-dry": {
      const mnemonic = args[1];
      const toAddress = args[2];
      const tick = args[3];
      const amount = args[4];
      if (!mnemonic || !toAddress || !tick || !amount) {
        console.error('Usage: krc20-dry "<mnemonic>" <to-address> <tick> <amount>');
        break;
      }
      const network: KaspaNetwork = args.includes("--testnet") ? "testnet" : "mainnet";
      await dryRunKRC20Transfer(mnemonic, toAddress, tick, BigInt(amount), network);
      break;
    }

    default:
      console.log(`
Usage: npx tsx src/core/kaspa/integration-test.ts <command> [options]

Commands:
  generate [--testnet]     Generate a new test wallet
  balance <address>        Check balance and UTXOs
  dry-run "<mnemonic>" <to> <amount>    Build tx without broadcasting
  send "<mnemonic>" <to> <amount>       Broadcast transaction (REAL!)
  krc20-dry "<mnemonic>" <to> <tick> <amount>  Build KRC-20 transfer

Options:
  --testnet, -t           Use testnet instead of mainnet

Examples:
  # Generate testnet wallet
  npx tsx integration-test.ts generate --testnet

  # Check balance
  npx tsx integration-test.ts balance kaspa:qp...

  # Dry run (build but don't send)
  npx tsx integration-test.ts dry-run "word1 word2..." kaspa:qp... 100000

  # Send for real (0.001 KAS)
  npx tsx integration-test.ts send "word1 word2..." kaspa:qp... 100000
`);
  }
}

// Run if executed directly
if (typeof window === "undefined" && typeof process !== "undefined") {
  runInteractiveTest().catch(console.error);
}

export {
  TEST_CONFIG,
  formatKAS,
};
