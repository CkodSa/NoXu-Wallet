// Privacy Policy for NoXu Wallet
// Last updated: January 2026

export const PRIVACY_POLICY = {
  lastUpdated: "January 2026",
  version: "1.0",
  content: `
PRIVACY POLICY

Last Updated: January 2026

This Privacy Policy describes how NoXu Wallet ("Extension", "we", "us", or "our") handles information when you use our browser extension.

1. OUR COMMITMENT TO PRIVACY

NoXu Wallet is designed with privacy as a core principle. We are a NON-CUSTODIAL wallet, which means:
- We do NOT have access to your private keys
- We do NOT have access to your seed phrase
- We do NOT control your funds
- We CANNOT see your wallet password

2. INFORMATION WE DO NOT COLLECT

We do NOT collect, store, or transmit:
- Your seed phrase or recovery words
- Your private keys
- Your wallet password
- Your personal identification information
- Your transaction history (beyond what is publicly on the blockchain)
- Analytics or usage tracking data
- IP addresses through our services

3. DATA STORED LOCALLY

The following data is stored ONLY on your device in encrypted form:
- Your encrypted seed phrase (encrypted with your password)
- Your encrypted private keys (encrypted with your password)
- Your wallet preferences and settings
- Custom RPC URL configurations

This data:
- Never leaves your device
- Is encrypted using Argon2id and AES-256-GCM
- Is only accessible with your password
- Is deleted when you uninstall the Extension

4. BLOCKCHAIN INTERACTIONS

When you use NoXu Wallet:
- Transactions are broadcast to the Kaspa blockchain network
- Balance and transaction queries are sent to RPC providers
- Your wallet address is visible on the public blockchain

Note: Blockchain transactions are PUBLIC and PERMANENT. Anyone can view transactions associated with your address on the Kaspa blockchain.

5. THIRD-PARTY SERVICES

The Extension may communicate with:

a) Kaspa RPC Providers (e.g., api.kaspa.org)
   - To query balances and transaction history
   - To broadcast transactions
   - These providers may log IP addresses per their own policies

b) Custom RPC URLs (if configured by you)
   - Any custom RPC you configure is your choice
   - Review the privacy policy of any custom provider

We recommend using a VPN if you wish to enhance your network-level privacy.

6. DATA SECURITY

We implement security measures including:
- Argon2id key derivation (memory-hard, GPU-resistant)
- AES-256-GCM encryption for sensitive data
- Automatic memory wiping of sensitive data
- Auto-lock functionality
- No external data transmission of wallet data

7. DATA RETENTION

- Local data: Stored until you uninstall the Extension or clear browser data
- Blockchain data: Permanent and public on the Kaspa blockchain
- No server-side retention: We do not operate servers that store user data

8. YOUR RIGHTS

You have the right to:
- Export your seed phrase at any time
- Delete all local data by uninstalling the Extension
- Use custom RPC providers of your choice
- Opt out of any optional features

9. CHILDREN'S PRIVACY

NoXu Wallet is not intended for use by individuals under the age of 18. We do not knowingly collect information from children.

10. CHANGES TO THIS POLICY

We may update this Privacy Policy from time to time. We will notify users of any material changes through the Extension or official channels.

11. OPEN SOURCE

NoXu Wallet is open source. You can review our code to verify our privacy practices.

12. CONTACT

For privacy-related questions, please open an issue on our official GitHub repository or contact us through official channels.

BY USING NOXU WALLET, YOU ACKNOWLEDGE THAT YOU HAVE READ AND UNDERSTOOD THIS PRIVACY POLICY.
`.trim(),
};

export default PRIVACY_POLICY;
