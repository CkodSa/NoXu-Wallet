# NoXu Wallet — Project Sale

## What It Is

A production-ready, non-custodial crypto wallet for the **Kaspa blockchain**. Browser extension (Chrome + Firefox) and mobile app (iOS + Android) built from a single TypeScript monorepo.

Users can send/receive KAS and KRC-20 tokens, view balances in 8 fiat currencies, track PnL, and manage their portfolio — all with military-grade encryption and zero tracking.

## What the Buyer Gets

- Full source code (TypeScript monorepo, MIT licensed)
- Browser extension — Chrome + Firefox builds, ready for store submission
- Mobile app — iOS + Android via Expo/React Native, ready for App Store / Play Store
- Shared core library (`@noxu/core`) — framework-agnostic, can be reused in other products
- Documentation — setup guide, architecture notes, security audit
- Domain (if included in listing)
- All git history

## Tech Stack

| | |
|---|---|
| **Frontend** | React 18, TypeScript 5.4, Zustand, Vite 7.2 |
| **Mobile** | React Native 0.83, Expo 55 |
| **Crypto** | @noble/curves, @scure/bip32, @scure/bip39 (all audited) |
| **Encryption** | Argon2id (64MB) + AES-256-GCM |
| **Platforms** | Chrome MV3, Firefox MV3, iOS, Android |

## Key Features

**Wallet:** Create/import wallets (BIP39 12/24 words), send & receive KAS, KRC-20 token transfers (Schnorr signatures), multi-currency fiat display (8 currencies), address book, QR codes, CSV export, network switching (mainnet/testnet), custom RPC

**Security:** Argon2id + AES-256-GCM encryption, automatic memory wiping, duress mode (decoy wallet with fake balance), time-delayed transactions, auto-lock, dApp approval system, phishing protection, zero analytics

**Portfolio:** PnL tracking (FIFO cost-basis), watch-only addresses, popular & trending tokens (CoinGecko), hide small balances

**Hardware:** Ledger integration scaffolded (USB/HID transport ready)

## Architecture

Clean monorepo with three packages:

- `packages/core` — All business logic, crypto, API clients. No framework dependencies. Reusable.
- `packages/extension` — Browser extension UI + service worker + content script + dApp bridge
- `packages/mobile` — React Native app with native crypto and biometric auth

The core is fully decoupled from the UI layer via platform abstraction interfaces. A new platform (desktop app, CLI, etc.) could be added by implementing the platform provider.

## What's NOT Included

- No published Chrome Web Store or App Store listing (buyer handles submission)
- No backend or server — fully client-side, connects to public Kaspa APIs
- No user accounts or auth system — non-custodial, keys stay on device
- Ledger integration is scaffolded but not fully implemented

## Why It's Worth Buying

1. **Production-quality crypto code** — audited libraries, proper encryption, memory safety. This is not a tutorial project.
2. **Cross-platform from one codebase** — the shared core means extension and mobile stay in sync with zero duplication.
3. **Kaspa is growing** — BlockDAG architecture, 1 block/second, active developer ecosystem. Early mover advantage in wallet tooling.
4. **Extensible** — clean architecture makes it straightforward to add new chains, token standards, or platforms.
5. **Documented and handoff-ready** — README, setup guide, architecture docs, security audit, full git history.

## Contact

[Your email / listing URL here]
