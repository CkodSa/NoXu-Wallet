import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { KAS_LOGO_URL } from "@noxu/core";
import { useWalletStore, type TokenBalance } from "../../store";
import { useWalletService } from "../../hooks/useWalletService";
import { colors, fonts, spacing, radii, shadows } from "../../theme";
import type { MainTabScreenProps } from "../../navigation/types";

type Props = MainTabScreenProps<"Send">;

export default function SendScreen({ route }: Props) {
  const nav = useNavigation();
  const canGoBack = nav.canGoBack();
  const { balance, tokenBalances, kasPrice, addressBook, account } =
    useWalletStore();
  const { sendTransaction, sendKRC20Transfer } = useWalletService();

  const [selectedToken, setSelectedToken] = useState<string>(
    route?.params?.token || "KAS"
  );
  const [recipient, setRecipient] = useState(route?.params?.to || "");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const isKas = selectedToken === "KAS";

  // Token icon renderer: image for KAS, letter fallback for KRC-20
  const renderTokenIcon = (symbol: string, size = 36) => {
    if (symbol === "KAS") {
      return (
        <Image
          source={{ uri: KAS_LOGO_URL }}
          style={[styles.tokenSelectorIcon, { width: size, height: size, borderRadius: size / 2 }]}
        />
      );
    }
    return (
      <LinearGradient
        colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.tokenSelectorIcon, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Text style={styles.tokenSelectorIconText}>
          {symbol.charAt(0).toUpperCase()}
        </Text>
      </LinearGradient>
    );
  };
  const selectedTokenBalance = useMemo(() => {
    if (isKas) return balance ?? 0;
    const t = tokenBalances?.find((tb) => tb.tick === selectedToken);
    return t ? parseFloat(t.balance) : 0;
  }, [selectedToken, balance, tokenBalances]);

  const fiatEquivalent = useMemo(() => {
    if (!isKas || !kasPrice) return null;
    const amt = parseFloat(amount) || 0;
    return (amt * kasPrice).toFixed(2);
  }, [amount, kasPrice, isKas]);

  const handleMax = () => {
    if (isKas) {
      const max = Math.max(0, (balance || 0) - 0.001);
      setAmount(max.toString());
    } else {
      setAmount(selectedTokenBalance.toString());
    }
  };

  const handleReview = () => {
    if (!recipient.startsWith("kaspa:")) {
      Alert.alert("Invalid Address", "Enter a valid Kaspa address.");
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      Alert.alert("Invalid Amount", "Enter a valid amount.");
      return;
    }
    if (amt > selectedTokenBalance) {
      Alert.alert("Insufficient Balance", "Amount exceeds your balance.");
      return;
    }
    setShowConfirm(true);
  };

  const handleSend = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      if (isKas) {
        // Parse amount string to sompi without floating point — split on
        // decimal to avoid precision loss (e.g. 0.12345678 * 1e8 != 12345678)
        const parts = amount.split(".");
        const whole = BigInt(parts[0] || "0") * 100_000_000n;
        const fracStr = (parts[1] || "").padEnd(8, "0").slice(0, 8);
        const sompi = whole + BigInt(fracStr);
        await sendTransaction(recipient, sompi);
        Alert.alert("Success", "Transaction sent!");
        setAmount("");
        setRecipient("");
      } else {
        const token = tokenBalances?.find((tb) => tb.tick === selectedToken);
        if (!token) {
          Alert.alert("Error", "Token not found.");
          return;
        }
        const result = await sendKRC20Transfer(
          recipient,
          selectedToken,
          amount,
          token.decimals,
        );
        if (result.success) {
          Alert.alert(
            "Success",
            `KRC-20 transfer sent!\nCommit: ${result.commitTxId?.slice(0, 12)}...\nReveal: ${result.revealTxId?.slice(0, 12)}...`,
          );
          setAmount("");
          setRecipient("");
        } else {
          Alert.alert("Error", result.error || "KRC-20 transfer failed.");
        }
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Transaction failed.");
    } finally {
      setLoading(false);
    }
  };

  const contacts = addressBook?.entries || [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {canGoBack && (
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>{"< Back"}</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Send</Text>

        {/* Token Selector — extension-style card */}
        <TouchableOpacity
          style={styles.tokenSelector}
          onPress={() => setShowTokenPicker(true)}
          activeOpacity={0.7}
        >
          <View style={styles.tokenSelectorLeft}>
            {renderTokenIcon(selectedToken)}
            <View>
              <Text style={styles.tokenSelectorName}>{selectedToken}</Text>
              <Text style={styles.tokenSelectorBal}>
                Balance: {selectedTokenBalance.toLocaleString()}
                {isKas ? " KAS" : ""}
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>▼</Text>
        </TouchableOpacity>

        {/* Amount Area — extension-style large input card */}
        <View style={styles.amountCard}>
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              placeholder="0"
              placeholderTextColor="rgba(148, 163, 184, 0.3)"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />
            <Text style={styles.amountSuffix}>{selectedToken}</Text>
          </View>
          <View style={styles.amountFooter}>
            {fiatEquivalent ? (
              <Text style={styles.fiatHint}>≈ ${fiatEquivalent}</Text>
            ) : (
              <View />
            )}
            <TouchableOpacity style={styles.maxButton} onPress={handleMax}>
              <Text style={styles.maxText}>MAX</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recipient — pill input */}
        <View style={styles.recipientHeader}>
          <Text style={styles.label}>Recipient</Text>
          <View style={styles.recipientActions}>
            <TouchableOpacity
              onPress={async () => {
                if (!cameraPermission?.granted) {
                  const result = await requestCameraPermission();
                  if (!result.granted) {
                    Alert.alert("Permission Required", "Camera access is needed to scan QR codes.");
                    return;
                  }
                }
                setShowScanner(true);
              }}
            >
              <Text style={styles.contactsLink}>Scan QR</Text>
            </TouchableOpacity>
            {contacts.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowContactPicker(true)}
              >
                <Text style={styles.contactsLink}>Contacts</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <TextInput
          style={styles.input}
          placeholder="kaspa:..."
          placeholderTextColor="rgba(148, 163, 184, 0.7)"
          value={recipient}
          onChangeText={setRecipient}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Review Button — gradient pill */}
        <TouchableOpacity
          onPress={handleReview}
          disabled={!amount || !recipient || loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              !amount || !recipient || loading
                ? ["rgba(110, 199, 187, 0.3)", "rgba(143, 228, 217, 0.3)"]
                : [colors.gradientAccentStart, colors.gradientAccentEnd]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.reviewButton, shadows.buttonGlow]}
          >
            {loading ? (
              <ActivityIndicator color={colors.accentDark} />
            ) : (
              <Text style={styles.reviewButtonText}>Review Transaction</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Confirm Modal — extension-style elevated card with glow */}
      <Modal
        visible={showConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, shadows.glow]}>
            <Text style={styles.modalTitle}>Confirm Transaction</Text>

            <View style={styles.confirmSection}>
              <Text style={styles.confirmLabel}>AMOUNT</Text>
              <Text style={styles.confirmAmount}>
                {amount} {selectedToken}
              </Text>
            </View>
            <View style={styles.confirmSection}>
              <Text style={styles.confirmLabel}>TO</Text>
              <Text style={styles.confirmAddress} numberOfLines={2}>
                {recipient}
              </Text>
            </View>
            {isKas && (
              <View style={styles.confirmSection}>
                <Text style={styles.confirmLabel}>NETWORK FEE</Text>
                <Text style={styles.confirmValue}>~0.00001 KAS</Text>
              </View>
            )}

            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                Transactions are irreversible. Verify the address carefully.
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirm(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSend} activeOpacity={0.8}>
                <LinearGradient
                  colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmButton}
                >
                  <Text style={styles.confirmText}>Confirm & Send</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Token Picker Modal */}
      <Modal
        visible={showTokenPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTokenPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Select Token</Text>
            <ScrollView bounces={false}>
            <TouchableOpacity
              style={styles.pickerItem}
              onPress={() => {
                setSelectedToken("KAS");
                setShowTokenPicker(false);
              }}
            >
              <View style={styles.pickerItemLeft}>
                {renderTokenIcon("KAS", 28)}
                <Text style={styles.pickerItemName}>KAS</Text>
              </View>
              <Text style={styles.pickerItemBal}>
                {(balance || 0).toLocaleString()}
              </Text>
            </TouchableOpacity>
            {(tokenBalances || []).map((t) => (
              <TouchableOpacity
                key={t.tick}
                style={styles.pickerItem}
                onPress={() => {
                  setSelectedToken(t.tick);
                  setShowTokenPicker(false);
                }}
              >
                <View style={styles.pickerItemLeft}>
                  {renderTokenIcon(t.tick, 28)}
                  <View>
                    <Text style={styles.pickerItemName}>{t.tick}</Text>
                    <Text style={styles.pickerItemBadge}>KRC-20</Text>
                  </View>
                </View>
                <Text style={styles.pickerItemBal}>
                  {parseFloat(t.balance).toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerClose}
              onPress={() => setShowTokenPicker(false)}
            >
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contact Picker Modal */}
      <Modal
        visible={showContactPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContactPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Address Book</Text>
            {contacts.map((c: any) => (
              <TouchableOpacity
                key={c.address}
                style={styles.pickerItem}
                onPress={() => {
                  setRecipient(c.address);
                  setShowContactPicker(false);
                }}
              >
                <View>
                  <Text style={styles.pickerItemName}>{c.label}</Text>
                  <Text style={styles.pickerItemBal}>
                    {c.address.slice(0, 14)}...{c.address.slice(-8)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.pickerClose}
              onPress={() => setShowContactPicker(false)}
            >
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* QR Scanner Modal */}
      <Modal
        visible={showScanner}
        animationType="slide"
        onRequestClose={() => setShowScanner(false)}
      >
        <View style={styles.scannerContainer}>
          <CameraView
            style={styles.scanner}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={(result) => {
              if (result.data) {
                let address = result.data;
                // Strip "kaspa:" URI scheme prefix if duplicated
                if (address.startsWith("kaspa:kaspa:")) {
                  address = address.replace("kaspa:kaspa:", "kaspa:");
                }
                setRecipient(address);
                setShowScanner(false);
              }
            }}
          />
          <SafeAreaView style={styles.scannerOverlay}>
            <Text style={styles.scannerTitle}>Scan Kaspa Address</Text>
            <View style={styles.scannerFrame} />
            <TouchableOpacity
              style={styles.scannerClose}
              onPress={() => setShowScanner(false)}
            >
              <Text style={styles.scannerCloseText}>Cancel</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.md,
  },
  backButton: {
    marginBottom: spacing.xs,
  },
  backText: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontWeight: fonts.weights.semibold,
  },
  title: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
    letterSpacing: 0.3,
  },

  // Token selector — extension style card
  tokenSelector: {
    backgroundColor: colors.cardStrong,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  tokenSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tokenSelectorIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenSelectorIconText: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.extrabold,
    color: colors.accentDark,
  },
  tokenSelectorName: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.text,
  },
  tokenSelectorBal: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    marginTop: 2,
  },
  chevron: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
  },

  // Amount card — extension style
  amountCard: {
    backgroundColor: colors.cardStrong,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: fonts.sizes.amountInput,
    fontWeight: fonts.weights.bold,
    color: colors.text,
    textAlign: "right",
    padding: 0,
  },
  amountSuffix: {
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.semibold,
    color: colors.muted,
  },
  amountFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  fiatHint: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
  },
  maxButton: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: "rgba(110, 199, 187, 0.3)",
    backgroundColor: "rgba(110, 199, 187, 0.1)",
  },
  maxText: {
    fontSize: fonts.sizes.xxs,
    fontWeight: fonts.weights.bold,
    color: colors.accent,
    letterSpacing: 0.5,
  },

  // Recipient
  label: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.medium,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  recipientHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  recipientActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  contactsLink: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontWeight: fonts.weights.medium,
  },
  input: {
    backgroundColor: colors.cardInner,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: fonts.sizes.sm,
    color: colors.text,
  },

  // Review button — gradient pill
  reviewButton: {
    borderRadius: radii.full,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  reviewButtonText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.accentDark,
  },

  // Confirm modal — extension style
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "center",
    padding: spacing.md,
  },
  modalCard: {
    backgroundColor: colors.cardStrong,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.text,
  },
  confirmSection: {
    gap: 4,
  },
  confirmLabel: {
    fontSize: fonts.sizes.xs,
    color: colors.muted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  confirmAmount: {
    fontSize: 20,
    fontWeight: fonts.weights.bold,
    color: colors.accent,
  },
  confirmAddress: {
    fontSize: fonts.sizes.sm,
    color: colors.text,
    fontFamily: "monospace",
  },
  confirmValue: {
    fontSize: 14,
    fontWeight: fonts.weights.semibold,
    color: colors.text,
  },
  warningBanner: {
    backgroundColor: colors.warningSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    padding: spacing.sm,
  },
  warningText: {
    fontSize: fonts.sizes.xs,
    color: colors.warning,
    textAlign: "center",
    lineHeight: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.6)",
    borderRadius: radii.full,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.cardInner,
  },
  cancelText: {
    fontSize: fonts.sizes.sm,
    color: colors.text,
    fontWeight: fonts.weights.semibold,
  },
  confirmButton: {
    flex: 1,
    borderRadius: radii.full,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  confirmText: {
    fontSize: fonts.sizes.sm,
    color: colors.accentDark,
    fontWeight: fonts.weights.semibold,
  },

  // Picker modals
  pickerCard: {
    backgroundColor: colors.cardStrong,
    borderRadius: radii.xl,
    padding: spacing.lg,
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  pickerTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  pickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  pickerItemName: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: colors.text,
  },
  pickerItemBadge: {
    fontSize: fonts.sizes.xxs,
    color: colors.accent,
    marginTop: 2,
  },
  pickerItemBal: {
    fontSize: fonts.sizes.sm,
    color: colors.muted,
  },
  pickerClose: {
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  pickerCloseText: {
    fontSize: fonts.sizes.sm,
    color: colors.accent,
    fontWeight: fonts.weights.semibold,
  },

  // QR Scanner
  scannerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  scanner: {
    flex: 1,
  },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 60,
  },
  scannerTitle: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  scannerFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radii.lg,
  },
  scannerClose: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  scannerCloseText: {
    fontSize: fonts.sizes.sm,
    fontWeight: fonts.weights.semibold,
    color: "#fff",
  },
});
