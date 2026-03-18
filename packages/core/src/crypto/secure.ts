// src/core/crypto/secure.ts
// Security utilities for sensitive data handling

/**
 * Securely wipe a Uint8Array by overwriting with zeros.
 * This helps prevent sensitive data from lingering in memory.
 * Note: JavaScript doesn't guarantee memory wiping due to GC,
 * but this is a best-effort approach.
 */
export function wipeBytes(data: Uint8Array): void {
  if (!data || data.length === 0) return;
  // Overwrite with zeros
  data.fill(0);
}

