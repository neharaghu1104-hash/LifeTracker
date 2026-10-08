import { useCallback, useState } from "react";
import { View, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Header from "./Header";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import { getToday } from "./dateHelpers";
import { KEYS } from "./lifeData";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function FocusScreen() {
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [input, setInput] = useState("");
  const date = getToday();

  const load = useCallback(async () => {
    const raw = await AsyncStorage.getItem(KEYS.focus);
    const all = raw ? JSON.parse(raw) : {};
    setItems(all[date] || []);
  }, [date]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function persist(next) {
    const raw = await AsyncStorage.getItem(KEYS.focus);
    const all = raw ? JSON.parse(raw) : {};
    all[date] = next;
    await AsyncStorage.setItem(KEYS.focus, JSON.stringify(all));
    setItems(next);
  }

  async function add() {
    const title = input.trim();
    if (!title) return;
    if (items.length >= 3) return Alert.alert("Daily focus", "Keep your focus to 3 priorities so the day stays calm.");
    await persist([...items, { id: Date.now().toString(), title, completed: false }]);
    setInput("");
  }
  async function toggle(id) {
    await persist(items.map((x) => x.id === id ? { ...x, completed: !x.completed, completedAt: !x.completed ? new Date().toTimeString().slice(0, 5) : "" } : x));
  }
  async function remove(id) { await persist(items.filter((x) => x.id !== id)); }

  const done = items.filter((x) => x.completed).length;
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Daily Focus" subtitle={`${done}/${items.length} priorities completed`} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: theme.borderWidth, borderRadius: theme.radius }]}>
          <ThemedText style={styles.title}>What matters today?</ThemedText>
          <ThemedText style={[styles.sub, { color: theme.subText }]}>Choose up to three priorities. No streaks, no pressure.</ThemedText>
          <View style={styles.addRow}>
            <TextInput value={input} onChangeText={setInput} placeholder="Add a priority" placeholderTextColor={theme.subText} style={[styles.input, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.cardBorder }]} onSubmitEditing={add} />
            <TouchableOpacity onPress={add} style={[styles.add, { backgroundColor: theme.primary }]}><Ionicons name="add" size={24} color="#fff" /></TouchableOpacity>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.row}>
              <TouchableOpacity onPress={() => toggle(item.id)} style={[styles.check, { borderColor: item.completed ? theme.primary : theme.cardBorder, backgroundColor: item.completed ? theme.primary : "transparent" }]}>
                {item.completed && <Ionicons name="checkmark" size={16} color="#fff" />}
              </TouchableOpacity>
              <ThemedText style={[styles.item, item.completed && styles.completed]}>{item.title}</ThemedText>
              <TouchableOpacity onPress={() => remove(item.id)}><Ionicons name="trash-outline" size={18} color={theme.subText} /></TouchableOpacity>
            </View>
          ))}
          {items.length === 0 && <ThemedText style={[styles.empty, { color: theme.subText }]}>Your top three priorities will appear here.</ThemedText>}
        </View>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ container: { flex: 1 }, content: { padding: 16, paddingBottom: 40 }, card: { padding: 18 }, title: { fontSize: 22, fontWeight: "800" }, sub: { marginTop: 5, lineHeight: 20 }, addRow: { flexDirection: "row", marginTop: 18, gap: 8 }, input: { flex: 1, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 }, add: { width: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" }, row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(128,128,128,.25)" }, check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" }, item: { flex: 1, marginLeft: 12, fontSize: 16 }, completed: { textDecorationLine: "line-through", opacity: 0.55 }, empty: { textAlign: "center", padding: 24 } });