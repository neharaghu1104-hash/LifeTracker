import { useState, useCallback } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Header from "./Header";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import { KEYS } from "./lifeData";

// Wraps a screen. When its Privacy switch is on, the screen stays hidden
// until you use your fingerprint. It locks again every time you leave the tab.
//
// setting = "protectExpenses" or "protectTimeline" (the switch to look at)
// title   = the name shown on the lock screen
export default function Protected({ setting, title, children }) {
  const { theme } = useTheme();
  const [checking, setChecking] = useState(true); // still reading the switch
  const [needsLock, setNeedsLock] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState("");

  // Asks for the fingerprint
  async function unlock() {
    const hasSensor = await LocalAuthentication.hasHardwareAsync();
    const hasFingerprint = await LocalAuthentication.isEnrolledAsync();
    if (!hasSensor || !hasFingerprint) {
      setMessage(
        "No fingerprint is set up on this phone. Add one in your phone settings, or turn this lock off in More > Privacy & Backup."
      );
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `Unlock ${title}`,
      disableDeviceFallback: true, // fingerprint only, no phone PIN or pattern
      cancelLabel: "Cancel",
    });

    if (result.success) {
      setUnlocked(true);
    } else {
      setMessage("Still locked. Tap the fingerprint to try again.");
    }
  }

  // Every time this tab is opened: check the switch, and ask for the fingerprint if it is on
  useFocusEffect(
    useCallback(() => {
      async function check() {
        const saved = await AsyncStorage.getItem(KEYS.privacy);
        const settings = saved ? JSON.parse(saved) : {};
        const locked = settings[setting] === true;

        setNeedsLock(locked);
        setUnlocked(false);
        setMessage("");
        setChecking(false);
        if (locked) unlock();
      }
      check();

      // When you leave the tab, lock it again
      return () => {
        setUnlocked(false);
        setChecking(true);
      };
    }, [setting])
  );

  // Still reading the switch: show an empty screen so nothing flashes
  if (checking) {
    return <View style={[styles.container, { backgroundColor: theme.background }]} />;
  }

  if (needsLock && !unlocked) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Header title={title} subtitle="Locked" />
        <View style={styles.center}>
          <TouchableOpacity onPress={unlock}>
            <Ionicons name="finger-print" size={80} color={theme.primary} />
          </TouchableOpacity>
          <ThemedText style={[styles.text, { color: theme.subText }]}>
            {message || "Use your fingerprint to open"}
          </ThemedText>
        </View>
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  text: { textAlign: "center", marginTop: 16, lineHeight: 21 },
});