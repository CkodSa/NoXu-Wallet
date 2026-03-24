// NoXu Wallet mobile theme — matches extension dark theme CSS variables

export const colors = {
  bg: "#020304",
  bgElevated: "rgba(7, 10, 12, 0.96)",
  card: "rgba(7, 10, 12, 0.96)",
  cardStrong: "rgba(7, 10, 12, 0.98)",
  cardInner: "rgba(7, 10, 12, 0.9)",
  accent: "#6ec7bb",
  accentSoft: "rgba(110, 199, 187, 0.15)",
  accentGlow: "rgba(110, 199, 187, 0.45)",
  accentSecondary: "#8fe4d9",
  accentDark: "#02110e", // dark text on accent buttons
  danger: "#f97373",
  dangerSoft: "rgba(249, 115, 115, 0.15)",
  dangerStrong: "#f87171",
  success: "#34d399",
  successSoft: "rgba(52, 211, 153, 0.15)",
  successLight: "#86efac",
  warning: "#fcd34d",
  warningSoft: "rgba(234, 179, 8, 0.15)",
  warningBorder: "rgba(234, 179, 8, 0.4)",
  text: "#f9fafb",
  textSecondary: "#cbd5e1",
  muted: "#9ca3af",
  border: "rgba(148, 163, 184, 0.12)",
  borderSubtle: "rgba(148, 163, 184, 0.35)",
  borderMedium: "rgba(148, 163, 184, 0.4)",
  overlay: "rgba(0, 0, 0, 0.85)",
  // Gradient stops used for LinearGradient
  gradientAccentStart: "#6ec7bb",
  gradientAccentEnd: "#8fe4d9",
} as const;

export const radii = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const fonts = {
  sizes: {
    xxs: 9,
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    balance: 26,
    amountInput: 32,
    display: 36,
  },
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
  },
} as const;

export const shadows = {
  soft: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.9,
    shadowRadius: 45,
    elevation: 24,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 40,
    elevation: 16,
  },
  buttonGlow: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 12,
  },
} as const;
