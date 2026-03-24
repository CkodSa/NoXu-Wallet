// Content script - bridges page <-> background for dApp provider

import browser from "webextension-polyfill";

// Inject the provider into the page (window.kaspa)
(function injectProvider() {
  try {
    const script = document.createElement("script");
    script.src = browser.runtime.getURL("provider.js");
    script.async = false;
    (document.documentElement || document.head || document.body).appendChild(script);
    script.remove();
  } catch (err) {
    console.warn("NoXu wallet: failed to inject provider", err);
  }
})();

// Only these message types may be relayed from dApp pages to the background.
// Internal-only types (UNLOCK, LOCK, EXPORT_SEED, etc.) are never forwarded.
const ALLOWED_DAPP_TYPES = new Set([
  "CONNECT",
  "GET_ACCOUNT",
  "SIGN_TX",
  "SIGN_MESSAGE",
  "GET_NETWORK",
]);

// Page -> Background relay
window.addEventListener("message", async (event) => {
  if (event.source !== window) return;

  const msg = event.data;
  if (!msg || msg.source !== "kaspa:page" || msg.type !== "KASPA_PROVIDER_REQUEST") {
    return;
  }

  const { id, payload } = msg;
  if (!payload || typeof payload.type !== "string") return;

  // Block internal message types from being sent by web pages
  if (!ALLOWED_DAPP_TYPES.has(payload.type)) {
    window.postMessage(
      {
        source: "kaspa:content",
        type: "KASPA_PROVIDER_RESPONSE",
        id,
        error: "Unauthorized request type",
      },
      "*"
    );
    return;
  }

  try {
    const response = await browser.runtime.sendMessage(payload);
    window.postMessage(
      {
        source: "kaspa:content",
        type: "KASPA_PROVIDER_RESPONSE",
        id,
        response,
      },
      "*"
    );
  } catch (err) {
    window.postMessage(
      {
        source: "kaspa:content",
        type: "KASPA_PROVIDER_RESPONSE",
        id,
        error: err instanceof Error ? err.message : String(err),
      },
      "*"
    );
  }
});

// Background -> Page relay
browser.runtime.onMessage.addListener((message) => {
  if (message && message.type === "PROVIDER_UPDATE") {
    window.postMessage(
      {
        source: "kaspa:content",
        type: "KASPA_PROVIDER_PUSH",
        payload: message,
      },
      "*"
    );
  }
});
