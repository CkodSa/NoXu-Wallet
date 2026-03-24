// provider.js
// Runs in the page context. MUST NOT use chrome.* APIs.

(function () {
  if (typeof window === 'undefined') return;

  class KaspaProvider {
    constructor() {
      this.publicKey = null;
      this.isConnected = false;
      this.listeners = {};
      this._reqId = 0;
      this._pending = new Map();

      window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.source !== 'kaspa:content') return;

        if (msg.type === 'KASPA_PROVIDER_RESPONSE') {
          const { id, response, error } = msg;
          const pending = this._pending.get(id);
          if (!pending) return;
          this._pending.delete(id);
          if (error) pending.reject(new Error(error));
          else pending.resolve(response);
          return;
        }

        if (msg.type === 'KASPA_PROVIDER_PUSH') {
          const payload = msg.payload;
          if (payload && payload.type === 'PROVIDER_UPDATE' && payload.account) {
            this.publicKey = payload.account.address || null;
            this.isConnected = !!this.publicKey;
            this.emit('connect', this.publicKey);
          }
        }
      });
    }

    _sendToExtension(payload) {
      this._reqId = (this._reqId + 1) % Number.MAX_SAFE_INTEGER;
      const id = this._reqId;
      return new Promise((resolve, reject) => {
        this._pending.set(id, { resolve, reject });

        window.postMessage(
          {
            source: 'kaspa:page',
            type: 'KASPA_PROVIDER_REQUEST',
            id,
            payload,
          },
          '*'
        );

        setTimeout(() => {
          if (this._pending.has(id)) {
            this._pending.delete(id);
            reject(new Error('Kaspa provider: request timed out'));
          }
        }, 60000);
      });
    }

    async connect() {
      const res = await this._sendToExtension({ type: 'CONNECT_REQUEST' });
      if (res?.ok && res.approved) {
        this.publicKey = res.account?.address || null;
        this.isConnected = !!this.publicKey;
        this.emit('connect', this.publicKey);
        return res.account;
      }
      throw new Error(res?.error || 'Connect rejected');
    }

    async disconnect() {
      await this._sendToExtension({ type: 'DISCONNECT_REQUEST' });
      this.publicKey = null;
      this.isConnected = false;
      this.emit('disconnect');
    }

    async signTransaction(tx) {
      const res = await this._sendToExtension({
        type: 'SIGN_TX',
        payload: { tx },
      });
      if (!res?.ok) throw new Error(res?.error || 'Sign failed');
      return res.signature;
    }

    async signAndSendTransaction(txPayload) {
      const res = await this._sendToExtension({
        type: 'SIGN_AND_SEND',
        payload: txPayload,
      });
      if (!res?.ok) throw new Error(res?.error || 'Send failed');
      return res.txid;
    }

    on(event, handler) {
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].push(handler);
    }

    off(event, handler) {
      const arr = this.listeners[event];
      if (!arr) return;
      const idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    }

    emit(event, ...args) {
      (this.listeners[event] || []).forEach((fn) => {
        try {
          fn(...args);
        } catch (err) {
          console.error('Kaspa provider listener error', err);
        }
      });
    }
  }

  if (!window.kaspa) {
    Object.defineProperty(window, 'kaspa', {
      value: new KaspaProvider(),
      writable: false,
      configurable: false,
      enumerable: false,
    });
  }
})();
