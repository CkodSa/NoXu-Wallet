## Kaspa wallet assumptions

- Derivation path follows SLIP-44 coin type 972: `m/44'/972'/0'/0/0`, aligned with the Kaspa CLI wallet guidance.
- Addresses encode the pubkey hash using Kaspa-specific bech32 encoding with prefix `kaspa` for mainnet and `kaspatest` for testnet.
- Default network is Kaspa mainnet. RPC base URL is `https://api.kaspa.org`.
- Smallest unit is sompi (1e-8 KAS). UI converts user input KAS to sompi for signing.
- Fee handling uses a flat fee (1000 sompi) until hooked to a dynamic estimator.
- Password-based encryption uses Argon2id + AES-256-GCM. Passwords are never stored; only the encrypted seed is persisted.
- Memory wiping is implemented for sensitive data (seeds, private keys) after use.
- Provider API mirrors Phantom: `window.kaspa.connect()`, `disconnect()`, `publicKey`, `signTransaction`, `signAndSendTransaction`, and event emitters.
- dApp connections require explicit user approval before access is granted.
