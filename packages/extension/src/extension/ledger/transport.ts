// Ledger transport lifecycle management (WebHID)
// WebHID only works in page contexts (popup), NOT in service workers.

import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import type Transport from "@ledgerhq/hw-transport";

let transport: Transport | null = null;

/**
 * Connect to a Ledger device via WebHID.
 * Must be called from a page context with a user gesture.
 */
export async function connectLedger(): Promise<Transport> {
  if (transport) {
    try {
      // Test if still alive
      await transport.send(0xe0, 0x04, 0x00, 0x00);
      return transport;
    } catch {
      transport = null;
    }
  }

  transport = await TransportWebHID.create();

  transport.on("disconnect", () => {
    transport = null;
  });

  return transport;
}

/**
 * Disconnect from the Ledger device.
 */
export async function disconnectLedger(): Promise<void> {
  if (transport) {
    await transport.close();
    transport = null;
  }
}

/**
 * Check if a Ledger device is currently connected.
 */
export function isLedgerConnected(): boolean {
  return transport !== null;
}

/**
 * Get the current transport (or null if not connected).
 */
export function getTransport(): Transport | null {
  return transport;
}
