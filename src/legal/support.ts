// Support Expectations for NoXu Wallet
// Be clear about what support can and cannot do

export const SUPPORT_POLICY = {
  lastUpdated: "January 2026",
  version: "1.0",
  content: `
NOXU WALLET SUPPORT POLICY

NoXu Wallet is non-custodial software. Please understand what we can and cannot help with.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT WE CAN HELP WITH:

✅ Bug reports and technical issues
✅ UI/UX problems
✅ Extension not loading or crashing
✅ Network connectivity issues
✅ Feature requests and suggestions
✅ Documentation and guides
✅ Reporting scams and fake extensions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT WE CANNOT HELP WITH:

❌ Recovering lost seed phrases
❌ Recovering forgotten passwords (if seed is also lost)
❌ Reversing transactions
❌ Retrieving stolen funds
❌ Accessing your wallet on your behalf
❌ "Unsticking" pending transactions (network issue)
❌ Price or trading advice

We do not have access to your keys. We cannot perform any action on your wallet.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOW TO GET HELP:

1. GitHub Issues (preferred)
   - Open an issue on our official repository
   - Include: browser version, extension version, error messages
   - Do NOT include: seed phrases, passwords, private keys

2. Official Channels Only
   - Only use links from our verified website
   - Beware of impersonators on social media

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCAM WARNING:

Real NoXu support will NEVER:
• DM you first
• Ask for your seed phrase
• Ask for your password
• Ask you to "verify" or "validate" your wallet
• Send you links to connect your wallet
• Offer to "recover" your funds

If anyone claiming to be NoXu support does these things, they are scammers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSE TIMES:

NoXu is maintained by a small team. Response times vary:
• Critical bugs: We prioritize these
• General issues: Best effort basis
• Feature requests: Added to backlog

We appreciate your patience and understanding.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELF-SERVICE RESOURCES:

Before contacting support:
1. Check the FAQ on our website
2. Search existing GitHub issues
3. Try the troubleshooting steps in our documentation
4. Make sure you're using the latest version

Many issues can be resolved by:
• Clearing browser cache
• Reinstalling the extension
• Importing your wallet again (requires seed phrase)
`.trim(),
};

export default SUPPORT_POLICY;
