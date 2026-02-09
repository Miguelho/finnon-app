import { View, StyleSheet, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "../../../src/components/Button";
import { useCopy, t } from "../../../src/lib/i18n";
import { OnboardingSurface } from "./OnboardingSurface";
import { onboardingColors, onboardingRadii } from "./onboarding-theme";

interface WelcomeStepProps {
  onContinue: () => void;
  showInvite?: boolean;
}

export function WelcomeStep({ onContinue, showInvite = true }: WelcomeStepProps) {
  const { dictionary } = useCopy();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <OnboardingSurface style={styles.surface}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>🏠</Text>
          </View>
          <Text style={styles.title}>{t(dictionary, "onboarding.welcome.title")}</Text>
          <Text style={styles.subtitle}>
            {t(dictionary, "onboarding.welcome.subtitle")}
          </Text>

          <View style={styles.list}>
            {[
              {
                title: t(dictionary, "onboarding.welcome.step1"),
                desc: t(dictionary, "onboarding.welcome.step1Desc"),
              },
              {
                title: t(dictionary, "onboarding.welcome.step2"),
                desc: t(dictionary, "onboarding.welcome.step2Desc"),
              },
              {
                title: t(dictionary, "onboarding.welcome.step3"),
                desc: t(dictionary, "onboarding.welcome.step3Desc"),
              },
            ].map((item, index) => (
              <View key={item.title} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{item.title}</Text>
                  <Text style={styles.stepDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <Text style={styles.timeText}>
            ⏱ {t(dictionary, "onboarding.welcome.timeEstimate")}
          </Text>

          <View style={styles.actions}>
            <Button
              title={t(dictionary, "onboarding.welcome.start")}
              onPress={onContinue}
            />
            {showInvite && (
              <Button
                title={t(dictionary, "onboarding.inviteCta")}
                onPress={() => router.push("/(auth)/invitations")}
                variant="secondary"
              />
            )}
          </View>
        </OnboardingSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: onboardingColors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  surface: {
    alignItems: "center",
    textAlign: "center",
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: onboardingRadii.md,
    backgroundColor: onboardingColors.dark,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconText: {
    fontSize: 24,
    color: onboardingColors.white,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: onboardingColors.text,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    color: onboardingColors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    marginTop: 20,
    width: "100%",
    gap: 14,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: onboardingColors.border,
    backgroundColor: onboardingColors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: "600",
    color: onboardingColors.textSecondary,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: onboardingColors.text,
  },
  stepDesc: {
    fontSize: 12,
    color: onboardingColors.textSecondary,
    marginTop: 2,
  },
  timeText: {
    marginTop: 16,
    fontSize: 12,
    color: onboardingColors.textMuted,
    marginBottom: 16,
  },
  actions: {
    width: "100%",
    gap: 10,
  },
});
