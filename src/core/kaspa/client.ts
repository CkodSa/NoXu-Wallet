import { type NetworkConfig } from "../networks";
import { sha256 } from "@noble/hashes/sha256";
import { base64 } from "@scure/base";
import type { DerivedAccount } from "../crypto/mnemonic";
import { z } from "zod";

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

export class KaspaClient {
  constructor(private readonly network: NetworkConfig) {}

  /** Make a REST API call with retry logic */
  private async restCall<T>(endpoint: string, schema: z.ZodType<T>): Promise<T> {
    let attempt = 0;
    const baseUrl = this.network.rpcUrl.replace(/\/$/, ""); // Remove trailing slash

    while (attempt <= RETRIES) {
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          throw new Error(`REST HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        // Validate response against schema
        const parsed = schema.safeParse(data);
        if (!parsed.success) {
          throw new Error(`Invalid API response: ${parsed.error.message}`);
        }
        return parsed.data;
      } catch (err) {
        if (attempt === RETRIES) throw err;
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS * (attempt + 1)));
        attempt += 1;
      }
    }
    throw new Error("REST call failed");
  }

  /** POST request for submitting transactions */
  private async restPost<T>(endpoint: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
    let attempt = 0;
    const baseUrl = this.network.rpcUrl.replace(/\/$/, "");

    while (attempt <= RETRIES) {
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errorText = await res.text().catch(() => res.statusText);
          throw new Error(`REST HTTP ${res.status}: ${errorText}`);
        }
        const data = await res.json();
        // Validate response against schema
        const parsed = schema.safeParse(data);
        if (!parsed.success) {
          throw new Error(`Invalid API response: ${parsed.error.message}`);
        }
        return parsed.data;
      } catch (err) {
        if (attempt === RETRIES) throw err;
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_MS * (attempt + 1)));
        attempt += 1;
      }
    }
    throw new Error("REST POST failed");
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
    const res = await this.restCall(
      `/addresses/${address}/full-transactions?limit=${limit}`,
      TransactionsResponseSchema
    );

    return (res || []).map((tx) => {
      // Determine if this is incoming or outgoing based on inputs
      const isOutgoing = tx.inputs.some((inp) => inp.previous_outpoint_address === address);

      // For outgoing: find the output that goes to someone else (recipient)
      // For incoming: find the output that comes to us
      const relevantOutput = tx.outputs.find((out) =>
        isOutgoing ? out.script_public_key_address !== address : out.script_public_key_address === address
      );

      // Calculate amount - for outgoing, sum all outputs not going back to self
      // For incoming, sum outputs coming to us
      let amount = 0;
      if (isOutgoing) {
        // Sum of all outputs not going back to the sender (excluding change)
        amount = tx.outputs
          .filter((out) => out.script_public_key_address !== address)
          .reduce((sum, out) => sum + out.amount, 0);
      } else {
        // Sum of all outputs coming to the address
        amount = tx.outputs
          .filter((out) => out.script_public_key_address === address)
          .reduce((sum, out) => sum + out.amount, 0);
      }

      // Get the counterparty address
      const counterparty = isOutgoing
        ? relevantOutput?.script_public_key_address || tx.outputs[0]?.script_public_key_address || ""
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

  // Basic single-output builder: selects biggest UTXOs until amount+fee is covered.
  // Note: Transaction signing and broadcasting requires proper Kaspa transaction format.
  // The REST API at api.kaspa.org does not support transaction submission.
  // This is a placeholder - real implementation requires kaspa-wasm or similar library.
  async buildSignBroadcast(account: DerivedAccount, to: string, amountSompi: bigint): Promise<string> {
    const utxos = await this.getUTXOs(account.address);
    if (!utxos.length) throw new Error("No funds");
    const fee = BigInt(1000); // Conservative flat fee; replace with dynamic calculator later.
    const needed = amountSompi + fee;
    let total = 0n;
    const inputs: KaspaUTXO[] = [];
    for (const utxo of utxos) {
      inputs.push(utxo);
      total += utxo.amountSompi;
      if (total >= needed) break;
    }
    if (total < needed) throw new Error("Insufficient funds");

    const change = total - needed;
    const tx = {
      version: 0,
      inputs: inputs.map((u) => ({
        previousOutpoint: { transactionId: u.transactionId, index: u.index },
        signatureScript: "", // Placeholder; signing happens below.
        sequence: 0xffffffff,
      })),
      outputs: [
        { amount: amountSompi.toString(), scriptPublicKey: to },
        ...(change > 0n ? [{ amount: change.toString(), scriptPublicKey: account.address }] : []),
      ],
      lockTime: 0,
    };

    const rawForSigning = sha256(new TextEncoder().encode(JSON.stringify(tx)));
    // Phantom-style: signing stays in background; UI never sees privateKey.
    const signature = await crypto.subtle.sign(
      { name: "HMAC", hash: "SHA-256" },
      await crypto.subtle.importKey("raw", account.privateKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
      rawForSigning
    );
    const signedTx = { ...tx, signature: base64.encode(new Uint8Array(signature)) };

    // POST to /transactions endpoint (if available)
    // Note: The public api.kaspa.org may not support transaction submission
    const broadcastRes = await this.restPost(
      "/transactions",
      signedTx,
      BroadcastResponseSchema
    );
    return broadcastRes.transactionId;
  }
}
