import { Platform } from "react-native";

// The built-in Android step counter. It does not exist in Expo Go or on iPhone,
// so then this stays null and the app uses its older live counter instead.
let native = null;

if (Platform.OS === "android") {
  try {
    const { requireNativeModule } = require("expo");
    native = requireNativeModule("LifeStepCounter");
  } catch (error) {
    native = null;
  }
}

export default native;
