import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pedometer } from "expo-sensors";
import nativeCounter from "./modules/life-step-counter";

// The built-in all-day step counter (Android app build only).
// The phone's own step sensor counts all day. A small background job reads it
// about every 15 minutes, even when LifeTracker is closed, and saves a total for each day.

// Is the built-in counter part of this app? (No in Expo Go and on iPhone.)
export function hasBuiltInCounter() {
  return nativeCounter !== null;
}

// Shows the phone's "Allow physical activity?" question. Returns true if allowed.
export async function askStepPermission() {
  try {
    const result = await Pedometer.requestPermissionsAsync();
    return Boolean(result.granted);
  } catch (error) {
    return false;
  }
}

// Starts the background reader (safe to call every time the app opens)
export async function startStepCounter() {
  if (!nativeCounter) return false;
  try {
    return await nativeCounter.start();
  } catch (error) {
    return false;
  }
}

// Reads the sensor now, copies the last 7 days into the app's step history,
// and returns the whole history. Returns null if the built-in counter is not available.
export async function refreshSteps() {
  if (!nativeCounter) return null;
  try {
    await nativeCounter.sampleNow();
    const days = JSON.parse(await nativeCounter.getDays(7));

    const saved = await AsyncStorage.getItem("stepHistory");
    const history = saved ? JSON.parse(saved) : {};

    // Keep the bigger number, so nothing already saved is ever lowered
    Object.keys(days).forEach((day) => {
      history[day] = Math.max(Number(history[day] || 0), Number(days[day] || 0));
    });

    await AsyncStorage.setItem("stepHistory", JSON.stringify(history));
    return history;
  } catch (error) {
    return null;
  }
}

// Opens the phone's battery screen, so the phone does not pause LifeTracker
export function openBatterySettings() {
  Linking.sendIntent("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS").catch(() =>
    Linking.openSettings()
  );
}

export function openAppSettings() {
  Linking.openSettings();
}
