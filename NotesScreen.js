import { useState, useEffect, useCallback } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Switch,
  Alert,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Header from "./Header";
import FadeInView from "./FadeInView";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";

const STORAGE_KEY = "notes";

// The tags you can put on a note, with their colors
const TAGS = {
  Personal: "#0984E3",
  Work: "#6C5CE7",
  Ideas: "#F5A623",
  Important: "#E53935",
};

export default function NotesScreen() {
  const { theme } = useTheme();
  const [notes, setNotes] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // The form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState(""); // "" means no tag
  const [isChecklist, setIsChecklist] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = adding a new note

  // Search and filter
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  // Locked notes that are open right now
  const [unlockedIds, setUnlockedIds] = useState([]);

    // Load saved notes every time this tab is opened
  useFocusEffect(
    useCallback(() => {
      async function loadNotes() {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setNotes(JSON.parse(saved));
        setLoaded(true);
      }
      loadNotes();
    }, [])
  );

  // Save whenever the list changes (after the first load is done)
  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }
  }, [notes, loaded]);

  // Lock every note again when you leave this tab
  useFocusEffect(
    useCallback(() => {
      return () => setUnlockedIds([]);
    }, [])
  );

  // Asks for a fingerprint. Returns true if it worked.
  async function checkFingerprint(message) {
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      Alert.alert(
        "Fingerprint needed",
        "Set up a fingerprint in your phone settings to use locked notes."
      );
      return false;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: message,
      disableDeviceFallback: true,
      cancelLabel: "Cancel",
    });
    return result.success;
  }

  async function changeLockSwitch(value) {
    if (!value) {
      setIsLocked(false);
      return;
    }
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) {
      Alert.alert(
        "Fingerprint needed",
        "Set up a fingerprint in your phone settings to use locked notes."
      );
      return;
    }
    setIsLocked(true);
  }

  async function unlockNote(id) {
    const ok = await checkFingerprint("Unlock this note");
    if (ok) setUnlockedIds([...unlockedIds, id]);
  }

  function saveNote() {
    if (!title.trim() && !body.trim()) return;

    // A checklist is one item per line
    const lines = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");

    let items = [];
    if (isChecklist) {
      // Keep the ticks of items that stay the same when editing
      const oldNote = notes.find((item) => item.id === editingId);
      const oldItems = oldNote && oldNote.items ? oldNote.items : [];
      items = lines.map((text) => {
        const old = oldItems.find((entry) => entry.text === text);
        return { text: text, done: old ? old.done : false };
      });
    }

    const fields = {
      title: title.trim(),
      body: isChecklist ? "" : body.trim(),
      items: items,
      type: isChecklist ? "checklist" : "text",
      tag: tag,
      locked: isLocked,
    };

    if (editingId) {
      // Update the existing note
      setNotes(notes.map((item) => (item.id === editingId ? { ...item, ...fields } : item)));
    } else {
      // Add a new note
      const newNote = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        pinned: false,
        ...fields,
      };
      setNotes([newNote, ...notes]);
    }

    clearForm();
  }

  function startEditing(item) {
    const isList = item.type === "checklist";
    setEditingId(item.id);
    setTitle(item.title);
    setBody(isList ? (item.items || []).map((entry) => entry.text).join("\n") : item.body);
    setTag(item.tag || "");
    setIsChecklist(isList);
    setIsLocked(!!item.locked);
  }

  function deleteNote(id) {
    setNotes(notes.filter((item) => item.id !== id));
    if (editingId === id) clearForm();
  }

  function togglePin(id) {
    setNotes(notes.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item)));
  }

  function toggleItem(noteId, index) {
    setNotes(
      notes.map((item) => {
        if (item.id !== noteId) return item;
        const items = item.items.map((entry, i) =>
          i === index ? { ...entry, done: !entry.done } : entry
        );
        return { ...item, items: items };
      })
    );
  }

  function clearForm() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setTag("");
    setIsChecklist(false);
    setIsLocked(false);
  }

  // Search and filter. Locked notes only match by title and tag, so nothing leaks.
  const filterOptions = ["All", "Pinned", ...Object.keys(TAGS)];
  const words = search.trim().toLowerCase();

  const shownNotes = notes
    .filter((item) => {
      const isHidden = item.locked && !unlockedIds.includes(item.id);
      let text = item.title + " " + (item.tag || "");
      if (!isHidden) {
        text += " " + (item.body || "");
        text += " " + (item.items || []).map((entry) => entry.text).join(" ");
      }
      const matchesSearch = text.toLowerCase().includes(words);

      let matchesFilter = true;
      if (filter === "Pinned") matchesFilter = !!item.pinned;
      else if (filter !== "All") matchesFilter = item.tag === filter;

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); // pinned notes first

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
  const stripColors = [theme.primary, theme.accent, theme.accent2];

  // The form, search and filters that sit above the list
  const topSection = (
    <View>
      <View style={[styles.formCard, cardStyle]}>
        <TextInput
          style={inputStyle}
          placeholder="Title"
          placeholderTextColor={theme.subText}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={[inputStyle, styles.bodyInput]}
          placeholder={isChecklist ? "One item per line..." : "Write your note..."}
          placeholderTextColor={theme.subText}
          multiline
          value={body}
          onChangeText={setBody}
        />

        <View style={styles.switchRow}>
          <ThemedText>Checklist</ThemedText>
          <Switch
            value={isChecklist}
            onValueChange={setIsChecklist}
            trackColor={{ true: theme.primary }}
          />
        </View>
        <View style={styles.switchRow}>
          <ThemedText>Lock with fingerprint</ThemedText>
          <Switch
            value={isLocked}
            onValueChange={changeLockSwitch}
            trackColor={{ true: theme.primary }}
          />
        </View>

        <View style={styles.chipRow}>
          {["", ...Object.keys(TAGS)].map((name) => {
            const isActive = tag === name;
            const color = name ? TAGS[name] : theme.primary;
            return (
              <TouchableOpacity
                key={name || "none"}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? color : theme.inputBg,
                    borderColor: theme.cardBorder,
                    borderWidth: theme.borderWidth,
                  },
                ]}
                onPress={() => setTag(name)}
              >
                <ThemedText style={{ color: isActive ? "#fff" : theme.text, fontSize: 12 }}>
                  {name || "No tag"}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.saveWrapper} onPress={saveNote}>
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
              <Ionicons
                name={editingId ? "checkmark-circle" : "add-circle"}
                size={22}
                color={theme.headerText}
              />
              <ThemedText style={[styles.saveButtonText, { color: theme.headerText }]}>
                {editingId ? "Update Note" : "Add Note"}
              </ThemedText>
            </LinearGradient>
          </TouchableOpacity>
          {editingId && (
            <TouchableOpacity
              style={[
                styles.cancelButton,
                {
                  backgroundColor: theme.inputBg,
                  borderColor: theme.cardBorder,
                  borderWidth: theme.borderWidth,
                  borderRadius: theme.radius,
                },
              ]}
              onPress={clearForm}
            >
              <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ThemedText style={styles.listHeading}>Your notes</ThemedText>
      <TextInput
        style={inputStyle}
        placeholder="Search notes..."
        placeholderTextColor={theme.subText}
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.chipRow}>
        {filterOptions.map((name) => {
          const isActive = filter === name;
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
              onPress={() => setFilter(name)}
            >
              <ThemedText style={{ color: isActive ? "#fff" : theme.text, fontSize: 12 }}>
                {name}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Notes" subtitle={`${notes.length} saved`} />

      <FlatList
        data={shownNotes}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={topSection}
        ListEmptyComponent={
          <ThemedText style={[styles.empty, { color: theme.subText }]}>
            {notes.length === 0 ? "No notes yet. Write your first one!" : "No matches found"}
          </ThemedText>
        }
        renderItem={({ item }) => {
          const isHidden = item.locked && !unlockedIds.includes(item.id);
          const items = item.items || [];

          return (
            <FadeInView>
              <View
                style={[
                  styles.card,
                  cardStyle,
                  {
                    borderLeftWidth: 8,
                    borderLeftColor: item.tag ? TAGS[item.tag] : stripColors[Number(item.id) % 3],
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <ThemedText style={styles.cardTitle}>{item.title || "Untitled"}</ThemedText>
                  <TouchableOpacity onPress={() => togglePin(item.id)}>
                    <Ionicons
                      name={item.pinned ? "pin" : "pin-outline"}
                      size={22}
                      color={item.pinned ? theme.primary : theme.subText}
                    />
                  </TouchableOpacity>
                </View>

                {item.tag ? (
                  <View style={[styles.tagBadge, { backgroundColor: TAGS[item.tag] }]}>
                    <ThemedText style={styles.tagBadgeText}>{item.tag}</ThemedText>
                  </View>
                ) : null}

                {isHidden ? (
                  <TouchableOpacity style={styles.lockedBox} onPress={() => unlockNote(item.id)}>
                    <Ionicons name="lock-closed" size={20} color={theme.primary} />
                    <ThemedText style={[styles.lockedText, { color: theme.subText }]}>
                      Locked. Tap to unlock with fingerprint
                    </ThemedText>
                  </TouchableOpacity>
                ) : item.type === "checklist" ? (
                  <View style={styles.cardBody}>
                    {items.map((entry, index) => (
                      <TouchableOpacity
                        key={index}
                        style={styles.itemRow}
                        onPress={() => toggleItem(item.id, index)}
                      >
                        <Ionicons
                          name={entry.done ? "checkbox" : "square-outline"}
                          size={22}
                          color={theme.primary}
                        />
                        <ThemedText style={[styles.itemText, entry.done && styles.itemDone]}>
                          {entry.text}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : item.body ? (
                  <ThemedText style={styles.cardBody}>{item.body}</ThemedText>
                ) : null}

                <View style={styles.cardFooter}>
                  <ThemedText style={[styles.cardDate, { color: theme.subText }]}>
                    {new Date(item.date).toLocaleDateString()}
                  </ThemedText>
                  {!isHidden && (
                    <View style={styles.cardActions}>
                      <TouchableOpacity onPress={() => startEditing(item)}>
                        <Ionicons name="create-outline" size={22} color={theme.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteNote(item.id)}>
                        <Ionicons
                          name="trash-outline"
                          size={22}
                          color="#E17055"
                          style={styles.trashIcon}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </FadeInView>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  formCard: { padding: 16, marginTop: -10 },
  input: { borderRadius: 12, padding: 12, marginBottom: 10 },
  bodyInput: { height: 100, textAlignVertical: "top" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  chip: {
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  buttonRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  saveWrapper: { flex: 1 },
  saveButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
  },
  saveButtonText: { fontWeight: "bold", fontSize: 16, marginLeft: 8 },
  cancelButton: { marginLeft: 10, paddingVertical: 14, paddingHorizontal: 18 },
  cancelButtonText: { fontWeight: "600" },
  listHeading: { fontSize: 18, fontWeight: "bold", marginTop: 20, marginBottom: 10 },
  empty: { textAlign: "center", marginTop: 10 },
  card: { padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 18, fontWeight: "bold", flex: 1, marginRight: 10 },
  tagBadge: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  tagBadgeText: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  cardBody: { marginTop: 8, lineHeight: 20 },
  itemRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  itemText: { marginLeft: 8, flex: 1 },
  itemDone: { textDecorationLine: "line-through", opacity: 0.5 },
  lockedBox: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  lockedText: { marginLeft: 8, flex: 1 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  cardDate: { fontSize: 12 },
  cardActions: { flexDirection: "row" },
  trashIcon: { marginLeft: 16 },
});