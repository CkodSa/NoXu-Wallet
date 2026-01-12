// Disaster Recovery Documentation for NoXu Wallet
// This content should be shown to users and on the website

export const RECOVERY_GUIDE = {
  lastUpdated: "January 2026",
  version: "1.0",
  content: `
WALLET RECOVERY GUIDE

NoXu Wallet is NON-CUSTODIAL. This means you are responsible for your own backup.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT WE CAN RECOVER: Nothing.

WHAT WE HAVE ACCESS TO: Nothing.

WHAT ONLY YOU HAVE: Your 12 or 24 word seed phrase.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCENARIO 1: Lost Device / Browser Profile Deleted

What happened: Your computer crashed, you uninstalled Chrome, or browser data was cleared.

Can you recover? YES, if you have your seed phrase.

How to recover:
1. Install NoXu Wallet on a new browser/device
2. Click "Import existing wallet"
3. Enter your 12 or 24 word seed phrase
4. Set a new password
5. Your wallet is restored with full access to your funds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCENARIO 2: Forgot Password

What happened: You forgot your local encryption password.

Can you recover? YES, if you have your seed phrase.

How to recover:
1. Uninstall and reinstall NoXu Wallet (this clears local data)
2. Click "Import existing wallet"
3. Enter your seed phrase
4. Set a NEW password
5. Your wallet is restored

Note: The password only encrypts local data. Your seed phrase IS your wallet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCENARIO 3: Lost Seed Phrase

What happened: You lost or never backed up your seed phrase.

Can you recover? NO.

There is no recovery possible. Your funds are permanently inaccessible.

NoXu cannot help you. No one can help you. This is how non-custodial wallets work.

Prevention:
- ALWAYS write down your seed phrase on paper
- Store it in a secure, offline location
- Consider using a metal backup for fire/water resistance
- NEVER store seed phrases digitally (no photos, no cloud, no notes apps)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCENARIO 4: Seed Phrase Compromised

What happened: Someone else saw or obtained your seed phrase.

What to do IMMEDIATELY:
1. Create a new wallet with a new seed phrase
2. Transfer ALL funds to the new wallet address
3. Abandon the old wallet permanently
4. The person with your seed phrase has full access to the old wallet

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCENARIO 5: Wrong Network (Testnet vs Mainnet)

What happened: Your funds show on one network but not the other.

Solution:
1. Go to Settings or Options
2. Switch between Mainnet and Testnet
3. Your seed phrase works on BOTH networks
4. Check that you're looking at the correct network

Note: Mainnet KAS has real value. Testnet KAS is for testing only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VERIFYING YOUR INSTALLATION

To ensure you have the real NoXu Wallet:
1. Only install from the official Chrome Web Store listing
2. Check the extension ID matches our published ID
3. Verify at our official website
4. Never install from direct download links or email attachments

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT REMINDERS

- NoXu support will NEVER ask for your seed phrase
- NoXu support will NEVER ask for your password
- NoXu support will NEVER ask you to "verify" your wallet
- If anyone asks for your seed phrase, they are trying to steal your funds
- Report scams to our official channels
`.trim(),
};

export default RECOVERY_GUIDE;
