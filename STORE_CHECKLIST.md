# Chrome Web Store Submission Checklist

## Before Submission

### Permissions Review
- [x] Minimal permissions (storage, idle only)
- [x] Host permissions limited to api.kaspa.org
- [x] Optional permissions for custom RPC URLs
- [x] No tabs, scripting, or notification permissions (removed)

### Privacy & Security
- [x] No analytics or telemetry
- [x] No external logging services
- [x] All crypto operations use audited libraries (@noble, @scure)
- [x] Private keys never leave the device
- [x] Encryption uses Argon2id + AES-256-GCM
- [x] Memory wiping for sensitive data
- [x] Auto-lock functionality

### User Consent
- [x] dApp connections require explicit approval (no auto-connect)
- [x] Transaction signing requires user confirmation
- [x] Clear privacy disclosure in Settings
- [x] Warning banners on seed phrase screens

### Content Requirements
- [x] Clear description (non-custodial, you control keys)
- [x] Accurate feature claims
- [x] No misleading promises

### Store Listing Assets Needed
- [ ] Icon 128x128 (high quality)
- [ ] Screenshots (1280x800 or 640x400)
- [ ] Promotional tile (440x280)
- [ ] Description (short and detailed)

## Description Template

### Short Description (132 chars max)
```
A non-custodial Kaspa (KAS) wallet. You control your keys. No tracking, no custody, no compromise.
```

### Detailed Description
```
NoXu Wallet is a secure, non-custodial browser wallet for the Kaspa blockchain.

KEY FEATURES:
• Full control of your private keys
• Encrypted locally on your device
• No accounts, no tracking, no custody
• Send and receive KAS
• View transaction history
• Connect to Kaspa dApps (with explicit approval)

SECURITY:
• Your seed phrase and private keys never leave your device
• Strong encryption (Argon2id + AES-256-GCM)
• Auto-lock on idle
• Memory wiping of sensitive data
• Open source

PRIVACY:
• Zero analytics or tracking
• No data collection
• Only connects to Kaspa RPC for blockchain operations

IMPORTANT:
• We cannot recover your wallet if you lose your seed phrase
• Never share your seed phrase with anyone
• NoXu support will never ask for your seed phrase

This is open source software provided as-is. You are responsible for your own backup and security.
```

## After Submission

### Monitoring
- [ ] Set up alerts for reviews
- [ ] Monitor for copycat extensions
- [ ] Document extension ID for verification page

### Post-Launch
- [ ] Update verification guide with real extension ID
- [ ] Publish recovery documentation
- [ ] Set up official support channel (GitHub issues)
