import { useState, useEffect } from "react";
import {
  Platform,
  View,
  TextInput,
  TouchableOpacity,
  Switch,
  ScrollView,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import * as Crypto from "expo-crypto";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import { loginUser, getStoredUser } from "./api";

async function getSecureItem(key) {
  if (Platform.OS === "web") {
    return localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function setSecureItem(key, value) {
  if (Platform.OS === "web") {
    localStorage.setItem(key, value);
    return;
  }

  return SecureStore.setItemAsync(key, value);
}

async function deleteSecureItem(key) {
  if (Platform.OS === "web") {
    localStorage.removeItem(key);
    return;
  }

  return SecureStore.deleteItemAsync(key);
}

// Turn the password into a scrambled value, so the real password is never saved
async function makeHash(salt, password) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + password);
}

export default function LockScreen({ onUnlock }) {
  const { theme } = useTheme();
  const [mode, setMode] = useState("loading"); // "loading", "setup", "login" or "reset"
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [useFingerprint, setUseFingerprint] = useState(true);
  const [fingerprintReady, setFingerprintReady] = useState(false); // phone has a fingerprint set up
  const [fingerprintOn, setFingerprintOn] = useState(false); // user chose to use it in this app
  const [error, setError] = useState("");

  useEffect(() => {
    start();
  }, []);

  async function start() {
    const hardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const ready = hardware && enrolled;
    setFingerprintReady(ready);

    const savedHash = await getSecureItem("passwordHash");
    if (!savedHash) {
      setMode("setup"); // first time: create a password
      return;
    }

    const enabled = (await getSecureItem("fingerprintEnabled")) === "yes";
    setFingerprintOn(ready && enabled);
    setMode("login");
    if (ready && enabled) tryFingerprint();
  }

   async function tryFingerprint() {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock LifeTracker",
      disableDeviceFallback: true, // no phone PIN or pattern as a backup
      cancelLabel: "Use password", // the button under the fingerprint prompt
    });
    if (result.success) onUnlock();
  }

  async function createPassword() {
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    const salt = Crypto.randomUUID();
    const hash = await makeHash(salt, password);
    await setSecureItem("passwordSalt", salt);
    await setSecureItem("passwordHash", hash);
    await setSecureItem(
      "fingerprintEnabled",
      useFingerprint && fingerprintReady ? "yes" : "no"
    );
    onUnlock();
  }

  async function checkPassword() {
    const salt = await getSecureItem("passwordSalt");
    const savedHash = await getSecureItem("passwordHash");
    const hash = await makeHash(salt, password);

    if (hash === savedHash) {
      onUnlock();
    } else {
      setError("Wrong password");
      setPassword("");
    }
  }

  // Forgot the app lock password: prove it is you with your ACCOUNT password,
  // then choose a new app lock password. Your data is not touched.
  async function verifyAccount() {
    if (!password) {
      setError("Enter your account password");
      return;
    }
    setBusy(true);
    try {
      const user = await getStoredUser();
      await loginUser({ identifier: user?.username || user?.email || "", password });
      await deleteSecureItem("passwordHash");
      await deleteSecureItem("passwordSalt");
      setPassword("");
      setConfirm("");
      setError("");
      setMode("setup");
    } catch (e) {
      setError(e.message || "Could not check your account password");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder },
  ];

  if (mode === "loading") {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <LinearGradient colors={theme.headerGradient} style={styles.lockCircle}>
          <Ionicons name="lock-closed" size={44} color={theme.headerText} />
        </LinearGradient>

        <ThemedText style={styles.title}>
          {mode === "setup" ? "Create a password" : mode === "reset" ? "Reset app password" : "Welcome back"}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.subText }]}>
          {mode === "setup"
            ? "This keeps your expenses, notes and events private"
            : mode === "reset"
            ? "Enter your LifeTracker account password to set a new app password"
            : "Unlock to open LifeTracker"}
        </ThemedText>

        <TextInput
          style={inputStyle}
          placeholder={mode === "reset" ? "Account password" : "Password"}
          placeholderTextColor={theme.subText}
          secureTextEntry
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setError("");
          }}
        />

        {mode === "setup" && (
          <>
            <TextInput
              style={inputStyle}
              placeholder="Confirm password"
              placeholderTextColor={theme.subText}
              secureTextEntry
              value={confirm}
              onChangeText={(text) => {
                setConfirm(text);
                setError("");
              }}
            />

            {fingerprintReady ? (
              <View style={styles.switchRow}>
                <ThemedText>Use fingerprint to unlock</ThemedText>
                <Switch
                  value={useFingerprint}
                  onValueChange={setUseFingerprint}
                  trackColor={{ true: theme.primary }}
                />
              </View>
            ) : (
              <ThemedText style={[styles.note, { color: theme.subText }]}>
                No fingerprint is set up on this phone, so only the password will be used.
              </ThemedText>
            )}
          </>
        )}

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <TouchableOpacity
          disabled={busy}
          onPress={mode === "setup" ? createPassword : mode === "reset" ? verifyAccount : checkPassword}
        >
          <LinearGradient colors={theme.headerGradient} style={styles.button}>
            <ThemedText style={[styles.buttonText, { color: theme.headerText }]}>
              {mode === "setup" ? "Save & Continue" : mode === "reset" ? "Verify & Continue" : "Unlock"}
            </ThemedText>
          </LinearGradient>
        </TouchableOpacity>

        {mode === "login" && (
          <TouchableOpacity
            style={styles.fingerprintButton}
            onPress={() => {
              setMode("reset");
              setPassword("");
              setError("");
            }}
          >
            <ThemedText style={{ color: theme.primary }}>Forgot app password?</ThemedText>
          </TouchableOpacity>
        )}

        {mode === "reset" && (
          <TouchableOpacity
            style={styles.fingerprintButton}
            onPress={() => {
              setMode("login");
              setPassword("");
              setError("");
            }}
          >
            <ThemedText style={{ color: theme.primary }}>Back</ThemedText>
          </TouchableOpacity>
        )}

        {mode === "login" && fingerprintOn && (
          <TouchableOpacity style={styles.fingerprintButton} onPress={tryFingerprint}>
            <Ionicons name="finger-print" size={52} color={theme.primary} />
            <ThemedText style={{ color: theme.subText }}>Use fingerprint</ThemedText>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 24 },
  lockCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: "bold", textAlign: "center" },
  subtitle: { textAlign: "center", marginTop: 6, marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  note: { marginBottom: 12, fontSize: 13 },
  error: { color: "#E53935", marginBottom: 10, textAlign: "center" },
  button: { padding: 16, borderRadius: 14, alignItems: "center", marginTop: 4 },
  buttonText: { fontWeight: "bold", fontSize: 16 },
  fingerprintButton: { alignItems: "center", marginTop: 28 },
});