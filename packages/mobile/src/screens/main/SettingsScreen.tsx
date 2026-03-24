import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import { useWalletStore } from "../../store";
import { useWalletService } from "../../hooks/useWalletService";
import { isValidKaspaAddress, type SecurityFeaturesState } from "@noxu/core";
import { colors, fonts, spacing, radii, shadows } from "../../theme";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => setOpen(!open)}
        activeOpacity={0.7}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.chevron}>{open ? "▲" : "▼"}</Text>
      </TouchableOpacity>
      {open && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );
}

export default function SettingsScreen() {
  const store = useWalletStore();
  const {
    lock,
    exportMnemonic,
    deleteWallet,
    persistSettings,
    persistSecurityFeatures,
    persistAddressBook,
  } = useWalletService();

  // Export seed
  const [exportPw, setExportPw] = useState("");
  const [revealedSeed, setRevealedSeed] = useState<string | null>(null);

  // Security
  const [duressEnabled, setDuressEnabled] = useState(
    store.securityFeatures?.duressMode?.enabled ?? false
  );
  const [duressPin, setDuressPin] = useState("");
  const [duressBalance, setDuressBalance] = useState("50");
  const [delayEnabled, setDelayEnabled] = useState(
    store.securityFeatures?.timeDelay?.enabled ?? false
  );
  const [delayThreshold, setDelayThreshold] = useState("100");
  const [delayHours, setDelayHours] = useState("24");

  // Address book
  const [newContactAddr, setNewContactAddr] = useState("");
  const [newContactLabel, setNewContactLabel] = useState("");

  const handleExportSeed = async () => {
    if (!exportPw) {
      Alert.alert("Error", "Enter your password.");
      return;
    }
    try {
      const seed = await exportMnemonic(exportPw);
      setRevealedSeed(seed);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Wrong password.");
    }
  };

  const handleCopySeed = async () => {
    if (revealedSeed) {
      await Clipboard.setStringAsync(revealedSeed);
      Alert.alert("Copied", "Seed phrase copied to clipboard.");
    }
  };

  const handleLock = () => {
    lock();
  };

  const handleDeleteWallet = () => {
    Alert.alert(
      "Delete Wallet",
      "This will permanently delete your wallet from this device. Make sure you have backed up your seed phrase!",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteWallet();
          },
        },
      ]
    );
  };

  const handleToggleBiometric = async (val: boolean) => {
    if (val) {
      try {
        const LocalAuth = await import("expo-local-authentication");
        const hasHw = await LocalAuth.hasHardwareAsync();
        const isEnrolled = await LocalAuth.isEnrolledAsync();
        if (!hasHw || !isEnrolled) {
          Alert.alert(
            "Not Available",
            "Biometric authentication is not set up on this device."
          );
          return;
        }
      } catch {
        return;
      }
    }
    store.setBiometricEnabled(val);
    await persistSettings({ biometricEnabled: val });
  };

  const handleSetAutoLock = async (minutes: number) => {
    store.setAutoLockMinutes(minutes);
    await persistSettings({ autoLockMinutes: minutes });
  };

  const handleSwitchNetwork = (net: "mainnet" | "testnet") => {
    store.setNetwork(net);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <Text style={styles.title}>Settings</Text>

        {/* Wallet */}
        <Section title="Wallet">
          <Text style={styles.label}>EXPORT SEED PHRASE</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            placeholder="Enter password"
            placeholderTextColor={colors.muted}
            value={exportPw}
            onChangeText={setExportPw}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.smallButton}
            onPress={handleExportSeed}
            activeOpacity={0.8}
          >
            <Text style={styles.smallButtonText}>Reveal Seed</Text>
          </TouchableOpacity>
          {revealedSeed && (
            <View style={styles.seedBox}>
              <Text style={styles.seedWords}>{revealedSeed}</Text>
              <TouchableOpacity onPress={handleCopySeed} style={styles.seedCopyBtn}>
                <Text style={styles.seedCopyText}>Copy</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={handleLock}
            activeOpacity={0.7}
          >
            <Text style={styles.outlineButtonText}>Lock Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleDeleteWallet}
            activeOpacity={0.7}
          >
            <Text style={styles.dangerButtonText}>Delete Wallet</Text>
          </TouchableOpacity>
        </Section>

        {/* Network */}
        <Section title="Network">
          <Text style={styles.label}>ACTIVE NETWORK</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[
                styles.toggle,
                store.network === "mainnet" && styles.toggleActive,
              ]}
              onPress={() => handleSwitchNetwork("mainnet")}
            >
              <Text
                style={[
                  styles.toggleText,
                  store.network === "mainnet" && styles.toggleTextActive,
                ]}
              >
                Mainnet
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggle,
                store.network === "testnet" && styles.toggleActive,
              ]}
              onPress={() => handleSwitchNetwork("testnet")}
            >
              <Text
                style={[
                  styles.toggleText,
                  store.network === "testnet" && styles.toggleTextActive,
                ]}
              >
                Testnet
              </Text>
            </TouchableOpacity>
          </View>
        </Section>

        {/* Security */}
        <Section title="Security">
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Biometric Unlock</Text>
            <Switch
              value={store.biometricEnabled}
              onValueChange={handleToggleBiometric}
              trackColor={{ true: colors.accent, false: "rgba(148,163,184,0.2)" }}
              thumbColor={store.biometricEnabled ? colors.accentSecondary : colors.muted}
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Auto-Lock</Text>
            <View style={styles.autoLockOptions}>
              {[1, 5, 15, 30].map((min) => (
                <TouchableOpacity
                  key={min}
                  style={[
                    styles.autoLockChip,
                    store.autoLockMinutes === min && styles.autoLockChipActive,
                  ]}
                  onPress={() => handleSetAutoLock(min)}
                >
                  <Text
                    style={[
                      styles.autoLockChipText,
                      store.autoLockMinutes === min &&
                        styles.autoLockChipTextActive,
                    ]}
                  >
                    {min}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Duress Mode (Decoy)</Text>
            <Switch
              value={duressEnabled}
              onValueChange={(val) => {
                if (!val) {
                  setDuressEnabled(false);
                  const sf = { ...(store.securityFeatures!) };
                  sf.duressMode = { ...sf.duressMode, enabled: false };
                  persistSecurityFeatures(sf);
                } else {
                  setDuressEnabled(true);
                }
              }}
              trackColor={{ true: colors.accent, false: "rgba(148,163,184,0.2)" }}
              thumbColor={duressEnabled ? colors.accentSecondary : colors.muted}
            />
          </View>
          {duressEnabled && (
            <View style={styles.subsection}>
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder="Duress PIN (min 4 digits)"
                placeholderTextColor={colors.muted}
                value={duressPin}
                onChangeText={setDuressPin}
                keyboardType="number-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Decoy balance (KAS)"
                placeholderTextColor={colors.muted}
                value={duressBalance}
                onChangeText={setDuressBalance}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => {
                  if (duressPin.length < 4) {
                    Alert.alert("Invalid PIN", "Duress PIN must be at least 4 digits.");
                    return;
                  }
                  const bal = parseFloat(duressBalance);
                  if (isNaN(bal) || bal < 0) {
                    Alert.alert("Invalid Balance", "Enter a valid decoy balance.");
                    return;
                  }
                  const sf = { ...(store.securityFeatures!) };
                  sf.duressMode = {
                    enabled: true,
                    duressPin,
                    decoyBalance: Math.round(bal * 1e8),
                  };
                  persistSecurityFeatures(sf);
                  Alert.alert("Saved", "Duress mode configured.");
                }}
              >
                <Text style={styles.smallButtonText}>Save Duress Config</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Time-Delayed Txns</Text>
            <Switch
              value={delayEnabled}
              onValueChange={(val) => {
                if (!val) {
                  setDelayEnabled(false);
                  const sf = { ...(store.securityFeatures!) };
                  sf.timeDelay = { ...sf.timeDelay, enabled: false };
                  persistSecurityFeatures(sf);
                } else {
                  setDelayEnabled(true);
                }
              }}
              trackColor={{ true: colors.accent, false: "rgba(148,163,184,0.2)" }}
              thumbColor={delayEnabled ? colors.accentSecondary : colors.muted}
            />
          </View>
          {delayEnabled && (
            <View style={styles.subsection}>
              <TextInput
                style={styles.input}
                placeholder="Threshold (KAS)"
                placeholderTextColor={colors.muted}
                value={delayThreshold}
                onChangeText={setDelayThreshold}
                keyboardType="numeric"
              />
              <TextInput
                style={styles.input}
                placeholder="Delay (hours, 1-168)"
                placeholderTextColor={colors.muted}
                value={delayHours}
                onChangeText={setDelayHours}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => {
                  const threshold = parseFloat(delayThreshold);
                  const hours = parseInt(delayHours, 10);
                  if (isNaN(threshold) || threshold <= 0) {
                    Alert.alert("Invalid Threshold", "Enter a positive KAS amount.");
                    return;
                  }
                  if (isNaN(hours) || hours < 1 || hours > 168) {
                    Alert.alert("Invalid Delay", "Delay must be 1-168 hours.");
                    return;
                  }
                  const sf = { ...(store.securityFeatures!) };
                  sf.timeDelay = {
                    enabled: true,
                    thresholdKas: threshold,
                    delayHours: hours,
                  };
                  persistSecurityFeatures(sf);
                  Alert.alert("Saved", "Time-delay configured.");
                }}
              >
                <Text style={styles.smallButtonText}>Save Delay Config</Text>
              </TouchableOpacity>
            </View>
          )}
        </Section>

        {/* Address Book */}
        <Section title="Address Book">
          {(store.addressBook?.entries || []).map((c: any, i: number) => (
            <View key={i} style={styles.contactRow}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>
                  {c.label.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>{c.label}</Text>
                <Text style={styles.contactAddr}>
                  {c.address.slice(0, 14)}...{c.address.slice(-8)}
                </Text>
              </View>
            </View>
          ))}
          <View style={styles.divider} />
          <Text style={styles.label}>ADD CONTACT</Text>
          <TextInput
            style={styles.input}
            placeholder="kaspa:..."
            placeholderTextColor={colors.muted}
            value={newContactAddr}
            onChangeText={setNewContactAddr}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Label"
            placeholderTextColor={colors.muted}
            value={newContactLabel}
            onChangeText={setNewContactLabel}
          />
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => {
              if (!newContactAddr || !newContactLabel) {
                Alert.alert("Error", "Fill in both fields.");
                return;
              }
              if (!isValidKaspaAddress(newContactAddr)) {
                Alert.alert(
                  "Invalid Address",
                  "Enter a valid Kaspa address (kaspa:... or kaspatest:...)."
                );
                return;
              }
              const current = store.addressBook?.entries || [];
              if (current.some((c: any) => c.address === newContactAddr)) {
                Alert.alert("Duplicate", "This address is already in your contacts.");
                return;
              }
              const now = Date.now();
              persistAddressBook({
                entries: [
                  ...current,
                  {
                    id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
                    address: newContactAddr,
                    label: newContactLabel,
                    createdAt: now,
                    updatedAt: now,
                  },
                ],
              });
              setNewContactAddr("");
              setNewContactLabel("");
              Alert.alert("Added", "Contact saved.");
            }}
          >
            <Text style={styles.smallButtonText}>Add</Text>
          </TouchableOpacity>
        </Section>

        {/* About */}
        <Section title="About">
          <Text style={styles.aboutText}>
            NoXu Wallet — Security-first, non-custodial Kaspa wallet.
          </Text>
          <View style={styles.aboutList}>
            <Text style={styles.aboutDetail}>Keys never leave your device</Text>
            <Text style={styles.aboutDetail}>No analytics or tracking</Text>
            <Text style={styles.aboutDetail}>
              Only connects to Kaspa RPC for balances/transactions
            </Text>
            <Text style={styles.aboutDetail}>
              Cannot recover wallet — backup your seed phrase
            </Text>
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    paddingVertical: 18,
  },
  sectionTitle: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.bold,
    color: colors.text,
  },
  chevron: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
  },
  sectionContent: {
    padding: spacing.md,
    paddingTop: 0,
    gap: spacing.sm,
  },
  label: {
    fontSize: fonts.sizes.xxs,
    fontWeight: fonts.weights.bold,
    color: colors.muted,
    letterSpacing: 1.2,
    marginTop: spacing.xs,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fonts.sizes.sm,
    color: colors.text,
  },
  smallButton: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.full,
    paddingVertical: 12,
    alignItems: "center",
  },
  smallButtonText: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },
  seedBox: {
    backgroundColor: colors.bg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  seedWords: {
    fontSize: fonts.sizes.sm,
    color: colors.text,
    lineHeight: 22,
  },
  seedCopyBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.accentSoft,
    borderRadius: radii.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  seedCopyText: {
    fontSize: fonts.sizes.xs,
    color: colors.accent,
    fontWeight: fonts.weights.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  outlineButton: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 14,
    alignItems: "center",
  },
  outlineButtonText: {
    fontSize: fonts.sizes.sm,
    color: colors.text,
    fontWeight: fonts.weights.semibold,
  },
  dangerButton: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.full,
    paddingVertical: 14,
    alignItems: "center",
  },
  dangerButtonText: {
    fontSize: fonts.sizes.sm,
    color: colors.danger,
    fontWeight: fonts.weights.semibold,
  },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  toggle: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  toggleText: {
    fontSize: fonts.sizes.sm,
    color: colors.muted,
    fontWeight: fonts.weights.medium,
  },
  toggleTextActive: {
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  settingLabel: {
    fontSize: fonts.sizes.sm,
    color: colors.text,
    fontWeight: fonts.weights.medium,
  },
  autoLockOptions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  autoLockChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  autoLockChipActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  autoLockChipText: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    fontWeight: fonts.weights.medium,
  },
  autoLockChipTextActive: {
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },
  subsection: {
    gap: spacing.sm,
    paddingLeft: spacing.sm,
    marginBottom: spacing.sm,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  contactAvatarText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.bold,
    color: colors.accent,
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactLabel: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.text,
  },
  contactAddr: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    fontFamily: "monospace",
  },
  aboutText: {
    fontSize: fonts.sizes.sm,
    color: colors.text,
    fontWeight: fonts.weights.medium,
    marginBottom: spacing.sm,
  },
  aboutList: {
    gap: spacing.xs,
  },
  aboutDetail: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    lineHeight: 20,
    paddingLeft: spacing.sm,
  },
});
