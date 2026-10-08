import { useState } from "react";
import { View, TextInput, TouchableOpacity, Alert, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";

// The things a backup is allowed to bring back
const LIST_KEYS = ["expenses", "notes", "events", "lifeGoals"]; // saved as lists
const OBJECT_KEYS = [
  "stepHistory",
  "dailyFocus",
  "dailyMood",
  "budgets",
  "privacySettings",
]; // saved as objects
const TEXT_KEYS = ["username", "themeName"]; // saved as plain text
const ALL_KEYS = [...LIST_KEYS, ...OBJECT_KEYS, ...TEXT_KEYS];

// Is this value the right shape for this key?
function isValid(key, value) {
  if (LIST_KEYS.includes(key)) return Array.isArray(value);
  if (TEXT_KEYS.includes(key)) return typeof value === "string";
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countOf(backup, key) {
  const list = backup.data[key];
  return Array.isArray(list) ? list.length : 0;
}

export default function RestoreBackup() {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState(null); // { text, ok }

  // Reads the pasted text. Returns the backup, or null if it is not a LifeTracker backup.
  function readBackup() {
    // Some apps add words around the backup, so only look between the first { and the last }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return null;

    try {
      const backup = JSON.parse(text.slice(start, end + 1));
      if (backup.app !== "LifeTracker") return null;
      if (typeof backup.data !== "object" || backup.data === null) return null;
      return backup;
    } catch (error) {
      return null;
    }
  }

  function askToRestore() {
    const backup = readBackup();
    if (!backup) {
      setMessage({
        text: "That doesn't look like a LifeTracker backup. Paste the whole backup text.",
        ok: false,
      });
      return;
    }

    // Only keep the parts that are safe to restore
    const keys = ALL_KEYS.filter(
      (key) => backup.data[key] !== undefined && isValid(key, backup.data[key])
    );
    if (keys.length === 0) {
      setMessage({ text: "This backup has no data to restore.", ok: false });
      return;
    }

    Alert.alert(
      "Restore this backup?",
      `It has ${countOf(backup, "expenses")} expenses, ${countOf(backup, "notes")} notes and ${countOf(
        backup,
        "events"
      )} events.\n\nThis replaces the matching data on this phone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Restore", onPress: () => restore(backup, keys) },
      ]
    );
  }

  async function restore(backup, keys) {
    const pairs = keys.map((key) => {
      const value = backup.data[key];
      return [key, TEXT_KEYS.includes(key) ? value : JSON.stringify(value)];
    });

    await AsyncStorage.multiSet(pairs);
    setText("");
    setMessage({
      text: "Backup restored. Close LifeTracker completely and open it again to see everything.",
      ok: true,
    });
  }

  // Closed: just a button
  if (!open) {
    return (
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.button, { borderColor: theme.cardBorder }]}
      >
        <ThemedText style={styles.buttonText}>Restore from a backup</ThemedText>
      </TouchableOpacity>
    );
  }

  // Open: paste the backup text and restore it
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.cardBorder,
          borderWidth: theme.borderWidth,
          borderRadius: theme.radius,
        },
      ]}
    >
      <ThemedText style={styles.title}>Restore from a backup</ThemedText>
      <ThemedText style={[styles.hint, { color: theme.subText }]}>
        Open the backup you shared earlier (in Notes, WhatsApp or email), copy all of its text,
        and paste it here.
      </ThemedText>

      <TextInput
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.cardBorder },
        ]}
        placeholder="Paste your backup text here"
        placeholderTextColor={theme.subText}
        multiline
        value={text}
        onChangeText={(value) => {
          setText(value);
          setMessage(null);
        }}
      />

      {message && (
        <ThemedText style={[styles.message, { color: message.ok ? "#2E9E5B" : "#E53935" }]}>
          {message.text}
        </ThemedText>
      )}

      <TouchableOpacity
        onPress={askToRestore}
        style={[styles.restoreButton, { backgroundColor: theme.primary }]}
      >
        <ThemedText style={styles.restoreText}>Restore</ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          setOpen(false);
          setText("");
          setMessage(null);
        }}
      >
        <ThemedText style={[styles.cancel, { color: theme.subText }]}>Cancel</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { padding: 15, borderRadius: 14, alignItems: "center", marginTop: 10, borderWidth: 1 },
  buttonText: { fontWeight: "800" },
  card: { padding: 18, marginTop: 10 },
  title: { fontSize: 18, fontWeight: "800" },
  hint: { marginTop: 6, lineHeight: 20 },
  input: {
    minHeight: 110,
    maxHeight: 200,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    textAlignVertical: "top",
  },
  message: { marginTop: 10, fontWeight: "600", lineHeight: 20 },
  restoreButton: { padding: 14, borderRadius: 14, alignItems: "center", marginTop: 12 },
  restoreText: { color: "#fff", fontWeight: "800" },
  cancel: { textAlign: "center", marginTop: 14, fontWeight: "600" },
});