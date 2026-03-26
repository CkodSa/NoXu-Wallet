import { type NetworkConfig } from "../networks";
import type { DerivedAccount } from "../crypto/mnemonic";
import { z } from "zod";
import {
  createSignedTransaction,
  createSignedTransactionWithSigner,
  selectUtxos,
  calculateFee,
  type TransactionBuilderOptions,
} from "./transaction";
import type { TransactionSigner } from "./signer";

export type KaspaUTXO = {
  transactionId: string;
  index: number;
  amountSompi: bigint; // Sompi == smallest unit (1e-8 KAS)
  scriptPublicKey: string;
};

export type KaspaTx = {
  txid: string;
  amountSompi: number; // Kept as number for JSON serialization across message passing
  to: string;
  from: string;
  time?: number;
  status?: string;
  isOutgoing?: boolean; // True if the queried address sent funds
};

// Zod schemas for API response validation
const BalanceResponseSchema = z.object({
  address: z.string(),
  balance: z.number(),
});

const UTXOResponseSchema = z.array(
  z.object({
    address: z.string(),
    outpoint: z.object({
      transactionId: z.string(),
      index: z.number(),
    }),
    utxoEntry: z.object({
      amount: z.string(),
      scriptPublicKey: z.object({
        scriptPublicKey: z.string(),
      }),
      blockDaaScore: z.string(),
    }),
  })
);

const TransactionsResponseSchema = z.array(
  z.object({
    transaction_id: z.string(),
    inputs: z.array(
      z.object({
        previous_outpoint_address: z.string().nullish(),
        previous_outpoint_amount: z.number().nullish(),
      })
    ),
    outputs: z.array(
      z.object({
        script_public_key_address: z.string(),
        amount: z.number(),
      })
    ),
    block_time: z.number(),
    is_accepted: z.boolean(),
  })
);

const BroadcastResponseSchema = z.object({
  transactionId: z.string(),
});

const RETRIES = 2;
const BACKOFF_MS = 400;
const FETCH_TIMEOUT_MS = 15_000; // 15s timeout for API calls

export class KaspaClient {
  constructor(private readonly network: NetworkConfig) {}

