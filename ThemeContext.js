import { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { themes } from "./themes";

const THEME_KEY = "themeName";
const PHOTO_KEY = "headerPhoto";
const ThemeContext = createContext();

const DEFAULT_THEME = "nature";

export function ThemeProvider({ children }) {
  const [themeName, setThemeName] = useState(DEFAULT_THEME);
  const [headerPhoto, setHeaderPhoto] = useState(""); // "" means no photo

  // Load the saved theme and photo when the app opens
  useEffect(() => {
    async function loadSettings() {
      const savedTheme = await AsyncStorage.getItem(THEME_KEY);
      if (savedTheme && themes[savedTheme]) {
        setThemeName(savedTheme);
      } else {
        setThemeName(DEFAULT_THEME);
        await AsyncStorage.setItem(THEME_KEY, DEFAULT_THEME);
      }

      const savedPhoto = await AsyncStorage.getItem(PHOTO_KEY);
      if (savedPhoto) setHeaderPhoto(savedPhoto);
    }
    loadSettings();
  }, []);

  function changeTheme(name) {
    const nextTheme = "nature";
    setThemeName(nextTheme);
    AsyncStorage.setItem(THEME_KEY, nextTheme);
  }

  // Pass "" to remove the photo
  function changeHeaderPhoto(photo) {
    setHeaderPhoto(photo);
    if (photo) {
      AsyncStorage.setItem(PHOTO_KEY, photo);
    } else {
      AsyncStorage.removeItem(PHOTO_KEY);
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        theme: themes[themeName],
        themeName: themeName,
        changeTheme: changeTheme,
        headerPhoto: headerPhoto,
        changeHeaderPhoto: changeHeaderPhoto,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}