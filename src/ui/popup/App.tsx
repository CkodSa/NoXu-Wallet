import React, { useEffect, useRef, useState, useCallback } from "react";
import browser from "webextension-polyfill";
import { useWalletStore, type TokenBalance } from "../store";
import logoAnimationGif from "../assets/NoxuLogoAnimation.gif";
import logoStaticPng from "../assets/logo_static.png";
import type { DerivedAccount } from "../../core/crypto/mnemonic";
import {
  getStaticTokens,
  type KaspaNetwork,
  type TokenMeta
} from "../../core/tokens";
import { formatTokenBalance } from "../../core/kaspa/krc20-client";
import {
  formatTimeRemaining,
  type SecurityFeaturesState,
  type WatchOnlyAddress,
  type DelayedTransaction,
  type AddressBookEntry,
  type AddressBook,
} from "../../core/securityFeatures";

type OnboardingStep =
  | "welcome"
  | "create"
  | "import"
  | "seed"
  | "confirm"
  | "login";
type MainPage =
  | "home"
  | "send"
  | "receive"
  | "activity"
  | "settings"
  | "token"
  | "watchdetail";

async function rpc(type: string, payload?: any) {
  return browser.runtime.sendMessage({ type, payload });
}

const STORAGE_SEED_SEEN_KEY = "kaspa_hasSeenSeedBackupScreen";

/* ------------------------- Error boundary ------------------------- */

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    console.error("Wallet popup crashed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      return (
        <div
          style={{
            width: 380,
            height: 620,
            padding: 12,
            background: "#120b1f",
            color: "#ffb4b4",
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: 11,
            boxSizing: "border-box",
            whiteSpace: "pre-wrap"
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>
            Wallet UI crashed
          </div>
          <div style={{ marginBottom: 8 }}>
            {String(err && err.message ? err.message : err)}
          </div>
          {err && err.stack && (
            <>
              <div style={{ fontWeight: 600, marginTop: 8 }}>Stack:</div>
              <div>{String(err.stack)}</div>
            </>
          )}
          <div style={{ marginTop: 12, opacity: 0.8 }}>
            Open DevTools → Console for the same stack trace, then fix the
            component and line shown there.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ------------------------- Animated Logo (GIF-based) ------------------------- */

const ANIMATION_DURATION = 3000; // GIF is 3 seconds
const LOOPS_ON_MOUNT = 1;

const AnimatedLogo: React.FC = () => {
  const [isAnimating, setIsAnimating] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Play 2 loops on mount, then stop
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, ANIMATION_DURATION * LOOPS_ON_MOUNT);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const triggerAnimation = () => {
    if (isAnimating) return;

    // Force GIF to restart by adding cache-busting query param
    if (imgRef.current) {
      imgRef.current.src = logoAnimationGif + "?" + Date.now();
    }
    setIsAnimating(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsAnimating(false);
    }, ANIMATION_DURATION * LOOPS_ON_MOUNT);
  };

  return (
    <img
      ref={imgRef}
      src={isAnimating ? logoAnimationGif : logoStaticPng}
      alt="NoXu Wallet Logo"
      className="animated-logo-gif"
      onClick={triggerAnimation}
      style={{ cursor: isAnimating ? "default" : "pointer" }}
    />
  );
};

/* ------------------------- Inline SVG nav icons ------------------------- */

const HomeIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18}>
    <path
      d="M4 11.5 12 4l8 7.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.5 11.5V20H17.5V11.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SendIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18}>
    <path
      d="M4 4l16 8-16 8 3-8z"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M11 12h4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ReceiveIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18}>
    <polyline
      points="12 3 12 17"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="7 12 12 17 17 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1={5}
      y1={20}
      x2={19}
      y2={20}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ActivityIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18}>
    <path
      d="M4 12h3l2.5-6 5 12 2.5-6H20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Simplified gear-style settings icon (no long path string)
const SettingsIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={18} height={18}>
    {/* center circle */}
    <circle
      cx={12}
      cy={12}
      r={3}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    />
    {/* top */}
    <line
      x1={12}
      y1={2}
      x2={12}
      y2={5}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    {/* bottom */}
    <line
      x1={12}
      y1={19}
      x2={12}
      y2={22}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    {/* left */}
    <line
      x1={2}
      y1={12}
      x2={5}
      y2={12}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    {/* right */}
    <line
      x1={19}
      y1={12}
      x2={22}
      y2={12}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    {/* top-left */}
    <line
      x1={5}
      y1={5}
      x2={7}
      y2={7}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    {/* top-right */}
    <line
      x1={19}
      y1={5}
      x2={17}
      y2={7}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    {/* bottom-left */}
    <line
      x1={5}
      y1={19}
      x2={7}
      y2={17}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    {/* bottom-right */}
    <line
      x1={19}
      y1={19}
      x2={17}
      y2={17}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </svg>
);

/* ------------------------- Settings section icons ------------------------- */

const WalletIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={16} height={16}>
    <rect
      x={3}
      y={6}
      width={18}
      height={14}
      rx={2}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 10h18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <circle cx={16} cy={14} r={1.5} fill="currentColor" />
  </svg>
);

const NetworkIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={16} height={16}>
    <circle
      cx={12}
      cy={12}
      r={9}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    />
    <path
      d="M3 12h18"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <path
      d="M12 3c-2.5 3-4 6.5-4 9s1.5 6 4 9c2.5-3 4-6.5 4-9s-1.5-6-4-9z"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ShieldIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={16} height={16}>
    <path
      d="M12 3L4 7v5c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V7l-8-4z"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9 12l2 2 4-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const EyeIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={16} height={16}>
    <path
      d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx={12}
      cy={12}
      r={3}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    />
  </svg>
);

const InfoIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={16} height={16}>
    <circle
      cx={12}
      cy={12}
      r={9}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    />
    <line
      x1={12}
      y1={16}
      x2={12}
      y2={12}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <circle cx={12} cy={8} r={1} fill="currentColor" />
  </svg>
);

const BookIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={16} height={16}>
    <path
      d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const RefreshIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={14} height={14}>
    <path
      d="M23 4v6h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1 20v-6h6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const DownloadIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={14} height={14}>
    <path
      d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <polyline
      points="7 10 12 15 17 10"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1={12}
      y1={15}
      x2={12}
      y2={3}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </svg>
);

const BackIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width={16} height={16}>
    <polyline
      points="15 18 9 12 15 6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ------------------------- Layout helpers ------------------------- */

const ScreenLayout: React.FC<{
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
}> = ({ title, children, onBack }) => (
  <div className="screen">
    <div className="title-row">
      {onBack && (
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
      )}
      <div>
        <div className="screen-title">{title}</div>
      </div>
    </div>
    {children}
  </div>
);

type NavProps = { current: MainPage; onChange: (page: MainPage) => void };
type NavItem = { key: MainPage; label: string; icon: React.ReactNode };

const NavBar: React.FC<NavProps> = ({ current, onChange }) => {
  const items: NavItem[] = [
    { key: "home", label: "Home", icon: <HomeIcon /> },
    { key: "send", label: "Send", icon: <SendIcon /> },
    { key: "receive", label: "Receive", icon: <ReceiveIcon /> },
    { key: "activity", label: "Activity", icon: <ActivityIcon /> },
    { key: "settings", label: "Settings", icon: <SettingsIcon /> }
  ];

  return (
    <div className="nav-bar">
      {items.map((item) => (
        <button
          key={item.key}
          className={`nav-item ${current === item.key ? "active" : ""}`}
          onClick={() => onChange(item.key)}
        >
          <div className="nav-icon">{item.icon}</div>
          <div>{item.label}</div>
        </button>
      ))}
    </div>
  );
};

function shorten(addr?: string) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

const WordGrid: React.FC<{ words: string[] }> = ({ words }) => (
  <div className="grid-words">
    {words.map((w, i) => (
      <div key={i} className="word-chip">
        <span className="index">{i + 1}</span>
        <span className="word">{w}</span>
      </div>
    ))}
  </div>
);

/* ------------------------- Main inner app ------------------------- */

