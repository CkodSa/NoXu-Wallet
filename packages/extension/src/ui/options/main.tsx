import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import browser from "webextension-polyfill";
import {
  DEFAULT_NETWORK,
  NETWORKS,
  type CustomRpcUrls,
  type KaspaNetwork,
} from "@noxu/core";

async function rpc(type: string, payload?: any) {
  return browser.runtime.sendMessage({ type, payload });
}

function Options() {
  const [network, setNetwork] = useState<KaspaNetwork>(DEFAULT_NETWORK);
  const [customRpcUrls, setCustomRpcUrls] = useState<CustomRpcUrls>({});
  const [testnetRpc, setTestnetRpc] = useState("");
  const [mainnetRpc, setMainnetRpc] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    rpc("GET_CUSTOM_RPC").then((res: any) => {
      if (res?.ok && res.customRpcUrls) {
        setCustomRpcUrls(res.customRpcUrls);
        setTestnetRpc(res.customRpcUrls.testnet || "");
        setMainnetRpc(res.customRpcUrls.mainnet || "");
      }
    });
    rpc("GET_STATE").then((res: any) => {
      if (res?.ok && res.network) {
        setNetwork(res.network);
      }
    });
  }, []);

  const handleNetworkChange = (newNet: KaspaNetwork) => {
    setNetwork(newNet);
    rpc("SWITCH_NETWORK", { network: newNet });
  };

  const handleSaveRpc = async (networkName: KaspaNetwork, rpcUrl: string) => {
    setSaving(true);
    const trimmed = rpcUrl.trim();
    const res: any = await rpc("SET_CUSTOM_RPC", {
      network: networkName,
      rpcUrl: trimmed || null,
    });
    if (res?.ok) {
      setCustomRpcUrls(res.customRpcUrls || {});
    }
    setSaving(false);
  };

  const handleResetRpc = async (networkName: KaspaNetwork) => {
    setSaving(true);
    const res: any = await rpc("SET_CUSTOM_RPC", { network: networkName, rpcUrl: null });
    if (res?.ok) {
      setCustomRpcUrls(res.customRpcUrls || {});
      if (networkName === "testnet") setTestnetRpc("");
      if (networkName === "mainnet") setMainnetRpc("");
    }
    setSaving(false);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px",
    marginTop: "4px",
    marginBottom: "8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "13px",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "6px 12px",
    marginRight: "8px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  };

  return (
    <div style={{ padding: 16, maxWidth: 500 }}>
      <h3>Kaspa Wallet Options</h3>
      <p>Manage network endpoints and trusted sites.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: "bold" }}>Active Network</label>
        <select
          value={network}
          onChange={(e) => handleNetworkChange(e.target.value as KaspaNetwork)}
          style={{ marginLeft: 12, padding: "4px 8px" }}
        >
          {Object.values(NETWORKS).map((n) => (
            <option key={n.name} value={n.name}>
              {n.name}
            </option>
          ))}
        </select>
      </div>

      <h4>Custom RPC Endpoints</h4>
      <p style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>
        Leave empty to use the default RPC URL. Custom URLs are persisted across sessions.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: "bold" }}>Testnet RPC URL</label>
        <div style={{ fontSize: 11, color: "#888" }}>
          Default: {NETWORKS.testnet.rpcUrl}
        </div>
        <input
          type="text"
          value={testnetRpc}
          onChange={(e) => setTestnetRpc(e.target.value)}
          placeholder={NETWORKS.testnet.rpcUrl}
          style={inputStyle}
        />
        <button
          onClick={() => handleSaveRpc("testnet", testnetRpc)}
          disabled={saving}
          style={{ ...buttonStyle, backgroundColor: "#4CAF50", color: "white" }}
        >
          Save
        </button>
        <button
          onClick={() => handleResetRpc("testnet")}
          disabled={saving}
          style={{ ...buttonStyle, backgroundColor: "#f44336", color: "white" }}
        >
          Reset to Default
        </button>
        {customRpcUrls.testnet && (
          <div style={{ marginTop: 4, fontSize: 11, color: "#4CAF50" }}>
            Active: {customRpcUrls.testnet}
          </div>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontWeight: "bold" }}>Mainnet RPC URL</label>
        <div style={{ fontSize: 11, color: "#888" }}>
          Default: {NETWORKS.mainnet.rpcUrl}
        </div>
        <input
          type="text"
          value={mainnetRpc}
          onChange={(e) => setMainnetRpc(e.target.value)}
          placeholder={NETWORKS.mainnet.rpcUrl}
          style={inputStyle}
        />
        <button
          onClick={() => handleSaveRpc("mainnet", mainnetRpc)}
          disabled={saving}
          style={{ ...buttonStyle, backgroundColor: "#4CAF50", color: "white" }}
        >
          Save
        </button>
        <button
          onClick={() => handleResetRpc("mainnet")}
          disabled={saving}
          style={{ ...buttonStyle, backgroundColor: "#f44336", color: "white" }}
        >
          Reset to Default
        </button>
        {customRpcUrls.mainnet && (
          <div style={{ marginTop: 4, fontSize: 11, color: "#4CAF50" }}>
            Active: {customRpcUrls.mainnet}
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
