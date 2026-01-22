## Kaspa wallet assumptions

### Core Wallet
- Derivation path follows SLIP-44 coin type 972: `m/44'/972'/0'/0/0`, aligned with the Kaspa CLI wallet guidance.
- Addresses encode the pubkey hash using Kaspa-specific bech32 encoding with prefix `kaspa` for mainnet and `kaspatest` for testnet.
- Default network is Kaspa mainnet. RPC base URL is `https://api.kaspa.org`.
- Smallest unit is sompi (1e-8 KAS). UI converts user input KAS to sompi for signing.
- Fee handling uses a flat fee (1000 sompi) until hooked to a dynamic estimator.

### Encryption & Security
- Password-based encryption uses Argon2id + AES-256-GCM. Passwords are never stored; only the encrypted seed is persisted.
- Argon2id parameters: t=3 iterations, m=64MB memory, p=1 parallelism - chosen for browser environment balance of security and performance.
- Memory wiping is implemented for sensitive data (seeds, private keys) after use.
- Encryption versioning supports migration from legacy scrypt (v1) to Argon2id (v2) for backward compatibility.

### dApp Integration
- Provider API mirrors Phantom: `window.kaspa.connect()`, `disconnect()`, `publicKey`, `signTransaction`, `signAndSendTransaction`, and event emitters.
- dApp connections require explicit user approval before access is granted.
- Content script is bundled as IIFE (not ES modules) for Chrome content script compatibility.

### Advanced Security Features

#### Duress Mode (Decoy Wallet)
- A secondary "panic PIN" can be configured that opens a decoy wallet with a fake balance.
- When the duress PIN is entered instead of the real password, the wallet displays a configurable decoy balance.
- All transactions in duress mode are fake (no actual blockchain interaction).
- Protects against physical coercion - attackers see only the decoy wallet.

#### Watch-Only Portfolio Tracking
- Any Kaspa address can be added for monitoring without importing private keys.
- Watch-only addresses display real-time balances fetched from the Kaspa API.
- Full transaction history is available for watched addresses.
- Useful for tracking cold storage, whale wallets, or other addresses of interest.

#### Time-Delayed Transactions
- Transactions exceeding a configurable KAS threshold are automatically queued with a delay period.
- Default threshold: 1000 KAS, default delay: 24 hours.
- Queued transactions can be cancelled within the delay window.
- Transactions can be force-executed early if needed.
- Delayed transactions are not executed while in duress mode.
- Provides protection against theft, hacks, and impulsive decisions.

### Build System
- Vite builds the popup, options, and background as ES modules.
- Content script is built separately with IIFE format using lib mode to avoid ES module issues in content scripts.
- Firefox and Chrome have separate manifests (manifest.firefox.json, manifest.chrome.json) for MV3 compatibility differences.
