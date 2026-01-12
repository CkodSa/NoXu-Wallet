// Verification Guide - How to Verify the Real NoXu Wallet
// Use this content on website and in documentation

export const VERIFICATION_GUIDE = {
  lastUpdated: "January 2026",
  version: "1.0",

  // UPDATE THESE WHEN YOU PUBLISH
  officialSources: {
    chromeExtensionId: "YOUR_EXTENSION_ID_HERE", // Update after Chrome Web Store publish
    firefoxAddonId: "YOUR_ADDON_ID_HERE", // Update after Firefox publish (if applicable)
    officialWebsite: "https://noxuwallet.com", // Update with your real domain
    officialGitHub: "https://github.com/YOUR_ORG/noxu-wallet", // Update with real repo
    officialTwitter: "@NoxuWallet", // Update with real handle
  },

  content: `
HOW TO VERIFY YOU HAVE THE REAL NOXU WALLET

Scammers create fake wallet extensions to steal your funds. Always verify.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1: Check the Extension ID

In Chrome:
1. Go to chrome://extensions
2. Enable "Developer mode" (top right)
3. Find NoXu Wallet
4. The ID should be: [OFFICIAL_ID]

If the ID is different, you have a FAKE extension. Remove it immediately.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 2: Only Install from Official Sources

SAFE:
✅ Chrome Web Store (search "NoXu Wallet")
✅ Our official website link to the store
✅ Firefox Add-ons (if available)

DANGEROUS - NEVER USE:
❌ Direct download links
❌ Links from Discord DMs
❌ Links from Telegram messages
❌ Links from emails
❌ Links from social media posts
❌ "Updated" versions from random websites

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 3: Verify Website URLs

Official websites:
• noxuwallet.com (or your actual domain)
• github.com/[your-org]/noxu-wallet

Check the URL carefully:
• noxuwallet.com ✅
• n0xuwallet.com ❌ (zero instead of 'o')
• noxuwallet.net ❌ (wrong domain)
• noxu-wallet.com ❌ (hyphen)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RED FLAGS - SIGNS OF A SCAM

🚨 Anyone asking for your seed phrase
🚨 "Support" reaching out to you first
🚨 Requests to "verify" or "validate" your wallet
🚨 Promises of airdrops requiring wallet connection
🚨 Urgency ("do this now or lose funds")
🚨 Websites with typos or poor grammar
🚨 Extensions not from official store listings
🚨 Requests to install "updated" versions from links

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT TO DO IF YOU INSTALLED A FAKE

1. DO NOT enter your seed phrase
2. If you already entered it:
   a. Immediately create a new wallet (real one)
   b. Transfer ALL funds to the new address
   c. The old wallet is compromised forever
3. Remove the fake extension
4. Report it to the Chrome Web Store

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REPORT SCAMS

Help protect others by reporting fake extensions and scam websites.

• Chrome Web Store: Use "Report abuse" on the extension page
• GitHub: Open an issue on our official repository
• Twitter: Report to @NoxuWallet

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REMEMBER

NoXu will NEVER:
• Ask for your seed phrase
• DM you first on social media
• Ask you to "verify" your wallet
• Send you links to install "updates"
• Ask for your password

Stay safe. When in doubt, don't connect.
`.trim(),
};

export default VERIFICATION_GUIDE;
