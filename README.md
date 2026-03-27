# NoXu Wallet

A non-custodial crypto wallet for the Kaspa blockchain. Browser extension (Chrome + Firefox) and mobile app (iOS + Android) from a single TypeScript monorepo.

<p align="center">
  <img src="packages/extension/src/ui/assets/NoxuLogoAnimation.gif" alt="NoXu Wallet" width="200" />
</p>

## What It Does

- **Send & receive KAS** with real-time balance updates and QR codes
- **KRC-20 token transfers** using Schnorr signatures (commit + reveal)
- **8 fiat currencies** — USD, EUR, GBP, JPY, CAD, AUD, CHF, KRW
- **Popular & trending tokens** — CoinGecko ecosystem data
- **PnL tracking** — FIFO cost-basis engine with historical price sync
- **Address book** with contact labels in transaction history
- **Watch-only mode** — monitor any address without importing keys
- **CSV export** of full transaction history

## Security

- **Argon2id + AES-256-GCM** encryption at rest (64MB memory-hard KDF)
- **Automatic memory wiping** of keys and seeds after use
- **Duress mode** — panic PIN opens decoy wallet with fake balance
- **Time-delayed transactions** — large transfers queued with cancellation window
- **Auto-lock** on idle (configurable, default 5 min)
- **dApp approval system** — per-site connection control
- **Phishing protection** — extension ID verification
- **Zero analytics** — no tracking, no telemetry

## Platforms

| Platform | Status |
|----------|--------|
| Chrome | Manifest V3 |
| Firefox | Manifest V3 |
| Edge / Brave | Compatible (Chrome build) |
| iOS | React Native (Expo) with Face ID |
| Android | React Native (Expo) with biometric auth |

## Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React 18, TypeScript 5.4 |
| Build | Vite 7.2 |
| State | Zustand 4.5 |
| Crypto | @noble/curves, @scure/bip32, @scure/bip39 |
| Mobile | Expo 55, React Native 0.83 |
| Validation | Zod 3.22 |
| Hardware | Ledger (scaffolded, USB/HID transport) |

## Project Structure

```
packages/
  core/       Shared business logic (wallet, crypto, Kaspa client, KRC-20, pricing)
  extension/  Browser extension (Chrome + Firefox, Vite build)
  mobile/     React Native mobile app (Expo)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full technical breakdown.

## Quick Start

```bash
npm install

# Extension
npm run build:chrome        # Build for Chrome -> dist/
npm run build:firefox       # Build for Firefox -> dist/
npm run build:all           # Both -> dist-chrome/ and dist-firefox/
npm run dev                 # Dev server with hot reload

# Mobile
npm run dev:mobile          # Start Expo dev server
```

See [docs/SETUP.md](docs/SETUP.md) for detailed setup instructions including loading in browsers, mobile device setup, and troubleshooting.

## Documentation

| Document | Description |
|----------|-------------|
| [SETUP.md](docs/SETUP.md) | Full setup guide for development and builds |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture and design decisions |
| [SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) | Security review and attack vector analysis |

## License

MIT License - see [LICENSE](LICENSE) for details.