  /** Make a REST API call with retry logic */
  private async restCall<T>(endpoint: string, schema: z.ZodType<T>): Promise<T> {
    let attempt = 0;
    const baseUrl = this.network.rpcUrl.replace(/\/$/, ""); // Remove trailing slash

    while (attempt <= RETRIES) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(`${baseUrl}${endpoint}`, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          throw new Error("Unable to reach the Kaspa network. Please check your connection and try again.");
        }
        const data = await res.json();
        // Validate response against schema
        const parsed = schema.safeParse(data);
        if (!parsed.success) {
          throw new Error("Received an unexpected response from the network. Please try again.");
        }
        return parsed.data;
      } catch (err) {
        if (attempt === RETRIES) throw err;
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS * (attempt + 1)));
        attempt += 1;
      }
    }
    throw new Error("Could not connect to the Kaspa network after multiple attempts. Please try again later.");
  }

  /** POST request for submitting transactions */
  private async restPost<T>(endpoint: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    let attempt = 0;
    const baseUrl = this.network.rpcUrl.replace(/\/$/, "");

    while (attempt <= RETRIES) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const res = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          const errorText = await res.text().catch(() => res.statusText);
          throw new Error("Unable to submit your request to the Kaspa network. Please try again.");
        }
        const data = await res.json();
        // Validate response against schema
        const parsed = schema.safeParse(data);
        if (!parsed.success) {
          throw new Error("Received an unexpected response from the network. Please try again.");
        }
        return parsed.data;
      } catch (err) {
        if (attempt === RETRIES) throw err;
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS * (attempt + 1)));
        attempt += 1;
      }
    }
    throw new Error("Could not submit to the Kaspa network after multiple attempts. Please try again later.");
  }

  async getBalance(address: string): Promise<number> {
    // REST API: GET /addresses/{kaspaAddress}/balance
    const res = await this.restCall(
      `/addresses/${address}/balance`,
      BalanceResponseSchema
    );
    return res.balance;
  }

  async getUTXOs(address: string): Promise<KaspaUTXO[]> {
    // REST API: GET /addresses/{kaspaAddress}/utxos
    const res = await this.restCall(
      `/addresses/${address}/utxos`,
      UTXOResponseSchema
    );

    return (res || []).map((item) => ({
      transactionId: item.outpoint.transactionId,
      index: item.outpoint.index,
      amountSompi: BigInt(item.utxoEntry.amount),
      scriptPublicKey: item.utxoEntry.scriptPublicKey.scriptPublicKey,
    }));
  }

  async getTransactions(address: string, limit: number = 50): Promise<KaspaTx[]> {
    // REST API: GET /addresses/{kaspaAddress}/full-transactions
    // Limit to recent transactions to avoid timeouts on addresses with many txs
    // Use resolve_previous_outpoints=full to get input addresses and amounts
    const res = await this.restCall(
      `/addresses/${address}/full-transactions?limit=${limit}&resolve_previous_outpoints=full`,
      TransactionsResponseSchema
    );

    return (res || []).map((tx) => {
      // Calculate total input from this address (what we spent)
      const totalInputFromAddress = tx.inputs
        .filter((inp) => inp.previous_outpoint_address === address)
        .reduce((sum, inp) => sum + (inp.previous_outpoint_amount || 0), 0);

      // Calculate total output to this address (what we received, including change)
      const totalOutputToAddress = tx.outputs
        .filter((out) => out.script_public_key_address === address)
        .reduce((sum, out) => sum + out.amount, 0);

      // Determine if this is outgoing: we spent from this address
      const isOutgoing = totalInputFromAddress > 0;

      // Calculate net amount:
      // - For outgoing: how much left the address (input - output back to self)
      // - For incoming: how much came to the address
      let amount = 0;
      if (isOutgoing) {
        // Net outgoing = what we spent minus what came back as change
        amount = totalInputFromAddress - totalOutputToAddress;
      } else {
        // Pure incoming = outputs to our address
        amount = totalOutputToAddress;
      }

      // Get the counterparty address
      const counterparty = isOutgoing
        ? tx.outputs.find((out) => out.script_public_key_address !== address)?.script_public_key_address || ""
        : tx.inputs[0]?.previous_outpoint_address || "";

      return {
        txid: tx.transaction_id,
        amountSompi: amount,
        to: isOutgoing ? counterparty : address,
        from: isOutgoing ? address : counterparty,
        time: tx.block_time,
        status: tx.is_accepted ? "confirmed" : "pending",
        isOutgoing,
      };
    });
  }

  /**
   * Build, sign, and broadcast a Kaspa transaction with proper Schnorr signatures.
   *
   * @param account - The derived account with private key
   * @param to - Destination Kaspa address
   * @param amountSompi - Amount to send in sompi (1 KAS = 1e8 sompi)
   * @param options - Optional transaction builder options (fee settings)
   * @returns Transaction ID of the broadcasted transaction
   */
  async buildSignBroadcast(
    account: DerivedAccount,
    to: string,
    amountSompi: bigint,
    options?: TransactionBuilderOptions
  ): Promise<string> {
    // Fetch UTXOs for the account
    const utxos = await this.getUTXOs(account.address);
    if (!utxos.length) {
      throw new Error("No funds available");
    }

    // Build and sign the transaction with proper Schnorr signatures
    const { txId, broadcastData } = createSignedTransaction(
      utxos,
      to,
      amountSompi,
      account.address, // Change goes back to sender
      account.privateKey,
      options
    );

    // Broadcast the signed transaction
    const broadcastRes = await this.restPost(
      "/transactions",
      broadcastData,
      BroadcastResponseSchema
    );

    // Return the transaction ID (use server response if available, otherwise computed)
    return broadcastRes.transactionId || txId;
  }

  /**
   * Build, sign (async via TransactionSigner), and broadcast a transaction.
   * Used for hardware wallet signing where the signer is async.
   */
  async buildSignBroadcastWithSigner(
    signer: TransactionSigner,
    address: string,
    to: string,
    amountSompi: bigint,
    options?: TransactionBuilderOptions
  ): Promise<string> {
    const utxos = await this.getUTXOs(address);
    if (!utxos.length) {
      throw new Error("No funds available");
    }

    const { txId, broadcastData } = await createSignedTransactionWithSigner(
      utxos,
      to,
      amountSompi,
      address,
      signer,
      options
    );

    const broadcastRes = await this.restPost(
      "/transactions",
      broadcastData,
      BroadcastResponseSchema
    );

    return broadcastRes.transactionId || txId;
  }

  /**
   * Broadcast a pre-signed transaction.
   * Used when signing happens outside the client (e.g., Ledger in popup context).
   */
  async broadcastTransaction(broadcastData: object): Promise<string> {
    const broadcastRes = await this.restPost(
      "/transactions",
      broadcastData,
      BroadcastResponseSchema
    );
    return broadcastRes.transactionId;
  }

  /**
   * Estimate the fee for a transaction without signing it.
   *
   * @param address - The sender's address
   * @param amountSompi - Amount to send in sompi
   * @param options - Optional fee settings
   * @returns Estimated fee in sompi
   */
  async estimateFee(
    address: string,
    amountSompi: bigint,
    options?: TransactionBuilderOptions
  ): Promise<bigint> {
    const utxos = await this.getUTXOs(address);
    if (!utxos.length) {
      throw new Error("No funds available");
    }

    try {
      const { fee } = selectUtxos(utxos, amountSompi, options);
      return fee;
    } catch {
      // If we can't select enough UTXOs, estimate based on all UTXOs
      return calculateFee(utxos.length, 2, options);
    }
  }
}
