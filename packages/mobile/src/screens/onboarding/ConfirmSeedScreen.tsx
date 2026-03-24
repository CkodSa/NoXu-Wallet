import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { OnboardingScreenProps } from "../../navigation/types";
import { colors, fonts, spacing, radii, shadows } from "../../theme";

function pickRandomIndices(total: number, count: number): number[] {
  const indices: number[] = [];
  while (indices.length < count) {
    const i = Math.floor(Math.random() * total);
    if (!indices.includes(i)) indices.push(i);
  }
  return indices.sort((a, b) => a - b);
}

export default function ConfirmSeedScreen({
  navigation,
  route,
}: OnboardingScreenProps<"ConfirmSeed">) {
  const { mnemonic } = route.params;
  const words = mnemonic.split(" ");

  const challenge = useMemo(() => {
    const indices = pickRandomIndices(words.length, 3);
    return indices.map((i) => ({
      index: i,
      word: words[i],
      options: generateOptions(words[i], words),
    }));
  }, [mnemonic]);

  const [answers, setAnswers] = useState<(string | null)[]>([null, null, null]);

  const handleSelect = (questionIdx: number, word: string) => {
    const next = [...answers];
    next[questionIdx] = word;
    setAnswers(next);
  };

  const handleVerify = () => {
    const allCorrect = challenge.every(
      (c, i) => answers[i] === c.word
    );
    if (allCorrect) {
      Alert.alert("Success", "Seed phrase verified! Your wallet is ready.", [
        { text: "Continue", onPress: () => {} },
      ]);
    } else {
      Alert.alert(
        "Incorrect",
        "One or more words are wrong. Please try again."
      );
      setAnswers([null, null, null]);
    }
  };

  const allAnswered = answers.every((a) => a !== null);

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.backButton}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Verify Seed Phrase</Text>
      <Text style={styles.subtitle}>
        Select the correct word for each position to confirm you've saved your
        seed phrase.
      </Text>

      <View style={styles.questions}>
        {challenge.map((q, qi) => (
          <View key={qi} style={styles.question}>
            <Text style={styles.questionLabel}>WORD #{q.index + 1}</Text>
            <View style={styles.optionsRow}>
              {q.options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.option,
                    answers[qi] === opt && styles.optionSelected,
                  ]}
                  onPress={() => handleSelect(qi, opt)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionText,
                      answers[qi] === opt && styles.optionTextSelected,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        onPress={handleVerify}
        disabled={!allAnswered}
        activeOpacity={0.8}
        style={[styles.verifyOuter, !allAnswered && { opacity: 0.4 }, shadows.buttonGlow]}
      >
        <LinearGradient
          colors={[colors.gradientAccentStart, colors.gradientAccentEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.verifyButton}
        >
          <Text style={styles.verifyButtonText}>Verify</Text>
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function generateOptions(correct: string, allWords: string[]): string[] {
  const others = allWords.filter((w) => w !== correct);
  const shuffled = others.sort(() => Math.random() - 0.5);
  const options = [correct, shuffled[0], shuffled[1], shuffled[2]];
  return options.sort(() => Math.random() - 0.5);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  backButton: {
    color: colors.accent,
    fontSize: fonts.sizes.md,
    fontWeight: fonts.weights.medium,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fonts.sizes.xxl,
    fontWeight: fonts.weights.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fonts.sizes.md,
    color: colors.muted,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  questions: {
    gap: spacing.xl,
  },
  question: {
    gap: spacing.sm,
  },
  questionLabel: {
    fontSize: fonts.sizes.xxs,
    fontWeight: fonts.weights.bold,
    color: colors.textSecondary,
    letterSpacing: 1.2,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  option: {
    backgroundColor: colors.card,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  optionSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionText: {
    fontSize: fonts.sizes.md,
    color: colors.muted,
    fontWeight: fonts.weights.medium,
  },
  optionTextSelected: {
    color: colors.accent,
    fontWeight: fonts.weights.bold,
  },
  verifyOuter: {
    borderRadius: radii.full,
    marginTop: spacing.lg,
  },
  verifyButton: {
    borderRadius: radii.full,
    paddingVertical: 18,
    alignItems: "center",
  },
  verifyButtonText: {
    fontSize: fonts.sizes.lg,
    fontWeight: fonts.weights.bold,
    color: colors.accentDark,
  },
});
