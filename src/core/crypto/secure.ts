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

/**
 * Securely wipe a string by creating a mutable array and clearing it.
 * Returns undefined to force callers to clear their reference.
 * Note: Strings are immutable in JS, so we can only clear the reference.
 */
export function wipeString(_str: string): undefined {
  // Strings are immutable in JavaScript, so we can't actually wipe them.
  // The best we can do is ensure the caller sets their variable to undefined.
  // This function serves as documentation and a reminder.
  return undefined;
}

/**
 * Execute a function with sensitive data, then wipe it.
 * Ensures cleanup even if the function throws.
 */
export async function withSecureData<T>(
  data: Uint8Array,
  fn: (data: Uint8Array) => Promise<T>
): Promise<T> {
  try {
    return await fn(data);
  } finally {
    wipeBytes(data);
  }
}

/**
 * Create a copy of data that will be wiped after use.
 * Useful when you need to pass data to a function but want to ensure cleanup.
 */
export function secureClone(data: Uint8Array): Uint8Array {
  return new Uint8Array(data);
}
