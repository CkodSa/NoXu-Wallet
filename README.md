# NoXu Wallet

A non-custodial Kaspa wallet browser extension. You control your keys.

## Features

- Non-custodial: Your keys never leave your device
- No tracking or analytics
- Secure encryption (Argon2id + AES-256-GCM)
- Memory wiping for sensitive data
- dApp connection support

## Project structure

- `src/core/` – UI-agnostic logic (crypto, wallet, RPC, network config)
- `src/extension/` – MV3 glue (service worker background, content script, injected provider, manifest)
- `src/ui/` – React popup and options pages
- `src/legal/` – Terms, privacy policy, and support documentation

## Development

```bash
npm install
npm run dev    # Vite dev server
npm run build  # Build extension into dist/
```

## Load in Chrome

1. `npm run build`
2. Open `chrome://extensions`, enable Developer mode
3. Click "Load unpacked" and select `dist/`

## Security

See `SECURITY_AUDIT.md` for the security review and implemented protections.

## License

MIT
# NoXu-Wallet
