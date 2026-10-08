import { useState } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet, Share } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";

export default function RecoveryCodeScreen({ code, onContinue }) {
  const { theme } = useTheme();
  const [shared, setShared] = useState(false);

  async function shareCode() {
    try {
      await Share.share({ title: "LifeTracker Recovery Code", message: `LifeTracker recovery code:\n\n${code}\n\nKeep this code somewhere safe. Anyone with it can restore the encrypted LifeTracker backup.` });
      setShared(true);
    } catch {}
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <LinearGradient colors={theme.headerGradient} style={styles.iconCircle}>
          <Ionicons name="shield-checkmark" size={38} color={theme.headerText} />
        </LinearGradient>
        <ThemedText style={styles.title}>Save your recovery code</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.subText }]}>This is the only recovery key LifeTracker uses to restore your private encrypted data on a new device.</ThemedText>
        <View style={[styles.codeCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}> 
          <ThemedText selectable style={styles.code}>{code}</ThemedText>
        </View>
        <TouchableOpacity onPress={shareCode} style={[styles.secondary, { borderColor: theme.cardBorder }]}> 
          <ThemedText style={{ fontWeight: "800" }}>{shared ? "Recovery Code Shared" : "Save / Share Recovery Code"}</ThemedText>
        </TouchableOpacity>
        <ThemedText style={[styles.warning, { color: theme.subText }]}>Do not send this code to anyone you do not trust. LifeTracker cannot recover your encrypted personal data if both your password and recovery code are lost.</ThemedText>
        <TouchableOpacity onPress={onContinue} style={{ marginTop: 18 }}>
          <LinearGradient colors={theme.headerGradient} style={styles.button}>
            <ThemedText style={[styles.buttonText, { color: theme.headerText }]}>I Saved My Recovery Code</ThemedText>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 24 },
  iconCircle: { width: 88, height: 88, borderRadius: 44, alignSelf: "center", justifyContent: "center", alignItems: "center", marginBottom: 18 },
  title: { fontSize: 25, fontWeight: "800", textAlign: "center" },
  subtitle: { textAlign: "center", lineHeight: 21, marginTop: 8, marginBottom: 20 },
  codeCard: { borderWidth: 1, borderRadius: 14, padding: 18, marginBottom: 12 },
  code: { fontSize: 15, fontWeight: "800", lineHeight: 26, textAlign: "center", letterSpacing: 1 },
  secondary: { padding: 15, borderRadius: 14, alignItems: "center", borderWidth: 1 },
  warning: { textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: 16 },
  button: { padding: 16, borderRadius: 14, alignItems: "center" },
  buttonText: { fontWeight: "800", fontSize: 16 },
});
