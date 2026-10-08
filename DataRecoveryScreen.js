import { useState } from "react";
import { View, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import { cloudPull } from "./api";
import { restoreVaultFromRecovery } from "./cryptoVault";
import { backgroundSync } from "./sync";

export default function DataRecoveryScreen({ onRecovered }) {
  const { theme } = useTheme();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function restore() {
    setError("");
    if (!code.trim()) return setError("Enter your recovery code.");
    setBusy(true);
    try {
      const remote = await cloudPull();
      if (!remote.data || !remote.recoveryWrappedKey) throw new Error("No private backup was found for this account.");
      await restoreVaultFromRecovery(code, remote.recoveryWrappedKey);
      await backgroundSync();
      onRecovered();
    } catch (e) {
      setError(e.message?.includes("OperationError") ? "That recovery code is incorrect." : (e.message || "Unable to restore your private data."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={theme.headerGradient} style={styles.iconCircle}>
          <Ionicons name="key" size={38} color={theme.headerText} />
        </LinearGradient>
        <ThemedText style={styles.title}>Restore your private data</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.subText }]}>This device does not have your encryption key. Enter the recovery code you saved when you created your LifeTracker account.</ThemedText>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder }]}
          placeholder="Recovery code"
          placeholderTextColor={theme.subText}
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
        />
        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
        <TouchableOpacity disabled={busy} onPress={restore}>
          <LinearGradient colors={theme.headerGradient} style={styles.button}>
            {busy ? <ActivityIndicator color={theme.headerText} /> : <ThemedText style={[styles.buttonText, { color: theme.headerText }]}>Restore Data</ThemedText>}
          </LinearGradient>
        </TouchableOpacity>
        <ThemedText style={[styles.warning, { color: theme.subText }]}>Your recovery code is never sent to the LifeTracker server. It is used only on this device to unlock your encrypted backup.</ThemedText>
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
  input: { minHeight: 100, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15, marginBottom: 10 },
  button: { padding: 16, borderRadius: 14, alignItems: "center" },
  buttonText: { fontWeight: "800", fontSize: 16 },
  error: { color: "#E53935", marginBottom: 10, textAlign: "center" },
  warning: { textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: 18 },
});