function InnerApp() {
  const {
    account,
    setAccount,
    setBalance,
    balance,
    tokenBalances,
    setTokenBalances,
    tokenBalancesLoading,
    setTokenBalancesLoading,
  } = useWalletStore();

  // Hooks – keep order fixed
  const [onboardingStep, setOnboardingStep] =
    useState<OnboardingStep>("welcome");
  const [mainPage, setMainPage] = useState<MainPage>("home");
  const [hasWallet, setHasWallet] = useState(false);
  const [activeToken, setActiveToken] = useState<TokenMeta | null>(null);
  const [chartRange, setChartRange] = useState<"D" | "W" | "M">("D");
  const [error, setError] = useState<string | undefined>();
  const [password, setPassword] = useState("");
  const [unlockPassword, setUnlockPassword] = useState("");
  const [mnemonic, setMnemonic] = useState<string | undefined>();
  const [generatedMnemonic, setGeneratedMnemonic] = useState<
    string | undefined
  >();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [wordCount, setWordCount] = useState<12 | 24>(12);
  const [seedSeen, setSeedSeen] = useState(false);
  const [confirmIndex, setConfirmIndex] = useState(3);
  const [confirmInput, setConfirmInput] = useState("");
  const [exportMode, setExportMode] = useState(false);
  const [exportPassword, setExportPassword] = useState("");
  const [exportedSeed, setExportedSeed] = useState<string | undefined>();
  const [selectedToken, setSelectedToken] = useState("KAS");
  const [network, setNetwork] = useState<KaspaNetwork>("mainnet");
  const [showConfirmSend, setShowConfirmSend] = useState(false);
  const [sendingTx, setSendingTx] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Security Features State
  const [securityFeatures, setSecurityFeatures] = useState<SecurityFeaturesState | null>(null);
  const [isDuressMode, setIsDuressMode] = useState(false);
  const [duressPin, setDuressPin] = useState("");
  const [duressDecoyBalance, setDuressDecoyBalance] = useState("50");
  const [duressEnabled, setDuressEnabled] = useState(false);
  const [watchOnlyBalances, setWatchOnlyBalances] = useState<Record<string, number>>({});
  const [newWatchAddress, setNewWatchAddress] = useState("");
  const [newWatchLabel, setNewWatchLabel] = useState("");
  const [addingWatch, setAddingWatch] = useState(false);
  const [timeDelayEnabled, setTimeDelayEnabled] = useState(false);
  const [timeDelayThreshold, setTimeDelayThreshold] = useState("1000");
  const [timeDelayHours, setTimeDelayHours] = useState("24");
  const [pendingTransactions, setPendingTransactions] = useState<DelayedTransaction[]>([]);
  const [showDelayedModal, setShowDelayedModal] = useState(false);
  const [delayedTxInfo, setDelayedTxInfo] = useState<DelayedTransaction | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null); // For "Saved" feedback
  const [copiedWatchId, setCopiedWatchId] = useState<string | null>(null); // For copy feedback
  const [addressCopied, setAddressCopied] = useState(false); // For main address copy feedback
  const [selectedWatch, setSelectedWatch] = useState<WatchOnlyAddress | null>(null); // For watch detail view
  const [watchHistory, setWatchHistory] = useState<any[]>([]); // Transaction history for selected watch address
  const [watchHistoryLoading, setWatchHistoryLoading] = useState(false);

  // Address Book State
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  const [newContactAddress, setNewContactAddress] = useState("");
  const [newContactLabel, setNewContactLabel] = useState("");
  const [newContactNotes, setNewContactNotes] = useState("");
  const [addingContact, setAddingContact] = useState(false);
  const [showAddressBookPicker, setShowAddressBookPicker] = useState(false);

  // Refresh State
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);

  // Token Info State
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [tokenInfoLoading, setTokenInfoLoading] = useState(false);

  // Settings section expand/collapse state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    wallet: false,
    network: false,
    security: false,
    portfolio: false,
    about: false,
  });

  // Network settings state (moved from options page)
  const [customTestnetRpc, setCustomTestnetRpc] = useState("");
  const [customMainnetRpc, setCustomMainnetRpc] = useState("");
  const [savingRpc, setSavingRpc] = useState(false);

  // Token display settings
  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const SMALL_BALANCE_THRESHOLD = 1; // Hide tokens worth less than 1 unit

  useEffect(() => {
    browser.storage.local.get([STORAGE_SEED_SEEN_KEY]).then((res) => {
      if (res && res[STORAGE_SEED_SEEN_KEY]) setSeedSeen(true);
    });
  }, []);

  // Load custom RPC URLs
  useEffect(() => {
    rpc("GET_CUSTOM_RPC").then((res: any) => {
      if (res?.ok && res.customRpcUrls) {
        setCustomTestnetRpc(res.customRpcUrls.testnet || "");
        setCustomMainnetRpc(res.customRpcUrls.mainnet || "");
      }
    });
  }, []);

  // Load security features
  const loadSecurityFeatures = useCallback(async () => {
    const res = await rpc("GET_SECURITY_FEATURES");
    if (res?.ok) {
      setSecurityFeatures(res.securityFeatures);
      setIsDuressMode(res.isDuressMode);
      setDuressEnabled(res.securityFeatures.duressMode.enabled);
      setDuressDecoyBalance(String(res.securityFeatures.duressMode.decoyBalance / 1e8));
      setTimeDelayEnabled(res.securityFeatures.timeDelay.enabled);
      setTimeDelayThreshold(String(res.securityFeatures.timeDelay.thresholdKas));
      setTimeDelayHours(String(res.securityFeatures.timeDelay.delayHours));
    }
  }, []);

  // Load address book
  const loadAddressBook = useCallback(async () => {
    const res = await rpc("GET_ADDRESS_BOOK");
    if (res?.ok) {
      setAddressBook(res.addressBook?.entries || []);
    }
  }, []);

  // Resolve address to label
  const resolveAddressLabel = useCallback((address: string): string | null => {
    const entry = addressBook.find((e) => e.address === address);
    return entry?.label || null;
  }, [addressBook]);

  // Load pending transactions
  const loadPendingTransactions = useCallback(async () => {
    const res = await rpc("GET_PENDING_TXS");
    if (res?.ok) {
      setPendingTransactions(res.transactions);
    }
  }, []);

  // Load watch-only balances
  const loadWatchOnlyBalances = useCallback(async () => {
    if (!securityFeatures?.watchOnlyAddresses?.length) return;
    const balances: Record<string, number> = {};
    for (const watch of securityFeatures.watchOnlyAddresses) {
      try {
        const res = await rpc("GET_WATCH_ONLY_BALANCE", { address: watch.address });
        if (res?.ok) {
          balances[watch.id] = res.balance;
        }
      } catch {
        // Ignore errors for individual addresses
      }
    }
    setWatchOnlyBalances(balances);
  }, [securityFeatures?.watchOnlyAddresses]);

  useEffect(() => {
    if (account) {
      loadSecurityFeatures();
      loadPendingTransactions();
      loadAddressBook();
    }
  }, [account, loadSecurityFeatures, loadPendingTransactions, loadAddressBook]);

  useEffect(() => {
    if (securityFeatures?.watchOnlyAddresses?.length) {
      loadWatchOnlyBalances();
    }
  }, [securityFeatures?.watchOnlyAddresses, loadWatchOnlyBalances]);

  // Refresh pending transactions timer
  useEffect(() => {
    if (!account || pendingTransactions.length === 0) return;
    const interval = setInterval(() => {
      loadPendingTransactions();
    }, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [account, pendingTransactions.length, loadPendingTransactions]);

  useEffect(() => {
    rpc("GET_STATE").then((res) => {
      setHasWallet(!!res?.hasWallet);

      if (res?.network) {
        setNetwork(res.network as KaspaNetwork);
      }

      if (res?.account) {
        setAccount(res.account as DerivedAccount);
        setOnboardingStep("welcome");
        setMainPage("home");
      } else if (res?.hasWallet) {
        setOnboardingStep("login");
      } else {
        setOnboardingStep("welcome");
      }
    });
  }, [setAccount]);

  // Lock wallet when popup closes via port disconnection
  useEffect(() => {
    // Establish a named port connection to background script
    // When popup closes, the port disconnects and background locks the wallet
    const port = browser.runtime.connect({ name: "popup" });
    return () => port.disconnect();
  }, []);

  useEffect(() => {
    if (account) {
      rpc("GET_BALANCE").then((res) => {
        if (res?.ok) {
          const raw = res.balance;
          let num: number;

          if (typeof raw === "bigint") num = Number(raw);
          else num = Number(raw);

          if (Number.isNaN(num)) num = 0;
          setBalance(num);
        }
      });
      rpc("GET_HISTORY").then((res) => {
        if (res?.ok) setHistory(res.history);
      });
      // Fetch KRC-20 token balances
      setTokenBalancesLoading(true);
      rpc("GET_TOKEN_BALANCES").then((res) => {
        if (res?.ok && res.balances) {
          setTokenBalances(res.balances);
        }
        setTokenBalancesLoading(false);
      }).catch(() => {
        setTokenBalancesLoading(false);
      });
    }
  }, [account, setBalance, setTokenBalances, setTokenBalancesLoading]);

  const handleCreateFlow = async () => {
    setError(undefined);
    const res = await rpc("CREATE_WALLET", { password, wordCount });
    if (res?.ok) {
      setAccount(res.state.account);
      setHasWallet(true);
      setGeneratedMnemonic(res.mnemonic || res.state.mnemonicTransient);
      setOnboardingStep("seed");
      setConfirmIndex(Math.floor(Math.random() * (wordCount - 1)));
      setSeedSeen(false);
      browser.storage.local.set({ [STORAGE_SEED_SEEN_KEY]: false });
    } else {
      setError(res?.error);
    }
  };

  const handleImport = async () => {
    setError(undefined);
    if (!mnemonic) return;
    const res = await rpc("IMPORT_WALLET", { password, mnemonic });
    if (res?.ok) {
      setAccount(res.state.account);
      setHasWallet(true);
      setMainPage("home");
      setOnboardingStep("welcome");
    } else setError(res?.error);
  };

  // shared unlock
  const handleUnlock = async () => {
    if (!hasWallet) return;
    setError(undefined);
    const res = await rpc("UNLOCK", { password: unlockPassword });
    if (res?.ok) {
      setUnlockPassword(""); // Clear password after successful unlock
      setAccount(res.account);
      setOnboardingStep("welcome");
      setMainPage("home");
      setError(undefined);
    } else {
      setError(res?.error || "Incorrect password");
    }
  };

  const handleSendClick = () => {
    if (!recipient || !amount) return;
    setError(undefined);

    // Show confirmation modal instead of sending directly
    setShowConfirmSend(true);
  };

  const handleConfirmSend = async () => {
    if (!recipient || !amount) return;
    setSendingTx(true);
    setError(undefined);

    let res;

    if (selectedToken === "KAS") {
      // Send KAS
      res = await rpc("SEND_TX", {
        to: recipient,
        amount: BigInt(Math.round(Number(amount) * 1e8)).toString()
      });
    } else {
      // Send KRC-20 token
      // Find token decimals from tokenBalances
      const tokenBalance = tokenBalances?.find(
        (tb: TokenBalance) => tb.tick.toUpperCase() === selectedToken
      );
      const decimals = tokenBalance?.decimals ?? 8;

      res = await rpc("SEND_KRC20_TX", {
        tick: selectedToken,
        to: recipient,
        amount: amount,
        decimals: decimals
      });
    }

    setSendingTx(false);
    setShowConfirmSend(false);

    if (res?.ok) {
      // Check if transaction was delayed
      if (res.delayed) {
        setDelayedTxInfo(res.transaction);
        setShowDelayedModal(true);
        setRecipient("");
        setAmount("");
        await loadPendingTransactions();
        return;
      }

      setMainPage("home");
      setRecipient("");
      setAmount("");
      rpc("GET_HISTORY").then((h) => h?.ok && setHistory(h.history));
      rpc("GET_BALANCE").then((b) => {
        if (b?.ok) {
          const raw = b.balance;
          let num: number;

          if (typeof raw === "bigint") num = Number(raw);
          else num = Number(raw);

          if (Number.isNaN(num)) num = 0;
          setBalance(num);
        }
      });
      // Also refresh token balances for KRC-20
      if (selectedToken !== "KAS") {
        rpc("GET_TOKEN_BALANCES").then((tokenRes) => {
          if (tokenRes?.ok) {
            setTokenBalances(tokenRes.balances);
          }
        });
      }
    } else {
      setError(res?.error);
    }
  };

  const handleCancelSend = () => {
    setShowConfirmSend(false);
  };

  // Helper to show save success message
  const showSaveSuccess = (message: string) => {
    setSaveSuccess(message);
    setTimeout(() => setSaveSuccess(null), 2000);
  };

  // Helper to copy watch address
  const handleCopyWatchAddress = (id: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedWatchId(id);
    setTimeout(() => setCopiedWatchId(null), 1500);
  };

  // Open watch address detail view with transaction history
  const handleOpenWatchDetail = async (watch: WatchOnlyAddress) => {
    setSelectedWatch(watch);
    setWatchHistory([]);
    setWatchHistoryLoading(true);
    setMainPage("watchdetail");

    try {
      const res = await rpc("GET_WATCH_ONLY_HISTORY", { address: watch.address });
      if (res?.ok) {
        setWatchHistory(res.history || []);
      }
    } catch {
      // Ignore errors, show empty history
    }
    setWatchHistoryLoading(false);
  };

  // Security Feature Handlers
  const handleSaveDuressMode = async () => {
    const res = await rpc("SET_DURESS_MODE", {
      enabled: duressEnabled,
      duressPin: duressPin || undefined,
      decoyBalance: Math.round(Number(duressDecoyBalance) * 1e8),
    });
    if (res?.ok) {
      setDuressPin(""); // Clear PIN from UI for security
      await loadSecurityFeatures();
      showSaveSuccess("Duress settings saved");
    }
  };

  const handleAddWatchOnly = async () => {
    if (!newWatchAddress || addingWatch) return;
    setAddingWatch(true);
    setError(undefined);
    const res = await rpc("ADD_WATCH_ONLY", {
      address: newWatchAddress,
      label: newWatchLabel || "Unnamed",
    });
    setAddingWatch(false);
    if (res?.ok) {
      setNewWatchAddress("");
      setNewWatchLabel("");
      await loadSecurityFeatures();
    } else {
      setError(res?.error || "Failed to add address");
    }
  };

  const handleRemoveWatchOnly = async (id: string) => {
    const res = await rpc("REMOVE_WATCH_ONLY", { id });
    if (res?.ok) {
      await loadSecurityFeatures();
    }
  };

  const handleSaveTimeDelay = async () => {
    const res = await rpc("SET_TIME_DELAY", {
      enabled: timeDelayEnabled,
      thresholdKas: Number(timeDelayThreshold),
      delayHours: Number(timeDelayHours),
    });
    if (res?.ok) {
      await loadSecurityFeatures();
      showSaveSuccess("Time delay settings saved");
    }
  };

  const handleCancelDelayedTx = async (id: string) => {
    const res = await rpc("CANCEL_DELAYED_TX", { id });
    if (res?.ok) {
      await loadPendingTransactions();
    }
  };

  const handleExecuteDelayedTx = async (id: string) => {
    const res = await rpc("EXECUTE_DELAYED_TX", { id });
    if (res?.ok) {
      await loadPendingTransactions();
      rpc("GET_BALANCE").then((b) => {
        if (b?.ok) setBalance(Number(b.balance));
      });
    } else {
      setError(res?.error);
    }
  };

  // Address Book Handlers
  const handleAddContact = async () => {
    if (!newContactAddress || addingContact) return;
    setAddingContact(true);
    setError(undefined);
    const res = await rpc("ADD_ADDRESS_BOOK_ENTRY", {
      address: newContactAddress,
      label: newContactLabel || "Unnamed",
      notes: newContactNotes || "",
    });
    setAddingContact(false);
    if (res?.ok) {
      setNewContactAddress("");
      setNewContactLabel("");
      setNewContactNotes("");
      await loadAddressBook();
      showSaveSuccess("Contact added");
    } else {
      setError(res?.error || "Failed to add contact");
    }
  };

  const handleRemoveContact = async (id: string) => {
    const res = await rpc("REMOVE_ADDRESS_BOOK_ENTRY", { id });
    if (res?.ok) {
      await loadAddressBook();
    }
  };

  const handleSelectFromAddressBook = (address: string) => {
    setRecipient(address);
    setShowAddressBookPicker(false);
  };

  // Refresh Balance and History
  const handleRefreshBalance = async () => {
    setRefreshingBalance(true);
    try {
      const res = await rpc("GET_BALANCE");
      if (res?.ok) {
        const raw = res.balance;
        let num: number;
        if (typeof raw === "bigint") num = Number(raw);
        else num = Number(raw);
        if (Number.isNaN(num)) num = 0;
        setBalance(num);
      }
      // Also refresh token balances
      const tokenRes = await rpc("GET_TOKEN_BALANCES");
      if (tokenRes?.ok && tokenRes.balances) {
        setTokenBalances(tokenRes.balances);
      }
    } catch {
      // Ignore errors
    }
    setRefreshingBalance(false);
  };

  const handleRefreshHistory = async () => {
    setRefreshingHistory(true);
    try {
      const res = await rpc("GET_HISTORY");
      if (res?.ok) setHistory(res.history);
    } catch {
      // Ignore errors
    }
    setRefreshingHistory(false);
  };

  // Export Transaction History to CSV
  const handleExportCSV = () => {
    if (!history || history.length === 0) return;

    const headers = ["Date", "TXID", "Type", "Amount (KAS)", "From", "To", "Status", "Contact"];
    const rows = history.map((tx) => {
      const isOutgoing = tx.isOutgoing ?? (tx.from === account?.address);
      const date = tx.time ? new Date(tx.time * 1000).toISOString() : "";
      const amount = tx.amountSompi ? (Number(tx.amountSompi) / 1e8).toFixed(8) : "0";
      const otherAddress = isOutgoing ? tx.to : tx.from;
      const contact = resolveAddressLabel(otherAddress) || "";
      return [
        date,
        tx.txid || "",
        isOutgoing ? "Sent" : "Received",
        amount,
        tx.from || "",
        tx.to || "",
        tx.status || "pending",
        contact,
      ];
    });

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kaspa-transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showSaveSuccess("CSV exported");
  };

  // Load Token Info
  const loadTokenInfo = async (tick: string) => {
    setTokenInfoLoading(true);
    setTokenInfo(null);
    try {
      const res = await rpc("GET_TOKEN_INFO", { tick: tick.toLowerCase() });
      if (res?.ok && res.info) {
        setTokenInfo(res.info);
      }
    } catch {
      // Ignore errors
    }
    setTokenInfoLoading(false);
  };

  const confirmSeed = () => {
    if (!generatedMnemonic) return;
    const words = generatedMnemonic.split(" ");
    if (
      words[confirmIndex].toLowerCase().trim() !==
      confirmInput.toLowerCase().trim()
    ) {
      setError("That word doesn't match. Try again.");
      return;
    }
    browser.storage.local.set({ [STORAGE_SEED_SEEN_KEY]: true });
    setSeedSeen(true);
    setGeneratedMnemonic(undefined);
    setOnboardingStep("welcome");
    setMainPage("home");
  };

  const inWallet = !!account;
  const onboardingMode =
    !inWallet ||
    onboardingStep !== "welcome" ||
    !!generatedMnemonic ||
    onboardingStep === "login" ||
    onboardingStep === "create" ||
    onboardingStep === "import" ||
    onboardingStep === "seed" ||
    onboardingStep === "confirm";

  // Token list - combine native KAS with real KRC-20 tokens
  const staticTokens: TokenMeta[] = getStaticTokens(network);
  const kasToken = staticTokens.find((t) => t.symbol === "KAS");

  // Build dynamic token list from fetched KRC-20 balances
  const krc20Tokens: TokenMeta[] = (tokenBalances || []).map((tb: TokenBalance) => ({
    id: `krc20_${tb.tick}`,
    symbol: tb.tick.toUpperCase(),
    name: tb.tick,
    decimals: tb.decimals,
    kind: "krc20" as const,
    visibleByDefault: true,
  }));

  // Combine: KAS first, then real KRC-20 tokens (exclude demo tokens on mainnet when we have real tokens)
  const tokenList: TokenMeta[] = [
    ...(kasToken ? [kasToken] : []),
    ...krc20Tokens,
    // Only show demo tokens on testnet and when no real tokens exist
    ...(network === "testnet" && krc20Tokens.length === 0
      ? staticTokens.filter((t) => t.kind === "krc20" && t.testnetOnly)
      : []),
  ];

  const tokens = tokenList.map((t) => {
    if (t.symbol === "KAS") {
      return {
        token: t,
        amount: balance !== undefined ? balance / 1e8 : 0,
      };
    }
    // Find KRC-20 balance
    const krc20Balance = tokenBalances?.find(
      (tb: TokenBalance) => tb.tick.toUpperCase() === t.symbol
    );
    if (krc20Balance) {
      return {
        token: t,
        amount: formatTokenBalance(BigInt(krc20Balance.balance), krc20Balance.decimals),
      };
    }
    return { token: t, amount: 0 };
  });

  /* ---------- reusable card chunks ---------- */

  const ActionCard = (
    <ScreenLayout title="NoXu Wallet">
      <div className="login-shell">
        {/* Animated Logo */}
        <div className="login-logo-frame">
          <AnimatedLogo />
        </div>

        {/* Glass password panel */}
        <div className="card login-card elevated">
          <div className="login-title-primary">ENTER YOUR PASSWORD</div>

          <div className="card login-inner">
            <input
              className="input"
              placeholder="Password"
              type="password"
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleUnlock();
                }
              }}
            />

            <button
              className="primary-btn login-unlock-btn"
              onClick={handleUnlock}
              disabled={!hasWallet}
            >
              Unlock wallet
            </button>
          </div>

          {error && (
            <div className="error-text" style={{ marginTop: 8 }}>
              {error}
            </div>
          )}
        </div>

        {/* Bottom buttons */}
        <div className="login-footer-buttons">
          <button
            className="primary-btn login-main-action"
            onClick={() => setOnboardingStep("create")}
          >
            Create new wallet
          </button>
          <button
            className="secondary-btn login-secondary-action"
            onClick={() => setOnboardingStep("import")}
          >
            Import existing wallet
          </button>
        </div>
      </div>
    </ScreenLayout>
  );

  const HomeCard = (
    <div className="card home-card">
      <div className="row space-between">
        <div>
          <div className="label">Address</div>
          <div className="value">{shorten(account?.address)}</div>
        </div>
        <button
          className={`secondary-btn pill ${addressCopied ? "copied" : ""}`}
          onClick={() => {
            navigator.clipboard.writeText(account?.address || "");
            setAddressCopied(true);
            setTimeout(() => setAddressCopied(false), 1000);
          }}
        >
          {addressCopied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="balance-block">
        <div className="row space-between" style={{ alignItems: "flex-start" }}>
          <div>
            <div className="label">Balance</div>
            <div className="balance-value">
              {balance !== undefined ? `${(balance / 1e8).toFixed(4)} KAS` : "…"}
            </div>
          </div>
          <button
            className="refresh-btn"
            onClick={handleRefreshBalance}
            disabled={refreshingBalance}
            title="Refresh balance"
          >
            <span className={refreshingBalance ? "spinning" : ""}><RefreshIcon /></span>
          </button>
        </div>
        <div className="muted small" style={{ marginTop: 4 }}>
          Network: {network === "mainnet" ? "Kaspa Mainnet" : "Kaspa Testnet"}
        </div>
      </div>
    </div>
  );

  /* ---------- Onboarding mode ---------- */

  if (onboardingMode) {
    return (
      <div className="app-shell">
        <div className="content" ref={contentRef}>
          {(onboardingStep === "welcome" || onboardingStep === "login") &&
            ActionCard}

          {onboardingStep === "create" && (
            <ScreenLayout
              title="Create wallet"
              onBack={() => setOnboardingStep("welcome")}
            >
              <div className="card" style={{ display: "grid", gap: 12 }}>
                <div className="warning-banner">
                  <strong>Security Warning:</strong> Never share your seed phrase
                  with anyone. NoXu will NEVER ask for your seed phrase. Beware
                  of scams and phishing sites.
                </div>
                <div className="pill-toggle">
                  {[12, 24].map((n) => (
                    <button
                      key={n}
                      className={`pill ${wordCount === n ? "active" : ""}`}
                      onClick={() => setWordCount(n as 12 | 24)}
                    >
                      {n} words
                    </button>
                  ))}
                </div>
                <input
                  className="input"
                  placeholder="Set a strong password (for local encryption)"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button className="primary-btn" onClick={handleCreateFlow}>
                  Generate seed phrase
                </button>
                {error && <div className="error-text">{error}</div>}
              </div>
            </ScreenLayout>
          )}

          {onboardingStep === "seed" && generatedMnemonic && (
            <ScreenLayout
              title="Backup seed"
              onBack={() => setOnboardingStep("create")}
            >
              <div className="card" style={{ display: "grid", gap: 12 }}>
                <div className="warning-banner warning-critical">
                  <strong>CRITICAL:</strong> Write these words on paper and store
                  securely offline. NEVER enter them on any website. NoXu support
                  will NEVER ask for your seed phrase.
                </div>
                <div className="muted">
                  Write down these {wordCount} words IN ORDER. This is your ONLY backup.
                  If you lose these words, your funds are gone forever. NoXu cannot help.
                </div>
                <WordGrid words={generatedMnemonic.split(" ")} />
                <div className="inline-buttons">
                  <button
                    className="secondary-btn"
                    onClick={() =>
                      navigator.clipboard.writeText(generatedMnemonic || "")
                    }
                  >
                    Copy all words
                  </button>
                  <button
                    className="primary-btn"
                    onClick={() => setOnboardingStep("confirm")}
                    disabled={seedSeen}
                    title={seedSeen ? "Already confirmed once" : ""}
                  >
                    I've saved it
                  </button>
                </div>
                <div className="muted small">
                  Security: Keep it offline. Anyone with these words can spend your funds.
                </div>
                <div className="muted small warning-text">
                  ⚠️ Clipboard can be read by other apps. Writing manually is safer.
                </div>
              </div>
            </ScreenLayout>
          )}

          {onboardingStep === "confirm" && generatedMnemonic && (
            <ScreenLayout
              title="Confirm word"
              onBack={() => setOnboardingStep("seed")}
            >
              <div className="card" style={{ display: "grid", gap: 12 }}>
                <div className="muted small" style={{ marginBottom: 4 }}>
                  This confirms you've actually saved your seed phrase.
                </div>
                <div className="muted">
                  Type word #{confirmIndex + 1} from your seed phrase:
                </div>
                <input
                  className="input"
                  placeholder={`Word #${confirmIndex + 1}`}
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                />
                <button className="primary-btn" onClick={confirmSeed}>
                  Confirm and continue
                </button>
                {error && <div className="error-text">{error}</div>}
              </div>
            </ScreenLayout>
          )}

          {onboardingStep === "import" && (
            <ScreenLayout
              title="Import wallet"
              onBack={() => setOnboardingStep("welcome")}
            >
              <div className="card" style={{ display: "grid", gap: 10 }}>
                <div className="warning-banner">
                  <strong>Scam Alert:</strong> Only import your seed phrase in the
                  official NoXu extension. Never enter it on websites or share it
                  with anyone claiming to be support.
                </div>
                <textarea
                  className="input"
                  placeholder="Enter your 12/24-word mnemonic"
                  rows={3}
                  value={mnemonic}
                  onChange={(e) => setMnemonic(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Password to encrypt locally"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button className="primary-btn" onClick={handleImport}>
                  Import wallet
                </button>
                {error && <div className="error-text">{error}</div>}
              </div>
            </ScreenLayout>
          )}

          {!["welcome", "login", "create", "seed", "confirm", "import"].includes(
            onboardingStep
          ) && ActionCard}
        </div>
      </div>
    );
  }

  /* ---------- Token detail helpers ---------- */

  const currentTokenAmount =
    activeToken
      ? tokens.find((t) => t.token.symbol === activeToken.symbol)?.amount ?? 0
      : 0;

  const TokenDetailCard = activeToken && (
    <div className="card token-detail">
      <div className="row space-between">
        <div>
          <div className="label">{activeToken.name}</div>
          <div className="token-detail-balance">
            {currentTokenAmount} {activeToken.symbol}
          </div>
        </div>
        <div className="muted small">
          {activeToken.kind === "krc20" && (
            <span className="token-badge" style={{ marginRight: 6 }}>KRC-20</span>
          )}
          {network === "mainnet" ? "Mainnet" : "Testnet"}
        </div>
      </div>

      {/* Token Info Section for KRC-20 */}
      {activeToken.kind === "krc20" && (
        <div className="token-info-section">
          {tokenInfoLoading ? (
            <div className="muted small" style={{ textAlign: "center", padding: 8 }}>
              Loading token info...
            </div>
          ) : tokenInfo ? (
            <div className="token-info-grid">
              <div className="token-info-item">
                <span className="token-info-label">Total Supply</span>
                <span className="token-info-value">
                  {tokenInfo.maxSupply ? (Number(tokenInfo.maxSupply) / Math.pow(10, tokenInfo.decimals || 8)).toLocaleString() : "N/A"}
                </span>
              </div>
              <div className="token-info-item">
                <span className="token-info-label">Minted</span>
                <span className="token-info-value">
                  {tokenInfo.minted ? (Number(tokenInfo.minted) / Math.pow(10, tokenInfo.decimals || 8)).toLocaleString() : "N/A"}
                </span>
              </div>
              <div className="token-info-item">
                <span className="token-info-label">Holders</span>
                <span className="token-info-value">{tokenInfo.holderTotal?.toLocaleString() || "N/A"}</span>
              </div>
              <div className="token-info-item">
                <span className="token-info-label">Transfers</span>
                <span className="token-info-value">{tokenInfo.transferTotal?.toLocaleString() || "N/A"}</span>
              </div>
              <div className="token-info-item">
                <span className="token-info-label">State</span>
                <span className={`token-info-value ${tokenInfo.state === "deployed" ? "state-active" : ""}`}>
                  {tokenInfo.state || "N/A"}
                </span>
              </div>
              <div className="token-info-item">
                <span className="token-info-label">Decimals</span>
                <span className="token-info-value">{tokenInfo.decimals ?? "N/A"}</span>
              </div>
            </div>
          ) : (
            <div className="muted small" style={{ textAlign: "center", padding: 8 }}>
              Token info not available
            </div>
          )}
        </div>
      )}

      {/* Chart for KAS only */}
      {activeToken.symbol === "KAS" && (
        <>
          <div className="token-detail-chart-header">
            <span className="muted small">Price (demo)</span>
            <div className="chart-tabs">
              {(["D", "W", "M"] as const).map((r) => (
                <button
                  key={r}
                  className={`chart-tab ${chartRange === r ? "active" : ""}`}
                  onClick={() => setChartRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="token-chart">
            <TokenChart />
          </div>
        </>
      )}

      <div className="token-detail-actions">
        <button
          className="primary-btn"
          onClick={() => {
            setSelectedToken(activeToken.symbol);
            setMainPage("send");
          }}
        >
          Send
        </button>
        <button
          className="secondary-btn"
          onClick={() => setMainPage("receive")}
        >
          Receive
        </button>
      </div>
    </div>
  );

  /* ---------- Main wallet screens ---------- */

  const ActivityList = (
    <div className="card">
      <div className="row space-between" style={{ marginBottom: 8 }}>
        <div className="card-title" style={{ margin: 0 }}>Recent activity</div>
        <div className="row" style={{ gap: 6 }}>
          <button
            className="icon-btn"
            onClick={handleRefreshHistory}
            disabled={refreshingHistory}
            title="Refresh history"
          >
            <span className={refreshingHistory ? "spinning" : ""}><RefreshIcon /></span>
          </button>
          {history && history.length > 0 && (
            <button
              className="icon-btn"
              onClick={handleExportCSV}
              title="Export to CSV"
            >
              <DownloadIcon />
            </button>
          )}
        </div>
      </div>
      <div className="activity-list">
        {history && history.length > 0 ? (
          history.slice(0, 10).map((tx, idx) => {
            const isOutgoing = tx.isOutgoing ?? (tx.from === account?.address);
            const otherAddress = isOutgoing ? tx.to : tx.from;
            const contactLabel = resolveAddressLabel(otherAddress);
            return (
              <div key={idx} className="activity-item">
                <div className="row space-between">
                  <span className={isOutgoing ? "tx-outgoing" : "tx-incoming"}>
                    {isOutgoing ? "-" : "+"}
                    {tx.amountSompi ? (Number(tx.amountSompi) / 1e8).toFixed(4) : 0} KAS
                  </span>
                  <span className={`badge ${tx.status || "pending"}`}>
                    {tx.status || "pending"}
                  </span>
                </div>
                <div className="muted small">
                  {isOutgoing ? "To: " : "From: "}
                  {contactLabel ? (
                    <span className="contact-label">{contactLabel}</span>
                  ) : (
                    shorten(otherAddress)
                  )}
                </div>
                {tx.time && (
                  <div className="muted small" style={{ fontSize: 9, opacity: 0.7 }}>
                    {new Date(tx.time * 1000).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="muted small">No transactions yet.</div>
        )}
      </div>
    </div>
  );

  const ReceiveCard = (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <div className="muted" style={{ textAlign: "center" }}>
        Scan QR code or copy address to receive Kaspa{" "}
        {network === "mainnet" ? "(Mainnet)" : "(Testnet)"}
      </div>
      {/* QR Code */}
      <div className="qr-container">
        <QRCode value={account?.address || ""} size={160} />
      </div>
      <div className="address-full" style={{ textAlign: "center", fontSize: 11 }}>{account?.address}</div>
      <button
        className="secondary-btn"
        onClick={() => {
          navigator.clipboard.writeText(account?.address || "");
          showSaveSuccess("Address copied");
        }}
      >
        Copy address
      </button>
    </div>
  );

  const SendCard = (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <div>
        <div className="muted small">Token</div>
        <select
          className="input"
          value={selectedToken}
          onChange={(e) => setSelectedToken(e.target.value)}
          style={{ appearance: "none" }}
        >
          {tokenList.map((t) => (
            <option key={t.id} value={t.symbol}>
              {t.symbol}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="row space-between" style={{ marginBottom: 4 }}>
          <span className="muted small">Recipient</span>
          {addressBook.length > 0 && (
            <button
              className="address-book-toggle"
              onClick={() => setShowAddressBookPicker(!showAddressBookPicker)}
            >
              <BookIcon /> Contacts
            </button>
          )}
        </div>
        <input
          className="input"
          placeholder="Recipient address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
        {/* Address Book Picker */}
        {showAddressBookPicker && addressBook.length > 0 && (
          <div className="address-book-picker">
            {addressBook.map((contact) => (
              <button
                key={contact.id}
                className="contact-pick-item"
                onClick={() => handleSelectFromAddressBook(contact.address)}
              >
                <span className="contact-pick-label">{contact.label}</span>
                <span className="contact-pick-address">{shorten(contact.address)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        className="input"
        placeholder={`Amount (${selectedToken})`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button
        className="primary-btn"
        onClick={handleSendClick}
      >
        Review Transaction
      </button>
      {selectedToken !== "KAS" && (
        <div className="muted small" style={{ color: "#f0a000" }}>
          Note: KRC-20 transfers require Schnorr signature support. This is currently in development.
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
    </div>
  );

  // Helper to highlight first/last chars of address for verification
  const formatAddressHighlight = (addr: string) => {
    if (!addr || addr.length < 20) return addr;
    const prefix = addr.slice(0, 12);
    const middle = addr.slice(12, -8);
    const suffix = addr.slice(-8);
    return (
      <>
        <span className="addr-highlight">{prefix}</span>
        <span className="addr-middle">{middle}</span>
        <span className="addr-highlight">{suffix}</span>
      </>
    );
  };

  // Transaction fee (fixed for now)
  const TX_FEE_SOMPI = 1000;
  const TX_FEE_KAS = TX_FEE_SOMPI / 1e8;

  const ConfirmSendModal = showConfirmSend && (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-title">
          Confirm {selectedToken === "KAS" ? "Transaction" : `${selectedToken} Transfer`}
        </div>

        <div className="confirm-section">
          <div className="confirm-label">Sending</div>
          <div className="confirm-value confirm-amount">{amount} {selectedToken}</div>
        </div>

        <div className="confirm-section">
          <div className="confirm-label">To Address</div>
          <div className="confirm-value confirm-address">
            {formatAddressHighlight(recipient)}
          </div>
          <div className="confirm-warning">
            Verify the highlighted characters match your intended recipient
          </div>
        </div>

        {selectedToken === "KAS" && (
          <>
            <div className="confirm-section">
              <div className="confirm-label">Network Fee</div>
              <div className="confirm-value">{TX_FEE_KAS} KAS</div>
            </div>

            <div className="confirm-section">
              <div className="confirm-label">Total</div>
              <div className="confirm-value confirm-total">
                {(Number(amount) + TX_FEE_KAS).toFixed(8)} KAS
              </div>
            </div>
          </>
        )}

        {selectedToken !== "KAS" && (
          <div className="confirm-section">
            <div className="confirm-label">Token</div>
            <div className="confirm-value">
              <span className="token-badge">KRC-20</span> {selectedToken}
            </div>
          </div>
        )}

        <div className="warning-banner" style={{ marginTop: 12 }}>
          <strong>Warning:</strong> Transactions cannot be reversed.
          Double-check the address before confirming.
        </div>

        <div className="modal-buttons">
          <button
            className="secondary-btn"
            onClick={handleCancelSend}
            disabled={sendingTx}
          >
            Cancel
          </button>
          <button
            className="primary-btn"
            onClick={handleConfirmSend}
            disabled={sendingTx}
          >
            {sendingTx ? "Sending..." : "Confirm & Send"}
          </button>
        </div>
      </div>
    </div>
  );

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSaveRpc = async (networkName: string, rpcUrl: string) => {
    setSavingRpc(true);
    const trimmed = rpcUrl.trim();
    await rpc("SET_CUSTOM_RPC", {
      network: networkName,
      rpcUrl: trimmed || null,
    });
    setSavingRpc(false);
    showSaveSuccess("RPC endpoint saved");
  };

  const handleNetworkSwitch = async (newNetwork: KaspaNetwork) => {
    await rpc("SWITCH_NETWORK", { network: newNetwork });
    setNetwork(newNetwork);
    showSaveSuccess(`Switched to ${newNetwork}`);
  };

  const SettingsCard = (
    <div className="card settings-card">
      {/* Save Success Message */}
      {saveSuccess && (
        <div className="save-success-banner">{saveSuccess}</div>
      )}

      {/* Pending Transactions Alert - Always visible at top if present */}
      {pendingTransactions.length > 0 && (
        <div
          className="warning-banner"
          style={{ cursor: "pointer", marginBottom: 12 }}
          onClick={() => {
            setExpandedSections(prev => ({ ...prev, security: true }));
          }}
        >
          <strong>{pendingTransactions.length} Pending Transaction{pendingTransactions.length > 1 ? "s" : ""}</strong>
          <div className="muted small" style={{ color: "#fcd34d", marginTop: 4 }}>
            Expand Security section to manage queued transactions
          </div>
        </div>
      )}

      {/* ==================== WALLET SECTION ==================== */}
      <div className="settings-section">
        <button
          className="settings-section-header"
          onClick={() => toggleSection("wallet")}
        >
          <div className="settings-section-title">
            <span className="settings-section-icon"><WalletIcon /></span>
            Wallet
          </div>
          <span className={`settings-chevron ${expandedSections.wallet ? "expanded" : ""}`}>▼</span>
        </button>

        {expandedSections.wallet && (
          <div className="settings-section-content">
            <div className="settings-subsection">
              <div className="settings-subsection-title">Export Seed Phrase</div>
              {!exportMode ? (
                <button
                  className="secondary-btn"
                  onClick={() => setExportMode(true)}
                >
                  Export with password
                </button>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <input
                    className="input"
                    type="password"
                    placeholder="Enter password to decrypt"
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                  />
                  <button
                    className="primary-btn"
                    onClick={async () => {
                      const res = await rpc("EXPORT_SEED", {
                        password: exportPassword
                      });
                      if (res?.ok) {
                        setExportedSeed(res.mnemonic);
                      } else {
                        setError(res?.error || "Unable to export");
                      }
                    }}
                  >
                    Decrypt and show once
                  </button>
                  {exportedSeed && (
                    <div className="card inner seed-text">
                      <div className="muted small">
                        Copy immediately; this will not persist here.
                      </div>
                      <div>{exportedSeed}</div>
                      <button
                        className="secondary-btn"
                        onClick={() =>
                          navigator.clipboard.writeText(exportedSeed)
                        }
                      >
                        Copy seed
                      </button>
                    </div>
                  )}
                  <button
                    className="secondary-btn"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      setExportMode(false);
                      setExportPassword("");
                      setExportedSeed(undefined);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
              <div className="muted small" style={{ marginTop: 6 }}>
                Seed only reveals after password; never persisted in UI.
              </div>
            </div>

            <div className="settings-subsection">
              <button
                className="secondary-btn danger-btn"
                onClick={() => {
                  rpc("LOCK");
                  setPassword(""); // Clear password field for security
                  setAccount(undefined);
                  setMainPage("home");
                  setOnboardingStep("login");
                }}
              >
                Lock Wallet
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==================== NETWORK SECTION ==================== */}
      <div className="settings-section">
        <button
          className="settings-section-header"
          onClick={() => toggleSection("network")}
        >
          <div className="settings-section-title">
            <span className="settings-section-icon"><NetworkIcon /></span>
            Network
            <span className="settings-badge">{network}</span>
          </div>
          <span className={`settings-chevron ${expandedSections.network ? "expanded" : ""}`}>▼</span>
        </button>

        {expandedSections.network && (
          <div className="settings-section-content">
            <div className="settings-subsection">
              <div className="settings-subsection-title">Active Network</div>
              <div className="network-toggle">
                <button
                  className={`network-btn ${network === "mainnet" ? "active" : ""}`}
                  onClick={() => handleNetworkSwitch("mainnet")}
                >
                  Mainnet
                </button>
                <button
                  className={`network-btn ${network === "testnet" ? "active" : ""}`}
                  onClick={() => handleNetworkSwitch("testnet")}
                >
                  Testnet
                </button>
              </div>
            </div>

            <div className="settings-subsection">
              <div className="settings-subsection-title">Custom RPC Endpoints</div>
              <div className="muted small" style={{ marginBottom: 8 }}>
                Leave empty to use default. Custom URLs persist across sessions.
              </div>

              <div className="rpc-config">
                <label className="rpc-label">Mainnet RPC</label>
                <input
                  className="input"
                  type="text"
                  placeholder="https://api.kaspa.org (default)"
                  value={customMainnetRpc}
                  onChange={(e) => setCustomMainnetRpc(e.target.value)}
                />
                <div className="rpc-actions">
                  <button
                    className="secondary-btn pill"
                    onClick={() => handleSaveRpc("mainnet", customMainnetRpc)}
                    disabled={savingRpc}
                  >
                    Save
                  </button>
                  <button
                    className="secondary-btn pill"
                    onClick={() => {
                      setCustomMainnetRpc("");
                      handleSaveRpc("mainnet", "");
                    }}
                    disabled={savingRpc}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="rpc-config">
                <label className="rpc-label">Testnet RPC</label>
                <input
                  className="input"
                  type="text"
                  placeholder="https://api-tn.kaspa.org (default)"
                  value={customTestnetRpc}
                  onChange={(e) => setCustomTestnetRpc(e.target.value)}
                />
                <div className="rpc-actions">
                  <button
                    className="secondary-btn pill"
                    onClick={() => handleSaveRpc("testnet", customTestnetRpc)}
                    disabled={savingRpc}
                  >
                    Save
                  </button>
                  <button
                    className="secondary-btn pill"
                    onClick={() => {
                      setCustomTestnetRpc("");
                      handleSaveRpc("testnet", "");
                    }}
                    disabled={savingRpc}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== SECURITY SECTION ==================== */}
      <div className="settings-section">
        <button
          className="settings-section-header"
          onClick={() => toggleSection("security")}
        >
          <div className="settings-section-title">
            <span className="settings-section-icon"><ShieldIcon /></span>
            Security
            {(duressEnabled || timeDelayEnabled) && (
              <span className="settings-badge active">Active</span>
            )}
          </div>
          <span className={`settings-chevron ${expandedSections.security ? "expanded" : ""}`}>▼</span>
        </button>

        {expandedSections.security && (
          <div className="settings-section-content">
            {/* Duress Mode */}
            <div className="settings-subsection">
              <div className="settings-subsection-title">
                Duress Mode (Decoy Wallet)
                <span className="feature-badge">Unique</span>
              </div>
              <div className="muted small" style={{ marginBottom: 8 }}>
                Create a panic PIN that opens a decoy wallet with a small fake balance.
                Protects against physical threats and coercion.
              </div>

              <div className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Enable Duress Mode</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={duressEnabled}
                    onChange={(e) => setDuressEnabled(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {duressEnabled && (
                <div className="config-panel">
                  <div className="config-row">
                    <span className="config-label">Duress PIN</span>
                    <input
                      type="password"
                      className="config-input"
                      placeholder="Set PIN"
                      value={duressPin}
                      onChange={(e) => setDuressPin(e.target.value)}
                      style={{ width: 120 }}
                    />
                  </div>
                  <div className="config-row">
                    <span className="config-label">Decoy Balance (KAS)</span>
                    <input
                      type="number"
                      className="config-input"
                      value={duressDecoyBalance}
                      onChange={(e) => setDuressDecoyBalance(e.target.value)}
                      min="0"
                      step="10"
                    />
                  </div>
                  <button
                    className="primary-btn"
                    style={{ marginTop: 8, fontSize: 12 }}
                    onClick={handleSaveDuressMode}
                    disabled={!duressPin}
                  >
                    Save Duress Settings
                  </button>
                </div>
              )}
            </div>

            {/* Time-Delayed Transactions */}
            <div className="settings-subsection">
              <div className="settings-subsection-title">
                Time-Delayed Transactions
                <span className="feature-badge novel">Novel</span>
              </div>
              <div className="muted small" style={{ marginBottom: 8 }}>
                Large transactions are queued for a delay period. You can cancel within
                the window. Protects against hacks, scams, and impulsive decisions.
              </div>

              <div className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Enable Time Delay</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={timeDelayEnabled}
                    onChange={(e) => setTimeDelayEnabled(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {timeDelayEnabled && (
                <div className="config-panel">
                  <div className="config-row">
                    <span className="config-label">Threshold (KAS)</span>
                    <input
                      type="number"
                      className="config-input"
                      value={timeDelayThreshold}
                      onChange={(e) => setTimeDelayThreshold(e.target.value)}
                      min="1"
                      step="100"
                    />
                  </div>
                  <div className="config-row">
                    <span className="config-label">Delay (hours)</span>
                    <input
                      type="number"
                      className="config-input"
                      value={timeDelayHours}
                      onChange={(e) => setTimeDelayHours(e.target.value)}
                      min="1"
                      max="168"
                      step="1"
                    />
                  </div>
                  <button
                    className="primary-btn"
                    style={{ marginTop: 8, fontSize: 12 }}
                    onClick={handleSaveTimeDelay}
                  >
                    Save Delay Settings
                  </button>
                  <div className="muted small" style={{ marginTop: 6 }}>
                    Transactions above {timeDelayThreshold} KAS will wait {timeDelayHours} hours.
                  </div>
                </div>
              )}

              {/* Pending Transactions */}
              {pendingTransactions.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="settings-subsection-title" style={{ marginBottom: 8 }}>
                    Pending Transactions ({pendingTransactions.length})
                  </div>
                  <div className="pending-tx-list">
                    {pendingTransactions.map((tx) => (
                      <div key={tx.id} className="pending-tx-item">
                        <div className="pending-tx-header">
                          <span className="pending-tx-amount">
                            {(Number(tx.amountSompi) / 1e8).toFixed(2)} KAS
                          </span>
                          <span className="pending-tx-timer">
                            {formatTimeRemaining(tx.executeAt)}
                          </span>
                        </div>
                        <div className="pending-tx-address">{shorten(tx.to)}</div>
                        <div className="pending-tx-actions">
                          <button
                            className="pending-tx-cancel"
                            onClick={() => handleCancelDelayedTx(tx.id)}
                          >
                            Cancel
                          </button>
                          <button
                            className="pending-tx-execute"
                            onClick={() => handleExecuteDelayedTx(tx.id)}
                          >
                            Execute Now
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==================== PORTFOLIO SECTION ==================== */}
      <div className="settings-section">
        <button
          className="settings-section-header"
          onClick={() => toggleSection("portfolio")}
        >
          <div className="settings-section-title">
            <span className="settings-section-icon"><EyeIcon /></span>
            Portfolio
            {securityFeatures?.watchOnlyAddresses && securityFeatures.watchOnlyAddresses.length > 0 && (
              <span className="settings-badge">{securityFeatures.watchOnlyAddresses.length} watching</span>
            )}
          </div>
          <span className={`settings-chevron ${expandedSections.portfolio ? "expanded" : ""}`}>▼</span>
        </button>

        {expandedSections.portfolio && (
          <div className="settings-section-content">
            <div className="settings-subsection">
              <div className="settings-subsection-title">Watch-Only Addresses</div>
              <div className="muted small" style={{ marginBottom: 8 }}>
                Track any Kaspa address without importing keys. Perfect for monitoring
                whale wallets, cold storage, or friends' addresses.
              </div>

              {/* Watch List */}
              {securityFeatures?.watchOnlyAddresses &&
                securityFeatures.watchOnlyAddresses.length > 0 ? (
                <div className="watch-list">
                  {securityFeatures.watchOnlyAddresses.map((watch) => (
                    <div key={watch.id} className="watch-item">
                      <div
                        className="watch-item-info watch-item-clickable"
                        onClick={() => handleOpenWatchDetail(watch)}
                        title="Tap to view transactions"
                      >
                        <span className="watch-item-label">{watch.label}</span>
                        <span className="watch-item-copy-hint">
                          Tap to view transactions
                        </span>
                      </div>
                      <span className="watch-item-balance">
                        {watchOnlyBalances[watch.id] !== undefined
                          ? `${(watchOnlyBalances[watch.id] / 1e8).toFixed(2)} KAS`
                          : "..."}
                      </span>
                      <button
                        className="watch-item-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveWatchOnly(watch.id);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">👁️</div>
                  <div>No addresses being watched yet</div>
                </div>
              )}

              {/* Add Watch Address Form */}
              <div className="add-watch-form">
                <input
                  className="input"
                  placeholder="Kaspa address (kaspa:...)"
                  value={newWatchAddress}
                  onChange={(e) => setNewWatchAddress(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Label (optional)"
                  value={newWatchLabel}
                  onChange={(e) => setNewWatchLabel(e.target.value)}
                />
                <button
                  className="add-watch-btn"
                  onClick={handleAddWatchOnly}
                  disabled={!newWatchAddress || addingWatch}
                >
                  {addingWatch ? "Adding..." : "Add Address"}
                </button>
                {error && <div className="error-text">{error}</div>}
              </div>
            </div>

            {/* Address Book Subsection */}
            <div className="settings-subsection">
              <div className="settings-subsection-title">
                <BookIcon /> Address Book
              </div>
              <div className="muted small" style={{ marginBottom: 8 }}>
                Save frequently used addresses with labels. Contacts appear in send screen
                and transaction history.
              </div>

              {/* Contact List */}
              {addressBook.length > 0 ? (
                <div className="watch-list">
                  {addressBook.map((contact) => (
                    <div key={contact.id} className="watch-item">
                      <div className="watch-item-info">
                        <span className="watch-item-label">{contact.label}</span>
                        <span className="watch-item-copy-hint">
                          {shorten(contact.address)}
                        </span>
                      </div>
                      <button
                        className="secondary-btn pill"
                        style={{ fontSize: 10, padding: "4px 8px" }}
                        onClick={() => {
                          navigator.clipboard.writeText(contact.address);
                          showSaveSuccess("Address copied");
                        }}
                      >
                        Copy
                      </button>
                      <button
                        className="watch-item-remove"
                        onClick={() => handleRemoveContact(contact.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">📖</div>
                  <div>No contacts saved yet</div>
                </div>
              )}

              {/* Add Contact Form */}
              <div className="add-watch-form">
                <input
                  className="input"
                  placeholder="Kaspa address (kaspa:...)"
                  value={newContactAddress}
                  onChange={(e) => setNewContactAddress(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Label (e.g., Exchange, Friend)"
                  value={newContactLabel}
                  onChange={(e) => setNewContactLabel(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Notes (optional)"
                  value={newContactNotes}
                  onChange={(e) => setNewContactNotes(e.target.value)}
                />
                <button
                  className="add-watch-btn"
                  onClick={handleAddContact}
                  disabled={!newContactAddress || addingContact}
                >
                  {addingContact ? "Adding..." : "Add Contact"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== ABOUT SECTION ==================== */}
      <div className="settings-section">
        <button
          className="settings-section-header"
          onClick={() => toggleSection("about")}
        >
          <div className="settings-section-title">
            <span className="settings-section-icon"><InfoIcon /></span>
            About
          </div>
          <span className={`settings-chevron ${expandedSections.about ? "expanded" : ""}`}>▼</span>
        </button>

        {expandedSections.about && (
          <div className="settings-section-content">
            <div className="settings-subsection">
              <div className="settings-subsection-title">Privacy & Security</div>
              <div className="privacy-disclosure">
                <div className="privacy-item">
                  <span className="privacy-icon">🔐</span>
                  <span>Your keys never leave this device</span>
                </div>
                <div className="privacy-item">
                  <span className="privacy-icon">🚫</span>
                  <span>No analytics or tracking</span>
                </div>
                <div className="privacy-item">
                  <span className="privacy-icon">📡</span>
                  <span>Only connects to Kaspa RPC for balances/transactions</span>
                </div>
                <div className="privacy-item">
                  <span className="privacy-icon">⚠️</span>
                  <span>We cannot recover your wallet - backup your seed phrase!</span>
                </div>
              </div>
              <div className="muted small" style={{ marginTop: 6 }}>
                NoXu is non-custodial. You have full control and responsibility.
              </div>
            </div>

            <div className="settings-subsection">
              <div className="settings-subsection-title">Verify Installation</div>
              <button
                className="secondary-btn"
                style={{ fontSize: 12 }}
                onClick={() => {
                  const isFirefox = navigator.userAgent.includes("Firefox");
                  const extensionsUrl = isFirefox ? "about:addons" : "chrome://extensions";
                  browser.tabs.create({ url: extensionsUrl });
                }}
              >
                Check Extension ID
              </button>
              <div className="muted small" style={{ marginTop: 6 }}>
                Compare the extension ID with the official ID on our website.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Delayed Transaction Modal
  const DelayedTxModal = showDelayedModal && delayedTxInfo && (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-title">Transaction Queued</div>

        <div className="confirm-section">
          <div className="confirm-label">Amount</div>
          <div className="confirm-value confirm-amount">
            {Number(delayedTxInfo.amountSompi) / 1e8} KAS
          </div>
        </div>

        <div className="confirm-section">
          <div className="confirm-label">To</div>
          <div className="confirm-value" style={{ fontSize: 11, wordBreak: "break-all" }}>
            {delayedTxInfo.to}
          </div>
        </div>

        <div className="warning-banner" style={{ marginTop: 12 }}>
          <strong>Time-Delayed Protection Active</strong><br />
          This transaction exceeds your threshold of {securityFeatures?.timeDelay.thresholdKas} KAS.
          It will be executed in {securityFeatures?.timeDelay.delayHours} hours unless cancelled.
        </div>

        <div className="confirm-section" style={{ marginTop: 12 }}>
          <div className="confirm-label">Executes At</div>
          <div className="confirm-value">
            {new Date(delayedTxInfo.executeAt).toLocaleString()}
          </div>
        </div>

        <div className="modal-buttons">
          <button
            className="secondary-btn"
            onClick={() => {
              handleCancelDelayedTx(delayedTxInfo.id);
              setShowDelayedModal(false);
              setDelayedTxInfo(null);
            }}
          >
            Cancel Transaction
          </button>
          <button
            className="primary-btn"
            onClick={() => {
              setShowDelayedModal(false);
              setDelayedTxInfo(null);
              setMainPage("settings");
              setExpandedSections(prev => ({ ...prev, security: true }));
            }}
          >
            View Queue
          </button>
        </div>
      </div>
    </div>
  );

  // Filter tokens based on hideSmallBalances setting
  const filteredTokens = hideSmallBalances
    ? tokens.filter(({ token, amount }) => {
        // Always show native KAS
        if (token.symbol === "KAS") return true;
        // Parse amount (could be string from formatTokenBalance or number)
        const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
        return numAmount >= SMALL_BALANCE_THRESHOLD;
      })
    : tokens;

  const hiddenCount = tokens.length - filteredTokens.length;

  const TokensCard = (
    <div className="card">
      <div className="row space-between" style={{ marginBottom: 8 }}>
        <div className="card-title" style={{ margin: 0 }}>Tokens</div>
        <div className="row" style={{ gap: 8 }}>
          {tokenBalancesLoading && (
            <span className="muted small">Loading...</span>
          )}
          <button
            className={`hide-small-btn ${hideSmallBalances ? "active" : ""}`}
            onClick={() => setHideSmallBalances(!hideSmallBalances)}
            title={hideSmallBalances ? "Show all tokens" : "Hide small balances"}
          >
            {hideSmallBalances ? "Show all" : "Hide small"}
          </button>
        </div>
      </div>
      <div className="token-list">
        {filteredTokens.map(({ token, amount }) => (
          <button
            key={token.id}
            className="token-row"
            onClick={() => {
              setSelectedToken(token.symbol);
              setActiveToken(token);
              setMainPage("token");
              // Load token info for KRC-20 tokens
              if (token.kind === "krc20") {
                loadTokenInfo(token.symbol);
              } else {
                setTokenInfo(null);
              }
            }}
          >
            <div className="token-main">
              <span className="token-symbol">{token.symbol}</span>
              <span className="token-name">{token.name}</span>
              {token.kind === "krc20" && (
                <span className="token-badge">KRC-20</span>
              )}
            </div>
            <div className="token-balance">{amount}</div>
          </button>
        ))}
        {filteredTokens.length === 1 && !tokenBalancesLoading && !hideSmallBalances && (
          <div className="muted small" style={{ textAlign: "center", padding: 12 }}>
            No KRC-20 tokens found for this address
          </div>
        )}
        {hideSmallBalances && hiddenCount > 0 && (
          <div className="muted small" style={{ textAlign: "center", padding: 8 }}>
            {hiddenCount} token{hiddenCount > 1 ? "s" : ""} hidden (balance {"<"} {SMALL_BALANCE_THRESHOLD})
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <div className="content" ref={contentRef}>
        {mainPage === "home" && (
          <ScreenLayout title="Home">
            {isDuressMode && (
              <div className="duress-active-banner">
                Duress Mode Active - Decoy wallet displayed
              </div>
            )}
            {HomeCard}
            {/* Watch-Only Preview */}
            {securityFeatures?.watchOnlyAddresses &&
              securityFeatures.watchOnlyAddresses.length > 0 && (
              <div className="card" style={{ marginTop: 8 }}>
                <div className="row space-between" style={{ marginBottom: 6 }}>
                  <div className="card-title" style={{ margin: 0 }}>Watching</div>
                  <button
                    className="secondary-btn pill"
                    style={{ fontSize: 10, padding: "4px 8px" }}
                    onClick={() => {
                      setMainPage("settings");
                      setExpandedSections(prev => ({ ...prev, portfolio: true }));
                    }}
                  >
                    Manage
                  </button>
                </div>
                <div className="watch-list" style={{ marginTop: 0 }}>
                  {securityFeatures.watchOnlyAddresses.slice(0, 3).map((watch) => (
                    <div key={watch.id} className="watch-item" style={{ padding: 8 }}>
                      <div
                        className="watch-item-info watch-item-clickable"
                        onClick={() => handleOpenWatchDetail(watch)}
                        title="Tap to view transactions"
                      >
                        <span className="watch-item-label">{watch.label}</span>
                        <span className="watch-item-copy-hint">
                          Tap to view
                        </span>
                      </div>
                      <span className="watch-item-balance">
                        {watchOnlyBalances[watch.id] !== undefined
                          ? `${(watchOnlyBalances[watch.id] / 1e8).toFixed(2)} KAS`
                          : "..."}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Pending Transactions Alert */}
            {pendingTransactions.length > 0 && (
              <div
                className="warning-banner"
                style={{ marginTop: 8, cursor: "pointer" }}
                onClick={() => {
                  setMainPage("settings");
                  setExpandedSections(prev => ({ ...prev, security: true }));
                }}
              >
                <strong>⏰ {pendingTransactions.length} Queued Transaction{pendingTransactions.length > 1 ? "s" : ""}</strong>
                <div className="muted small" style={{ color: "#fcd34d", marginTop: 4 }}>
                  Tap to review pending time-delayed transactions
                </div>
              </div>
            )}
            {TokensCard}
            {ActivityList}
          </ScreenLayout>
        )}
        {mainPage === "send" && (
          <ScreenLayout title="Send" onBack={() => setMainPage("home")}>{SendCard}</ScreenLayout>
        )}
        {mainPage === "receive" && (
          <ScreenLayout title="Receive" onBack={() => setMainPage("home")}>{ReceiveCard}</ScreenLayout>
        )}
        {mainPage === "activity" && (
          <ScreenLayout title="Activity" onBack={() => setMainPage("home")}>{ActivityList}</ScreenLayout>
        )}
        {mainPage === "settings" && (
          <ScreenLayout title="Settings" onBack={() => setMainPage("home")}>{SettingsCard}</ScreenLayout>
        )}
        {mainPage === "watchdetail" && selectedWatch && (
          <ScreenLayout
            title={selectedWatch.label}
            onBack={() => {
              setMainPage("home");
              setSelectedWatch(null);
              setWatchHistory([]);
            }}
          >
            <div className="card" style={{ display: "grid", gap: 10 }}>
              {/* Address Info */}
              <div className="watch-detail-header">
                <div className="watch-detail-balance">
                  {watchOnlyBalances[selectedWatch.id] !== undefined
                    ? `${(watchOnlyBalances[selectedWatch.id] / 1e8).toFixed(4)} KAS`
                    : "Loading..."}
                </div>
                <div
                  className="watch-detail-address"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedWatch.address);
                    setCopiedWatchId(selectedWatch.id);
                    setTimeout(() => setCopiedWatchId(null), 1500);
                  }}
                  title="Click to copy"
                >
                  {copiedWatchId === selectedWatch.id
                    ? "Copied!"
                    : shorten(selectedWatch.address)}
                </div>
              </div>

              {/* Transaction History */}
              <div className="card-title" style={{ marginTop: 8 }}>
                Transaction History
              </div>
              <div className="activity-list">
                {watchHistoryLoading ? (
                  <div className="muted small" style={{ textAlign: "center", padding: 16 }}>
                    Loading transactions...
                  </div>
                ) : watchHistory.length > 0 ? (
                  watchHistory.slice(0, 20).map((tx, idx) => {
                    // Use the isOutgoing flag from the API, or fall back to checking from address
                    const isOutgoing = tx.isOutgoing ?? (tx.from === selectedWatch.address);
                    return (
                      <div key={idx} className="activity-item">
                        <div className="row space-between">
                          <span className={isOutgoing ? "tx-outgoing" : "tx-incoming"}>
                            {isOutgoing ? "-" : "+"}
                            {tx.amountSompi ? (Number(tx.amountSompi) / 1e8).toFixed(4) : 0} KAS
                          </span>
                          <span className={`badge ${tx.status || "pending"}`}>
                            {tx.status || "pending"}
                          </span>
                        </div>
                        <div className="muted small">
                          {isOutgoing ? "To: " : "From: "}
                          {shorten(isOutgoing ? tx.to : tx.from)}
                        </div>
                        {tx.time && (
                          <div className="muted small" style={{ fontSize: 9 }}>
                            {new Date(tx.time * 1000).toLocaleString()}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="muted small" style={{ textAlign: "center", padding: 16 }}>
                    No transactions found
                  </div>
                )}
              </div>
            </div>
          </ScreenLayout>
        )}
        {mainPage === "token" && activeToken && (
          <ScreenLayout
            title={activeToken.symbol || "Token"}
            onBack={() => {
              setMainPage("home");
              setActiveToken(null);
              setTokenInfo(null);
            }}
          >
            {TokenDetailCard}
          </ScreenLayout>
        )}
      </div>
      <NavBar current={mainPage} onChange={setMainPage} />
      {ConfirmSendModal}
      {DelayedTxModal}
    </div>
  );
}

/* ---------- Real QR Code Generator ---------- */

// Proper QR Code implementation (Version 4, Error Correction Level L)
const QRCode: React.FC<{ value: string; size?: number }> = ({ value, size = 180 }) => {
  const [qrMatrix, setQrMatrix] = React.useState<boolean[][] | null>(null);

  React.useEffect(() => {
    if (!value) {
      setQrMatrix(null);
      return;
    }
    try {
      const matrix = generateRealQRCode(value);
      setQrMatrix(matrix);
    } catch (e) {
      console.error("QR generation error:", e);
      setQrMatrix(null);
    }
  }, [value]);

  if (!value || !qrMatrix) {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: "#fff",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}
      >
        <span style={{ color: "#666", fontSize: 12 }}>No address</span>
      </div>
    );
  }

  const qrSize = qrMatrix.length;
  const padding = 4; // quiet zone
  const totalSize = qrSize + padding * 2;
  const moduleSize = size / totalSize;

  return (
    <div
      style={{
        padding: 12,
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
        display: "inline-block",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${totalSize} ${totalSize}`}
        style={{ display: "block" }}
      >
        <rect x={0} y={0} width={totalSize} height={totalSize} fill="#fff" />
        {qrMatrix.map((row, y) =>
          row.map((cell, x) =>
            cell ? (
              <rect
                key={`${x}-${y}`}
                x={x + padding}
                y={y + padding}
                width={1.1}
                height={1.1}
                fill="#1a1a2e"
                rx={0.15}
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};

// Real QR Code generator - implements ISO/IEC 18004 for alphanumeric data
function generateRealQRCode(text: string): boolean[][] {
  // Use Version 4, Error Correction Level L (can hold ~78 alphanumeric chars)
  const version = 4;
  const size = version * 4 + 17; // 33x33 for version 4

  // Initialize matrix
  const matrix: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));
  const reserved: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false));

  // Add finder patterns at corners
  const addFinderPattern = (centerX: number, centerY: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        if (x < 0 || x >= size || y < 0 || y >= size) continue;

        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const max = Math.max(adx, ady);

        if (max === 4) {
          // Separator (white)
          reserved[y][x] = true;
        } else if (max === 3 || max === 1) {
          // Border and inner (black)
          matrix[y][x] = true;
          reserved[y][x] = true;
        } else if (max === 2) {
          // White ring
          reserved[y][x] = true;
        } else {
          // Center (black)
          matrix[y][x] = true;
          reserved[y][x] = true;
        }
      }
    }
  };

  addFinderPattern(3, 3);
  addFinderPattern(size - 4, 3);
  addFinderPattern(3, size - 4);

  // Add alignment pattern for version 4 at position (26, 26)
  const alignX = size - 7;
  const alignY = size - 7;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = alignX + dx;
      const y = alignY + dy;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const max = Math.max(adx, ady);

      matrix[y][x] = max === 2 || max === 0;
      reserved[y][x] = true;
    }
  }

  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
    reserved[6][i] = true;
    reserved[i][6] = true;
  }

  // Dark module
  matrix[size - 8][8] = true;
  reserved[size - 8][8] = true;

  // Reserve format info areas
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true;
    reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  // Encode data as alphanumeric
  const alphanumericTable = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
  const upperText = text.toUpperCase();

  // Build data bits
  let bits = "";
  // Mode indicator (alphanumeric = 0010)
  bits += "0010";
  // Character count indicator (9 bits for version 4 alphanumeric)
  bits += upperText.length.toString(2).padStart(9, "0");

  // Encode character pairs
  for (let i = 0; i < upperText.length; i += 2) {
    const c1 = alphanumericTable.indexOf(upperText[i]);
    if (i + 1 < upperText.length) {
      const c2 = alphanumericTable.indexOf(upperText[i + 1]);
      const val = c1 * 45 + c2;
      bits += val.toString(2).padStart(11, "0");
    } else {
      bits += c1.toString(2).padStart(6, "0");
    }
  }

  // Add terminator
  bits += "0000";

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits += "0";

  // Add padding codewords (80 data codewords for version 4-L)
  const targetBits = 80 * 8;
  let padToggle = true;
  while (bits.length < targetBits) {
    bits += padToggle ? "11101100" : "00010001";
    padToggle = !padToggle;
  }

  // Convert to codewords
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(parseInt(bits.substr(i, 8), 2));
  }

  // Generate error correction codewords (Reed-Solomon)
  const ecCodewords = generateECCodewords(codewords, 20);

  // Combine data and EC codewords
  const allCodewords = [...codewords, ...ecCodewords];

  // Convert back to bits
  let dataBits = "";
  for (const cw of allCodewords) {
    dataBits += cw.toString(2).padStart(8, "0");
  }

  // Place data in matrix using zigzag pattern
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 0; right -= 2) {
    if (right === 6) right = 5; // Skip timing pattern column

    for (let v = 0; v < size; v++) {
      const y = upward ? size - 1 - v : v;

      for (let dx = 0; dx <= 1; dx++) {
        const x = right - dx;
        if (x < 0) continue;
        if (reserved[y][x]) continue;

        if (bitIndex < dataBits.length) {
          matrix[y][x] = dataBits[bitIndex] === "1";
          bitIndex++;
        }
      }
    }
    upward = !upward;
  }

  // Apply mask pattern 0 (checkerboard)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!reserved[y][x] && (y + x) % 2 === 0) {
        matrix[y][x] = !matrix[y][x];
      }
    }
  }

  // Add format info (mask 0, EC level L = 01)
  // Pre-computed format string for mask 0, level L
  const formatBits = "111011111000100";

  // Horizontal format info (around top-left)
  for (let i = 0; i < 6; i++) {
    matrix[8][i] = formatBits[i] === "1";
  }
  matrix[8][7] = formatBits[6] === "1";
  matrix[8][8] = formatBits[7] === "1";
  matrix[7][8] = formatBits[8] === "1";

  for (let i = 0; i < 6; i++) {
    matrix[5 - i][8] = formatBits[9 + i] === "1";
  }

  // Vertical format info (around top-right and bottom-left)
  for (let i = 0; i < 7; i++) {
    matrix[8][size - 1 - i] = formatBits[i] === "1";
  }
  for (let i = 0; i < 8; i++) {
    matrix[size - 8 + i][8] = formatBits[7 + i] === "1";
  }

  return matrix;
}

// Reed-Solomon error correction generator
function generateECCodewords(data: number[], ecCount: number): number[] {
  // GF(256) with primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
  const gfExp: number[] = new Array(512);
  const gfLog: number[] = new Array(256);

  let x = 1;
  for (let i = 0; i < 255; i++) {
    gfExp[i] = x;
    gfLog[x] = i;
    x <<= 1;
    if (x >= 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    gfExp[i] = gfExp[i - 255];
  }
  gfLog[0] = 0;

  const gfMul = (a: number, b: number): number => {
    if (a === 0 || b === 0) return 0;
    return gfExp[gfLog[a] + gfLog[b]];
  };

  // Generate generator polynomial for ecCount EC codewords
  let gen = [1];
  for (let i = 0; i < ecCount; i++) {
    const newGen = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      newGen[j] ^= gen[j];
      newGen[j + 1] ^= gfMul(gen[j], gfExp[i]);
    }
    gen = newGen;
  }

  // Polynomial division
  const result = new Array(ecCount).fill(0);
  for (let i = 0; i < data.length; i++) {
    const coef = data[i] ^ result[0];
    result.shift();
    result.push(0);
    if (coef !== 0) {
      for (let j = 0; j < ecCount; j++) {
        result[j] ^= gfMul(gen[j + 1], coef);
      }
    }
  }

  return result;
}

/* ---------- Tiny SVG chart for token detail ---------- */

const TokenChart: React.FC = () => {
  const width = 260;
  const height = 70;

  // Simple fake data – just for visual
  const points = [12, 28, 18, 40, 32, 55, 48];
  const step = width / (points.length - 1);

  const path = points
    .map((y, i) => {
      const x = i * step;
      const yy = height - y;
      return `${i === 0 ? "M" : "L"} ${x} ${yy}`;
    })
    .join(" ");

  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      className="token-chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="tokenArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#tokenArea)" />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} />
    </svg>
  );
};

/* ------------------------- Default export ------------------------- */

export default function App() {
  return (
    <ErrorBoundary>
      <InnerApp />
    </ErrorBoundary>
  );
}
