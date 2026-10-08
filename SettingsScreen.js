import { useState, useCallback } from "react";
import { View, Image, ScrollView, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Header from "./Header";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import { themes } from "./themes";
import { getStoredUser, logout, changePassword as changeAccountPassword } from "./api";

// Turn the password into a scrambled value, so the real password is never saved
async function makeHash(salt, password) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, salt + password);
}

export default function SettingsScreen() {
  const { theme, themeName, changeTheme, headerPhoto, changeHeaderPhoto } = useTheme();

  // Name
  const [username, setUsername] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [nameMessage, setNameMessage] = useState(null); // { text, ok }

  // Photo
  const [photoMessage, setPhotoMessage] = useState(null); // { text, ok }

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMessage, setPwMessage] = useState(null); // { text, ok }
  const [account, setAccount] = useState(null);
  const [accountCurrent, setAccountCurrent] = useState("");
  const [accountNew, setAccountNew] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");
  const [accountMessage, setAccountMessage] = useState(null);

  // Load the saved name every time this tab is opened
  useFocusEffect(
    useCallback(() => {
      async function loadName() {
        const saved = await AsyncStorage.getItem("username");
        setUsername(saved || "");
        setAccount(await getStoredUser());
      }
      loadName();
    }, [])
  );

  // Save the name, e.g. "neha" becomes "Neha"
  async function saveName() {
    const clean = nameInput.trim();
    if (!clean) {
      setNameMessage({ text: "Please type a name", ok: false });
      return;
    }
    const name = clean.charAt(0).toUpperCase() + clean.slice(1);
    await AsyncStorage.setItem("username", name);
    setUsername(name);
    setNameInput("");
    setNameMessage({ text: "Name saved", ok: true });
  }

  // Pick a photo from the gallery for the header
  async function choosePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.3,
      base64: true,
    });
    if (result.canceled) return;

    const base64 = result.assets[0].base64;
    if (!base64) {
      setPhotoMessage({ text: "Could not read that photo. Try another one.", ok: false });
      return;
    }
    if (base64.length > 1500000) {
      setPhotoMessage({ text: "That photo is too large. Pick a smaller one.", ok: false });
      return;
    }

    changeHeaderPhoto(`data:image/jpeg;base64,${base64}`);
    setPhotoMessage({ text: "Photo saved", ok: true });
  }

  function removePhoto() {
    changeHeaderPhoto("");
    setPhotoMessage({ text: "Photo removed", ok: true });
  }

  async function changePassword() {
    if (!currentPw || !newPw || !confirmPw) {
      setPwMessage({ text: "Please fill in all three boxes", ok: false });
      return;
    }
    if (newPw.length < 4) {
      setPwMessage({ text: "New password must be at least 4 characters", ok: false });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMessage({ text: "New passwords do not match", ok: false });
      return;
    }

    // Check the current password first
    const salt = await SecureStore.getItemAsync("passwordSalt");
    const savedHash = await SecureStore.getItemAsync("passwordHash");
    const currentHash = await makeHash(salt, currentPw);
    if (currentHash !== savedHash) {
      setPwMessage({ text: "Current password is wrong", ok: false });
      return;
    }

    // Save the new password with a fresh salt
    const newSalt = Crypto.randomUUID();
    const newHash = await makeHash(newSalt, newPw);
    await SecureStore.setItemAsync("passwordSalt", newSalt);
    await SecureStore.setItemAsync("passwordHash", newHash);

    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setPwMessage({ text: "Password changed", ok: true });
  }

  // Card and input looks come from the current theme
  const cardStyle = {
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: theme.borderWidth,
    borderRadius: theme.radius,
  };
  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.inputBg,
      color: theme.text,
      borderColor: theme.cardBorder,
      borderWidth: theme.borderWidth,
    },
  ];
  const buttonStyle = [
    styles.button,
    {
      borderColor: theme.cardBorder,
      borderWidth: theme.borderWidth,
      borderRadius: theme.radius,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Settings" subtitle="Your name, style, photo and password" />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Account */}
        <View style={[styles.card, styles.firstCard, cardStyle]}>
          <ThemedText style={styles.cardTitle}>LifeTracker account</ThemedText>
          <ThemedText style={[styles.hint, { color: theme.subText }]}>
            {account ? `${account.username} · ${account.email}` : "Signed in securely"}
          </ThemedText>
          <ThemedText style={[styles.hint, { color: theme.subText }]}>Your data syncs to your account so it can be restored on a new phone after you sign in.</ThemedText>
          <TouchableOpacity onPress={logout}>
            <View style={[buttonStyle, { backgroundColor: theme.card }]}>
              <ThemedText style={[styles.buttonText, { color: theme.text }]}>Sign out</ThemedText>
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.card, cardStyle]}>
          <ThemedText style={styles.cardTitle}>Account password</ThemedText>
          <ThemedText style={[styles.hint, { color: theme.subText }]}>This is your cloud account password. It is different from the optional local app-lock password.</ThemedText>
          <TextInput style={inputStyle} placeholder="Current account password" placeholderTextColor={theme.subText} secureTextEntry value={accountCurrent} onChangeText={setAccountCurrent} />
          <TextInput style={inputStyle} placeholder="New account password" placeholderTextColor={theme.subText} secureTextEntry value={accountNew} onChangeText={setAccountNew} />
          <TextInput style={inputStyle} placeholder="Confirm new account password" placeholderTextColor={theme.subText} secureTextEntry value={accountConfirm} onChangeText={setAccountConfirm} />
          {accountMessage && <ThemedText style={[styles.message, { color: accountMessage.ok ? "#2E9E5B" : "#E53935" }]}>{accountMessage.text}</ThemedText>}
          <TouchableOpacity onPress={async () => {
            setAccountMessage(null);
            if (accountNew.length < 8) return setAccountMessage({ text: "New account password must be at least 8 characters", ok: false });
            if (accountNew !== accountConfirm) return setAccountMessage({ text: "New account passwords do not match", ok: false });
            try { await changeAccountPassword(accountCurrent, accountNew); setAccountCurrent(""); setAccountNew(""); setAccountConfirm(""); setAccountMessage({ text: "Account password changed", ok: true }); }
            catch (e) { setAccountMessage({ text: e.message || "Could not change account password", ok: false }); }
          }}>
            <LinearGradient colors={theme.headerGradient} style={buttonStyle}>
              <ThemedText style={[styles.buttonText, { color: theme.headerText }]}>Change account password</ThemedText>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Your name */}
        <View style={[styles.card, styles.firstCard, cardStyle]}>
          <ThemedText style={styles.cardTitle}>Your name</ThemedText>
          <ThemedText style={[styles.hint, { color: theme.subText }]}>
            {username ? `Currently: ${username}` : "No name saved yet"}
          </ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="New name (e.g. Neha)"
            placeholderTextColor={theme.subText}
            value={nameInput}
            onChangeText={(text) => {
              setNameInput(text);
              setNameMessage(null);
            }}
          />
          {nameMessage && (
            <ThemedText
              style={[styles.message, { color: nameMessage.ok ? "#2E9E5B" : "#E53935" }]}
            >
              {nameMessage.text}
            </ThemedText>
          )}
          <TouchableOpacity onPress={saveName}>
            <LinearGradient colors={theme.headerGradient} style={buttonStyle}>
              <ThemedText style={[styles.buttonText, { color: theme.headerText }]}>
                Save name
              </ThemedText>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* App style */}
        <View style={[styles.card, cardStyle]}>
          <ThemedText style={styles.cardTitle}>App style</ThemedText>
          <ThemedText style={[styles.hint, { color: theme.subText }]}>Default appearance: Living Nature</ThemedText>
          <View style={styles.themePreview}>
            <LinearGradient colors={themes.nature.headerGradient} style={styles.swatch} />
            <View style={styles.themeTextWrap}>
              <ThemedText style={styles.themeName}>{themes.nature.name}</ThemedText>
              <ThemedText style={[styles.themeDesc, { color: theme.subText }]}>
                {themes.nature.description}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Header photo */}
        <View style={[styles.card, cardStyle]}>
          <ThemedText style={styles.cardTitle}>Header photo</ThemedText>
          <ThemedText style={[styles.hint, { color: theme.subText }]}>
            Use your own picture behind the title on every screen
          </ThemedText>

          {headerPhoto ? (
            <Image
              source={{ uri: headerPhoto }}
              style={[styles.preview, { borderRadius: theme.radius }]}
              resizeMode="cover"
            />
          ) : null}

          {photoMessage && (
            <ThemedText
              style={[styles.message, { color: photoMessage.ok ? "#2E9E5B" : "#E53935" }]}
            >
              {photoMessage.text}
            </ThemedText>
          )}

          <TouchableOpacity onPress={choosePhoto}>
            <LinearGradient colors={theme.headerGradient} style={buttonStyle}>
              <ThemedText style={[styles.buttonText, { color: theme.headerText }]}>
                {headerPhoto ? "Change photo" : "Choose photo"}
              </ThemedText>
            </LinearGradient>
          </TouchableOpacity>

          {headerPhoto ? (
            <TouchableOpacity onPress={removePhoto}>
              <ThemedText style={[styles.removeText, { color: theme.subText }]}>
                Remove photo
              </ThemedText>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Change app-lock password */}
        <View style={[styles.card, cardStyle]}>
          <ThemedText style={styles.cardTitle}>Change app-lock password</ThemedText>
          <TextInput
            style={inputStyle}
            placeholder="Current password"
            placeholderTextColor={theme.subText}
            secureTextEntry
            value={currentPw}
            onChangeText={(text) => {
              setCurrentPw(text);
              setPwMessage(null);
            }}
          />
          <TextInput
            style={inputStyle}
            placeholder="New password"
            placeholderTextColor={theme.subText}
            secureTextEntry
            value={newPw}
            onChangeText={(text) => {
              setNewPw(text);
              setPwMessage(null);
            }}
          />
          <TextInput
            style={inputStyle}
            placeholder="Confirm new password"
            placeholderTextColor={theme.subText}
            secureTextEntry
            value={confirmPw}
            onChangeText={(text) => {
              setConfirmPw(text);
              setPwMessage(null);
            }}
          />
          {pwMessage && (
            <ThemedText
              style={[styles.message, { color: pwMessage.ok ? "#2E9E5B" : "#E53935" }]}
            >
              {pwMessage.text}
            </ThemedText>
          )}
          <TouchableOpacity onPress={changePassword}>
            <LinearGradient colors={theme.headerGradient} style={buttonStyle}>
              <ThemedText style={[styles.buttonText, { color: theme.headerText }]}>
                Change password
              </ThemedText>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  card: { padding: 16, marginTop: 14 },
  firstCard: { marginTop: -10 },
  cardTitle: { fontSize: 17, fontWeight: "bold", marginBottom: 6 },
  hint: { marginBottom: 10 },
  input: { borderRadius: 12, padding: 12, marginBottom: 10, marginTop: 4 },
  message: { marginBottom: 10, fontWeight: "600" },
  button: { padding: 14, alignItems: "center" },
  buttonText: { fontWeight: "bold", fontSize: 16 },
  removeText: { textAlign: "center", marginTop: 14, fontWeight: "600" },
  preview: { width: "100%", height: 130, marginBottom: 12 },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 8 },
  themeOption: { width: "48%", borderRadius: 14, padding: 10, marginBottom: 10 },
  themePreview: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  themeTextWrap: { flex: 1 },
  swatch: { height: 44, width: 44, borderRadius: 12, marginRight: 10 },
  themeName: { fontWeight: "bold", fontSize: 13 },
  themeDesc: { fontSize: 11, marginTop: 2 },
});