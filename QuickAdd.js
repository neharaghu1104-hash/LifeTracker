import { useState } from "react";
import {
  Modal,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import { getToday } from "./dateHelpers";

const CATEGORIES = ["Food", "Travel", "Bills", "Shopping", "Other"];

const KINDS = [
  { id: "expense", label: "Expense", icon: "wallet" },
  { id: "note", label: "Note", icon: "document-text" },
  { id: "event", label: "Event today", icon: "calendar" },
];

export default function QuickAdd({ visible, onClose, onAdded }) {
  const { theme } = useTheme();
  const [kind, setKind] = useState("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [body, setBody] = useState("");
  const [time, setTime] = useState("09:00"); // 24-hour format

  // Adds one item to a saved list. Events go last, the rest go first.
  async function addToList(key, newItem) {
    const saved = await AsyncStorage.getItem(key);
    const list = saved ? JSON.parse(saved) : [];
    const newList = key === "events" ? [...list, newItem] : [newItem, ...list];
    await AsyncStorage.setItem(key, JSON.stringify(newList));
  }

  function clearForm() {
    setTitle("");
    setAmount("");
    setBody("");
    setTime("09:00");
  }

  function close() {
    clearForm();
    onClose();
  }

  async function save() {
    if (!title.trim()) {
      Alert.alert("Add a title first");
      return;
    }
    const id = Date.now().toString();

    if (kind === "expense") {
      const value = Number(amount);
      if (!value || value <= 0) {
        Alert.alert("Enter a valid amount");
        return;
      }
      await addToList("expenses", {
        id: id,
        title: title.trim(),
        amount: value,
        type: "expense",
        category: category,
        date: new Date().toISOString(),
      });
    } else if (kind === "note") {
      await addToList("notes", {
        id: id,
        date: new Date().toISOString(),
        pinned: false,
        title: title.trim(),
        body: body.trim(),
        items: [],
        type: "text",
        tag: "",
        locked: false,
      });
    } else {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        Alert.alert("Invalid time", "Please use 24-hour format like 09:30 or 18:00");
        return;
      }
      await addToList("events", {
        id: id,
        title: title.trim(),
        note: body.trim(),
        date: getToday(),
        time: time,
        repeat: "none",
      });
    }

    clearForm();
    onAdded(kind);
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: theme.inputBg,
      color: theme.text,
      borderColor: theme.cardBorder,
      borderWidth: theme.borderWidth,
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        {/* Tapping the dark area closes the sheet */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
              borderWidth: theme.borderWidth,
              borderTopLeftRadius: theme.radius + 8,
              borderTopRightRadius: theme.radius + 8,
            },
          ]}
        >
          <ThemedText style={styles.sheetTitle}>Quick add</ThemedText>

          <View style={styles.kindRow}>
            {KINDS.map((option) => {
              const isActive = kind === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.kindButton,
                    {
                      backgroundColor: isActive ? theme.primary : theme.inputBg,
                      borderColor: theme.cardBorder,
                      borderWidth: theme.borderWidth,
                    },
                  ]}
                  onPress={() => setKind(option.id)}
                >
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={isActive ? "#fff" : theme.primary}
                  />
                  <ThemedText
                    style={{ color: isActive ? "#fff" : theme.text, fontSize: 12, marginTop: 2 }}
                  >
                    {option.label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <TextInput
              style={inputStyle}
              placeholder={
                kind === "expense"
                  ? "What did you spend on?"
                  : kind === "note"
                  ? "Note title"
                  : "Event title"
              }
              placeholderTextColor={theme.subText}
              value={title}
              onChangeText={setTitle}
            />

            {kind === "expense" && (
              <View>
                <TextInput
                  style={inputStyle}
                  placeholder="Amount"
                  placeholderTextColor={theme.subText}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
                <View style={styles.chipRow}>
                  {CATEGORIES.map((name) => {
                    const isActive = category === name;
                    return (
                      <TouchableOpacity
                        key={name}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: isActive ? theme.primary : theme.inputBg,
                            borderColor: theme.cardBorder,
                            borderWidth: theme.borderWidth,
                          },
                        ]}
                        onPress={() => setCategory(name)}
                      >
                        <ThemedText style={{ color: isActive ? "#fff" : theme.text, fontSize: 12 }}>
                          {name}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {kind === "note" && (
              <TextInput
                style={[inputStyle, styles.bodyInput]}
                placeholder="Write your note..."
                placeholderTextColor={theme.subText}
                multiline
                value={body}
                onChangeText={setBody}
              />
            )}

            {kind === "event" && (
              <View>
                <TextInput
                  style={inputStyle}
                  placeholder="Time (24-hour, e.g. 09:30)"
                  placeholderTextColor={theme.subText}
                  value={time}
                  onChangeText={setTime}
                />
                <TextInput
                  style={inputStyle}
                  placeholder="Note (optional)"
                  placeholderTextColor={theme.subText}
                  value={body}
                  onChangeText={setBody}
                />
              </View>
            )}
          </ScrollView>

          <TouchableOpacity onPress={save}>
            <LinearGradient
              colors={theme.headerGradient}
              style={[
                styles.saveButton,
                {
                  borderColor: theme.cardBorder,
                  borderWidth: theme.borderWidth,
                  borderRadius: theme.radius,
                },
              ]}
            >
              <ThemedText style={[styles.saveText, { color: theme.headerText }]}>Save</ThemedText>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: { padding: 16, maxHeight: "85%" },
  sheetTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },
  kindRow: { flexDirection: "row", marginBottom: 12 },
  kindButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
  },
  input: { borderRadius: 12, padding: 12, marginBottom: 10 },
  bodyInput: { height: 90, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  chip: {
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  saveButton: { padding: 14, alignItems: "center", marginTop: 6 },
  saveText: { fontWeight: "bold", fontSize: 16 },
});