# Setup Guide

## Prerequisites

- Node.js 18+
- npm 9+
- Chrome or Firefox (for extension development)
- Xcode (for iOS development)
- Android Studio (for Android development)

## Installation

```bash
git clone <repo-url>
cd NoXu-Wallet
npm install
```

This installs dependencies for all three packages (`core`, `extension`, `mobile`) via npm workspaces.

## Browser Extension

### Development

```bash
npm run dev
```

This starts the Vite dev server with hot reload for the extension UI. Note: the extension must still be loaded manually in the browser (see below). HMR works for UI changes but background/content script changes require a rebuild.

### Production Builds

```bash
npm run build:chrome        # Chrome -> dist/
npm run build:firefox       # Firefox -> dist/
npm run build:all           # Both -> dist-chrome/ and dist-firefox/
```

### Loading in Chrome

1. Navigate to `chrome://extensions`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `dist/` or `dist-chrome/` folder

### Loading in Firefox

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select the `manifest.json` inside `dist/` or `dist-firefox/`

For permanent Firefox installation, submit to [Firefox Add-ons](https://addons.mozilla.org/).

### Edge / Brave

Use the Chrome build. Load the same way as Chrome (`edge://extensions` or `brave://extensions`).

## Mobile App

### Setup

```bash
# Install Expo CLI globally (if needed)
npm install -g expo-cli

# Start the dev server
npm run dev:mobile
```

### iOS (requires macOS + Xcode)

```bash
cd packages/mobile
npx expo run:ios
```

### Android

```bash
cd packages/mobile
npx expo run:android
```

### Expo Go

For quick testing without native builds, scan the QR code from `npm run dev:mobile` with the Expo Go app. Note: some native modules (biometric auth, quick-crypto) require a development build for full functionality.

## Project Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Extension dev server (Vite HMR) |
| `npm run build` | Extension Chrome production build |
| `npm run build:chrome` | Extension Chrome build -> `dist/` |
| `npm run build:firefox` | Extension Firefox build -> `dist/` |
| `npm run build:all` | Both browsers -> `dist-chrome/` + `dist-firefox/` |
| `npm run dev:mobile` | Mobile Expo dev server |

## Environment Notes

- No `.env` file required. The app connects to public Kaspa APIs (`api.kaspa.org`), Kasplex indexer, and CoinGecko by default.
- Custom RPC endpoints can be configured in the wallet settings UI (HTTPS only).
- Source maps are disabled in production builds.

## Troubleshooting

**Extension not loading in Chrome?**
Make sure you selected the `dist/` folder (containing `manifest.json`), not the project root.

**Mobile build fails with native module errors?**
Run `npx expo prebuild --clean` to regenerate native projects, then rebuild.

**"Cannot find module @noxu/core"?**
Run `npm install` from the project root. The monorepo workspaces need to be linked.
