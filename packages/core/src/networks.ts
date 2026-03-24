export type KaspaNetwork = "testnet" | "mainnet";

export type NetworkConfig = {
  name: KaspaNetwork;
  rpcUrl: string;
  chainId: string;
  explorerBaseUrl?: string;
};

/** User-supplied RPC URLs per network */
export type CustomRpcUrls = Partial<Record<KaspaNetwork, string>>;

/** Get effective RPC URL: custom if set, otherwise default */
export function getEffectiveRpcUrl(
  network: KaspaNetwork,
  customRpcUrls?: CustomRpcUrls
): string {
  return customRpcUrls?.[network] || NETWORKS[network].rpcUrl;
}

/** Get network config with effective RPC URL applied */
export function getNetworkConfig(
  network: KaspaNetwork,
  customRpcUrls?: CustomRpcUrls
): NetworkConfig {
  return {
    ...NETWORKS[network],
    rpcUrl: getEffectiveRpcUrl(network, customRpcUrls),
  };
}

// Default RPC URLs use the public Kaspa REST API
// Users can override with custom URLs in the Options page
// Note: There is no public testnet REST API - testnet requires running your own node
export const NETWORKS: Record<KaspaNetwork, NetworkConfig> = {
  testnet: {
    name: "testnet",
    // No public testnet REST API available - users must provide their own
    // or run a local node. Using mainnet API as placeholder.
    rpcUrl: "https://api.kaspa.org",
    chainId: "kaspa-testnet",
    explorerBaseUrl: "https://explorer-tn11.kaspa.org/tx/",
  },
  mainnet: {
    name: "mainnet",
    rpcUrl: "https://api.kaspa.org",
    chainId: "kaspa-mainnet",
    explorerBaseUrl: "https://explorer.kaspa.org/tx/",
  },
};

// Default to mainnet since that's the only network with a public REST API
export const DEFAULT_NETWORK: KaspaNetwork = "mainnet";
