import { useEffect, useState } from "react";
import { View, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import { registerUser, loginUser, forgotPassword, resetPassword } from "./api";

export default function AuthScreen({ onAuthenticated }) {
  const { theme } = useTheme();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [usernameFieldName] = useState(() => `lt_username_${Math.random().toString(36).slice(2)}`);
  const [emailFieldName] = useState(() => `lt_email_${Math.random().toString(36).slice(2)}`);
  const [passwordFieldName] = useState(() => `lt_password_${Math.random().toString(36).slice(2)}`);
  const [confirmFieldName] = useState(() => `lt_confirm_${Math.random().toString(36).slice(2)}`);
  const [codeFieldName] = useState(() => `lt_code_${Math.random().toString(36).slice(2)}`);

  const inputStyle = [styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.cardBorder }];
  const clear = () => { setError(""); setMessage(""); };
  const clearAllFields = () => {
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirm("");
    setCode("");
    clear();
  };

  useEffect(() => {
    clearAllFields();
  }, [mode]);

  async function submit() {
    clear();
    if (!email.trim() && mode !== "login") return setError("Enter your email address");
    if (mode === "register" && username.trim().length < 3) return setError("Username must be at least 3 characters");
    if (password.length < 8) return setError("Password must be at least 8 characters");
    if (mode === "register" && password !== confirm) return setError("Passwords do not match");
    setBusy(true);
    try {
      const result = mode === "register"
        ? await registerUser({ username: username.trim(), email: email.trim(), password })
        : await loginUser({ identifier: username.trim() || email.trim(), password });
      onAuthenticated(result);
    } catch (e) {
      setError(e.message || "Unable to continue");
    } finally { setBusy(false); }
  }

  async function recover() {
    clear();
    if (!email.trim()) return setError("Enter the email used for your LifeTracker account");
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setMode("reset");
      setMessage("If that email belongs to an account, a 6-digit code has been sent. Enter it below.");
    } catch (e) { setError(e.message || "Unable to send reset email"); }
    finally { setBusy(false); }
  }

  // Step 2: the code from the email + a new password
  async function changePassword() {
    clear();
    if (code.trim().length !== 6) return setError("Enter the 6-digit code from the email");
    if (password.length < 8) return setError("New password must be at least 8 characters");
    if (password !== confirm) return setError("Passwords do not match");
    setBusy(true);
    try {
      const result = await resetPassword(email.trim(), code.trim(), password);
      setMode("login");
      setCode("");
      setPassword("");
      setConfirm("");
      setMessage(result.message || "Password changed. You can now sign in.");
    } catch (e) { setError(e.message || "Unable to change the password"); }
    finally { setBusy(false); }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={theme.headerGradient} style={styles.circle}>
          <Ionicons name="shield-checkmark" size={42} color={theme.headerText} />
        </LinearGradient>
        <ThemedText style={styles.title}>LifeTracker</ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.subText }]}>
          {mode === "login" ? "Sign in to keep your life data with you" : mode === "register" ? "Create your secure LifeTracker account" : mode === "forgot" ? "We will email you a 6-digit code" : "Enter the code and choose a new password"}
        </ThemedText>

        {mode === "register" && <TextInput style={inputStyle} name={usernameFieldName} placeholder="Username" placeholderTextColor={theme.subText} autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" inputMode="text" importantForAutofill="no" value={username} onChangeText={v => { setUsername(v); clear(); }} />}
        {mode === "reset" && <TextInput style={inputStyle} name={codeFieldName} placeholder="6-digit code" placeholderTextColor={theme.subText} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode" inputMode="numeric" importantForAutofill="yes" value={code} onChangeText={v => { setCode(v.replace(/[^0-9]/g, "")); clear(); }} />}
        {mode === "forgot" && <TextInput style={inputStyle} name={emailFieldName} placeholder="Email address" placeholderTextColor={theme.subText} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" inputMode="email" importantForAutofill="no" value={email} onChangeText={v => { setEmail(v); clear(); }} />}
        {mode === "login" && <TextInput style={inputStyle} name={usernameFieldName} placeholder="Username or email" placeholderTextColor={theme.subText} autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" inputMode="email" importantForAutofill="no" value={username} onChangeText={v => { setUsername(v); clear(); }} />}
        {mode === "register" && <TextInput style={inputStyle} name={emailFieldName} placeholder="Email address" placeholderTextColor={theme.subText} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="off" textContentType="none" inputMode="email" importantForAutofill="no" value={email} onChangeText={v => { setEmail(v); clear(); }} />}
        {mode !== "forgot" && <TextInput style={inputStyle} name={passwordFieldName} placeholder={mode === "reset" ? "New password" : "Password"} placeholderTextColor={theme.subText} secureTextEntry autoComplete="new-password" textContentType="newPassword" importantForAutofill="no" value={password} onChangeText={v => { setPassword(v); clear(); }} />}
        {(mode === "register" || mode === "reset") && <TextInput style={inputStyle} name={confirmFieldName} placeholder="Confirm password" placeholderTextColor={theme.subText} secureTextEntry autoComplete="new-password" textContentType="newPassword" importantForAutofill="no" value={confirm} onChangeText={v => { setConfirm(v); clear(); }} />}

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
        {message ? <ThemedText style={styles.message}>{message}</ThemedText> : null}

        <TouchableOpacity disabled={busy} onPress={mode === "forgot" ? recover : mode === "reset" ? changePassword : submit}>
          <LinearGradient colors={theme.headerGradient} style={styles.button}>
            {busy ? <ActivityIndicator color={theme.headerText} /> : <ThemedText style={[styles.buttonText, { color: theme.headerText }]}>{mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : mode === "forgot" ? "Send Reset Code" : "Change Password"}</ThemedText>}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.links}>
          {mode === "login" && <TouchableOpacity onPress={() => { setMode("forgot"); clearAllFields(); }}><ThemedText style={{ color: theme.primary }}>Forgot password?</ThemedText></TouchableOpacity>}
          {mode === "login" && <TouchableOpacity onPress={() => { setMode("register"); clearAllFields(); }}><ThemedText style={{ color: theme.primary }}>Create account</ThemedText></TouchableOpacity>}
          {mode === "register" && <TouchableOpacity onPress={() => { setMode("login"); clearAllFields(); }}><ThemedText style={{ color: theme.primary }}>Already have an account? Sign in</ThemedText></TouchableOpacity>}
          {(mode === "forgot" || mode === "reset") && <TouchableOpacity onPress={() => { setMode("login"); clearAllFields(); }}><ThemedText style={{ color: theme.primary }}>Back to sign in</ThemedText></TouchableOpacity>}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 24 },
  circle: { width: 96, height: 96, borderRadius: 48, alignSelf: "center", justifyContent: "center", alignItems: "center", marginBottom: 18 },
  title: { fontSize: 28, fontWeight: "bold", textAlign: "center" },
  subtitle: { textAlign: "center", marginTop: 6, marginBottom: 24, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12, fontSize: 16 },
  button: { padding: 16, borderRadius: 14, alignItems: "center", marginTop: 4 },
  buttonText: { fontWeight: "bold", fontSize: 16 },
  links: { alignItems: "center", gap: 16, marginTop: 22 },
  error: { color: "#E53935", marginBottom: 10, textAlign: "center" },
  message: { color: "#2E7D32", marginBottom: 10, textAlign: "center", lineHeight: 20 },
});