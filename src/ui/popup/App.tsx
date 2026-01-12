import React, { useEffect, useRef, useState } from "react";
import { useWalletStore } from "../store";
import type { DerivedAccount } from "../../core/crypto/mnemonic";
import {
  getStaticTokens,
  type KaspaNetwork,
  type TokenMeta
} from "../../core/tokens";

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
  | "token";

async function rpc(type: string, payload?: any) {
  return chrome.runtime.sendMessage({ type, payload });
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
  const { account, setAccount, setBalance, balance } = useWalletStore();

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

  useEffect(() => {
    chrome.storage?.local.get([STORAGE_SEED_SEEN_KEY], (res) => {
      if (res && res[STORAGE_SEED_SEEN_KEY]) setSeedSeen(true);
    });
  }, []);

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
    }
  }, [account, setBalance]);

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
      chrome.storage?.local.set({ [STORAGE_SEED_SEEN_KEY]: false });
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

    if (selectedToken !== "KAS") {
      setError("Only KAS transfers are supported at the moment.");
      return;
    }

    // Show confirmation modal instead of sending directly
    setShowConfirmSend(true);
  };

  const handleConfirmSend = async () => {
    if (!recipient || !amount) return;
    setSendingTx(true);
    setError(undefined);

    const res = await rpc("SEND_TX", {
      to: recipient,
      amount: BigInt(Math.round(Number(amount) * 1e8)).toString()
    });

    setSendingTx(false);
    setShowConfirmSend(false);

    if (res?.ok) {
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
    } else {
      setError(res?.error);
    }
  };

  const handleCancelSend = () => {
    setShowConfirmSend(false);
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
    chrome.storage?.local.set({ [STORAGE_SEED_SEEN_KEY]: true });
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

  // Token list (static for now, per network)
  const tokenList: TokenMeta[] = getStaticTokens(network);

  const tokens = tokenList.map((t) => ({
    token: t,
    amount:
      t.symbol === "KAS"
        ? balance !== undefined
          ? balance / 1e8
          : 0
        : 0
  }));

  /* ---------- reusable card chunks ---------- */

  const ActionCard = (
    <ScreenLayout title="NoXu Wallet">
      <div className="login-shell">
        {/* Logo frame */}
        <div className="login-logo-frame">
          <img
            src={chrome.runtime.getURL("icons/mylogo1.png")}
            alt="Logo"
            className="login-logo-img"
          />
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
          className="secondary-btn pill"
          onClick={() => navigator.clipboard.writeText(account?.address || "")}
        >
          Copy
        </button>
      </div>
      <div className="balance-block">
        <div className="label">Balance</div>
        <div className="balance-value">
          {balance !== undefined ? `${balance / 1e8} KAS` : "…"}
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
          {network === "mainnet" ? "Mainnet" : "Testnet"}
        </div>
      </div>

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

      <div className="token-detail-actions">
        <button className="primary-btn" onClick={() => setMainPage("send")}>
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
      <div className="card-title">Recent activity</div>
      <div className="activity-list">
        {history && history.length > 0 ? (
          history.slice(0, 10).map((tx, idx) => (
            <div key={idx} className="activity-item">
              <div className="row space-between">
                <span>
                  {tx.amountSompi ? Number(tx.amountSompi) / 1e8 : 0} KAS
                </span>
                <span className={`badge ${tx.status || "pending"}`}>
                  {tx.status || "pending"}
                </span>
              </div>
              <div className="muted small">{tx.txid?.slice(0, 12)}...</div>
            </div>
          ))
        ) : (
          <div className="muted small">No transactions yet.</div>
        )}
      </div>
    </div>
  );

  const ReceiveCard = (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <div className="muted">
        Share this Kaspa{" "}
        {network === "mainnet" ? "mainnet" : "testnet"} address to receive
        funds.
      </div>
      <div className="address-full">{account?.address}</div>
      <button
        className="secondary-btn"
        onClick={() => navigator.clipboard.writeText(account?.address || "")}
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
      <input
        className="input"
        placeholder="Recipient address"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      />
      <input
        className="input"
        placeholder={`Amount (${selectedToken})`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <button
        className="primary-btn"
        onClick={handleSendClick}
        disabled={selectedToken !== "KAS"}
      >
        {selectedToken === "KAS" ? "Review Transaction" : "Only KAS supported (stub)"}
      </button>
      {selectedToken !== "KAS" && (
        <div className="muted small">
          Other tokens are UI-only placeholders for now.
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
        <div className="modal-title">Confirm Transaction</div>

        <div className="confirm-section">
          <div className="confirm-label">Sending</div>
          <div className="confirm-value confirm-amount">{amount} KAS</div>
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

  const SettingsCard = (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <div className="card-title">Export seed phrase</div>
      {!exportMode && (
        <button
          className="secondary-btn"
          onClick={() => setExportMode(true)}
        >
          Export with password
        </button>
      )}
      {exportMode && (
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
        </div>
      )}
      <div className="muted small">
        Seed only reveals after password; it isn't persisted in UI.
      </div>
      <button
        className="secondary-btn"
        onClick={() => {
          rpc("LOCK");
          setAccount(undefined);
          setMainPage("home");
          setOnboardingStep("login");
        }}
      >
        Lock wallet
      </button>

      {/* Privacy & Security Disclosure */}
      <div className="settings-divider" />
      <div className="card-title">Privacy & Security</div>
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
      <div className="muted small" style={{ marginTop: 4 }}>
        NoXu is non-custodial. You have full control and responsibility.
      </div>

      {/* Verify Installation Link */}
      <div className="settings-divider" />
      <button
        className="secondary-btn"
        style={{ fontSize: 12 }}
        onClick={() => {
          // Open Chrome extensions page so user can verify extension ID
          chrome.tabs.create({ url: "chrome://extensions" });
        }}
      >
        Verify Installation (check extension ID)
      </button>
      <div className="muted small" style={{ marginTop: 4 }}>
        Compare the extension ID in chrome://extensions with the official ID on our website.
      </div>
    </div>
  );

  const TokensCard = (
    <div className="card">
      <div className="card-title">Tokens</div>
      <div className="token-list">
        {tokens.map(({ token, amount }) => (
          <button
            key={token.id}
            className="token-row"
            onClick={() => {
              setSelectedToken(token.symbol);
              setActiveToken(token);
              setMainPage("token");
            }}
          >
            <div className="token-main">
              <span className="token-symbol">{token.symbol}</span>
              <span className="token-name">{token.name}</span>
            </div>
            <div className="token-balance">{amount}</div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="app-shell">
      <div className="content" ref={contentRef}>
        {mainPage === "home" && (
          <ScreenLayout title="Home">
            {HomeCard}
            {TokensCard}
            {ActivityList}
          </ScreenLayout>
        )}
        {mainPage === "send" && (
          <ScreenLayout title="Send">{SendCard}</ScreenLayout>
        )}
        {mainPage === "receive" && (
          <ScreenLayout title="Receive">{ReceiveCard}</ScreenLayout>
        )}
        {mainPage === "activity" && (
          <ScreenLayout title="Activity">{ActivityList}</ScreenLayout>
        )}
        {mainPage === "settings" && (
          <ScreenLayout title="Settings">{SettingsCard}</ScreenLayout>
        )}
        {mainPage === "token" && activeToken && (
          <ScreenLayout title={activeToken.symbol || "Token"}>
            {TokenDetailCard}
          </ScreenLayout>
        )}
      </div>
      <NavBar current={mainPage} onChange={setMainPage} />
      {ConfirmSendModal}
    </div>
  );
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
