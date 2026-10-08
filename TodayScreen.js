import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { refreshSteps } from "./stepCounter";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Rect, Ellipse, Circle, Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Header from "./Header";
import QuickAdd from "./QuickAdd";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import { buildInsights } from "./insights";
import {
  getToday,
  byTime,
  eventsOn,
  countdownText,
  formatDate,
  getUpcoming,
} from "./dateHelpers";

const CURRENCY = "₹"; // change to your currency
const DAILY_GOAL = 6000; // same goal as the Steps screen

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getMood(progress) {
  if (progress === 0) return "I'm thirsty. Let's go for a walk!";
  if (progress < 0.5) return "Growing nicely, keep moving!";
  if (progress < 1) return "Almost in bloom!";
  return "In full bloom! You did it!";
}

// Leaves appear one by one as your steps go up
const LEAVES = [
  { at: 0.2, x: 82, y: 128, angle: -30 },
  { at: 0.4, x: 118, y: 112, angle: 30 },
  { at: 0.6, x: 82, y: 96, angle: -30 },
  { at: 0.8, x: 118, y: 80, angle: 30 },
];

// The plant companion: grows with your steps and sways gently
function PlantBuddy({ progress }) {
  const sway = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const rotate = sway.interpolate({
    inputRange: [0, 1],
    outputRange: ["-3deg", "3deg"],
  });

  const stemHeight = 20 + progress * 90;
  const stemTop = 150 - stemHeight;

  return (
    <Animated.View style={{ transform: [{ rotate: rotate }] }}>
      <Svg width={200} height={200} viewBox="0 0 200 200">
        {/* stem */}
        <Rect x={97} y={stemTop} width={6} height={stemHeight} rx={3} fill="#4CAF50" />

        {/* leaves */}
        {LEAVES.filter((leaf) => progress >= leaf.at).map((leaf) => (
          <Ellipse
            key={leaf.at}
            cx={leaf.x}
            cy={leaf.y}
            rx={20}
            ry={9}
            fill="#66BB6A"
            transform={`rotate(${leaf.angle} ${leaf.x} ${leaf.y})`}
          />
        ))}

        {/* bud, or flower when the goal is reached */}
        {progress >= 1 ? (
          <>
            <Circle cx={100} cy={stemTop} r={15} fill="#FF6B9D" />
            <Circle cx={100} cy={stemTop} r={6} fill="#FFD93D" />
          </>
        ) : (
          <Circle cx={100} cy={stemTop} r={6} fill="#81C784" />
        )}

        {/* pot */}
        <Path d="M65 150 L135 150 L125 190 L75 190 Z" fill="#C2703D" />
        <Rect x={60} y={145} width={80} height={10} rx={4} fill="#A85A2D" />

        {/* face */}
        <Circle cx={88} cy={168} r={3} fill="#FFFFFF" />
        <Circle cx={112} cy={168} r={3} fill="#FFFFFF" />
        <Path d="M91 175 Q100 183 109 175" stroke="#FFFFFF" strokeWidth={2} fill="none" />
      </Svg>
    </Animated.View>
  );
}

// One group of search results (Expenses, Notes or Events)
function ResultSection({ title, icon, rows, onPress }) {
  const { theme } = useTheme();
  if (rows.length === 0) return null;

  return (
    <View style={styles.resultSection}>
      <View style={styles.resultTitleRow}>
        <Ionicons name={icon} size={18} color={theme.primary} />
        <ThemedText style={styles.resultTitle}>{title}</ThemedText>
      </View>
      {rows.map((row) => (
        <TouchableOpacity key={row.id} style={styles.resultRow} onPress={onPress}>
          <ThemedText style={styles.resultMain}>{row.main}</ThemedText>
          <ThemedText style={{ color: theme.subText, fontSize: 12 }}>{row.sub}</ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function TodayScreen({ navigation }) {
  const { theme } = useTheme();
  const [username, setUsername] = useState("");
  const [todaySteps, setTodaySteps] = useState(0);
  const [monthSpend, setMonthSpend] = useState(0);
  const [todayEvents, setTodayEvents] = useState([]);
  const [comingUp, setComingUp] = useState([]);
  const [noteCount, setNoteCount] = useState(0);
  const [insights, setInsights] = useState([]);
  const [focusItems, setFocusItems] = useState([]);
  const [moodData, setMoodData] = useState(null);

  // Everything saved, used for the search box
  const [allExpenses, setAllExpenses] = useState([]);
  const [allNotes, setAllNotes] = useState([]);
  const [allEvents, setAllEvents] = useState([]);

  const [query, setQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [toast, setToast] = useState("");

  // Reads everything from the phone
  async function loadData() {
    const savedName = await AsyncStorage.getItem("username");
    setUsername(savedName || "");

    await refreshSteps(); // brings in the steps counted while the app was closed
    const stepsSaved = await AsyncStorage.getItem("stepHistory");
    const stepHistory = stepsSaved ? JSON.parse(stepsSaved) : {};
    setTodaySteps(stepHistory[getToday()] || 0);

    const expensesSaved = await AsyncStorage.getItem("expenses");
    const expenses = expensesSaved ? JSON.parse(expensesSaved) : [];
    setAllExpenses(expenses);
    const now = new Date();
    const total = expenses
      .filter((item) => {
        const d = new Date(item.date);
        return (
          item.type !== "income" &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      })
      .reduce((sum, item) => sum + item.amount, 0);
    setMonthSpend(total);

    const budgetsSaved = await AsyncStorage.getItem("budgets");
    const budgets = budgetsSaved ? JSON.parse(budgetsSaved) : {};

    const eventsSaved = await AsyncStorage.getItem("events");
    const events = eventsSaved ? JSON.parse(eventsSaved) : [];
    setAllEvents(events);
    setTodayEvents(eventsOn(events, getToday()).sort(byTime));
    setComingUp(
      getUpcoming(events, 31)
        .filter((entry) => entry.date !== getToday())
        .slice(0, 3)
    );

    const notesSaved = await AsyncStorage.getItem("notes");
    const notes = notesSaved ? JSON.parse(notesSaved) : [];
    setAllNotes(notes);
    setNoteCount(notes.length);

    const focusSaved = await AsyncStorage.getItem("dailyFocus");
    const focusAll = focusSaved ? JSON.parse(focusSaved) : {};
    setFocusItems(focusAll[getToday()] || []);

    const moodSaved = await AsyncStorage.getItem("dailyMood");
    const moodAll = moodSaved ? JSON.parse(moodSaved) : {};
    setMoodData(moodAll[getToday()] || null);

    setInsights(buildInsights(expenses, budgets, stepHistory));
  }

  // Reload the data every time this tab is opened
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // After something was added with the + button
  function handleAdded(kind) {
    setQuickOpen(false);
    loadData();
    const names = { expense: "Expense", note: "Note", event: "Event" };
    setToast(`${names[kind]} added`);
    setTimeout(() => setToast(""), 2000);
  }

  const progress = Math.min(todaySteps / DAILY_GOAL, 1);

  // "Good afternoon, Neha"
  const greeting = username ? `${getGreeting()}, ${username}` : getGreeting();

  // ----- Search across expenses, notes and events -----
  const words = query.trim().toLowerCase();
  const searching = words.length >= 2;

  let expenseRows = [];
  let noteRows = [];
  let eventRows = [];

  if (searching) {
    expenseRows = allExpenses
      .filter((item) => (item.title + " " + (item.category || "")).toLowerCase().includes(words))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        main: item.title,
        sub: `${item.type === "income" ? "+" : ""}${CURRENCY}${item.amount} · ${item.category}`,
      }));

    // Locked notes only match by title and tag, so nothing leaks
    noteRows = allNotes
      .filter((item) => {
        let text = (item.title || "") + " " + (item.tag || "");
        if (!item.locked) {
          text += " " + (item.body || "");
          text += " " + (item.items || []).map((entry) => entry.text).join(" ");
        }
        return text.toLowerCase().includes(words);
      })
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        main: item.title || "Untitled",
        sub: item.locked ? "Locked note" : item.tag || "Note",
      }));

    eventRows = allEvents
      .filter((item) => (item.title + " " + (item.note || "")).toLowerCase().includes(words))
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        main: item.title,
        sub: `${formatDate(item.date)}${item.time ? " · " + item.time : ""}`,
      }));
  }
  const noResults =
    searching && expenseRows.length + noteRows.length + eventRows.length === 0;

  // Card look comes from the current theme
  const cardStyle = {
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: theme.borderWidth,
    borderRadius: theme.radius,
  };

  const stats = [
    { icon: "wallet", value: `${CURRENCY}${monthSpend.toFixed(0)}`, label: "Spent this month" },
    { icon: "calendar", value: String(todayEvents.length), label: "Events today" },
    { icon: "document-text", value: String(noteCount), label: "Notes" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title={greeting} subtitle={new Date().toDateString()} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Search box */}
        <View style={[styles.searchCard, cardStyle]}>
          <Ionicons name="search" size={20} color={theme.subText} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search expenses, notes, events..."
            placeholderTextColor={theme.subText}
            value={query}
            onChangeText={setQuery}
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={20} color={theme.subText} />
            </TouchableOpacity>
          ) : null}
        </View>

        {searching ? (
          // Search results
          <View style={[styles.sectionCard, cardStyle]}>
            <ResultSection
              title="Expenses"
              icon="wallet"
              rows={expenseRows}
              onPress={() => navigation.navigate("Expenses")}
            />
            <ResultSection
              title="Notes"
              icon="document-text"
              rows={noteRows}
              onPress={() => navigation.navigate("Notes")}
            />
            <ResultSection
              title="Events"
              icon="calendar"
              rows={eventRows}
              onPress={() => navigation.navigate("Calendar")}
            />
            {noResults && (
              <ThemedText style={{ color: theme.subText }}>No matches found</ThemedText>
            )}
          </View>
        ) : (
          <View>
            {/* Plant companion */}
            <View style={[styles.buddyCard, cardStyle]}>
              <PlantBuddy progress={progress} />
              <ThemedText style={styles.mood}>{getMood(progress)}</ThemedText>
              <ThemedText style={{ color: theme.subText }}>
                {todaySteps} / {DAILY_GOAL} steps today
              </ThemedText>
            </View>

            {/* Stat cards */}
            <View style={styles.statRow}>
              {stats.map((stat) => (
                <View key={stat.label} style={[styles.statCard, cardStyle]}>
                  <Ionicons name={stat.icon} size={22} color={theme.primary} />
                  <ThemedText style={styles.statValue}>{stat.value}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.subText }]}>
                    {stat.label}
                  </ThemedText>
                </View>
              ))}
            </View>

            {/* Insights */}
            <View style={[styles.sectionCard, cardStyle]}>
              <ThemedText style={styles.sectionTitle}>Insights</ThemedText>
              {insights.length === 0 ? (
                <ThemedText style={{ color: theme.subText }}>
                  Add a few expenses and walk around a bit, and I'll start spotting patterns.
                </ThemedText>
              ) : (
                insights.map((entry) => (
                  <View key={entry.text} style={styles.insightRow}>
                    <Ionicons name={entry.icon} size={20} color={theme.accent} />
                    <ThemedText style={styles.insightText}>{entry.text}</ThemedText>
                  </View>
                ))
              )}
            </View>

            {/* Today's events */}
            <View style={[styles.sectionCard, cardStyle]}>
              <ThemedText style={styles.sectionTitle}>Today's events</ThemedText>
              {todayEvents.length === 0 ? (
                <ThemedText style={{ color: theme.subText }}>Nothing planned today</ThemedText>
              ) : (
                todayEvents.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.eventRow}>
                    <ThemedText style={[styles.eventTime, { color: theme.primary }]}>
                      {item.time || "--:--"}
                    </ThemedText>
                    <ThemedText style={styles.eventTitle}>{item.title}</ThemedText>
                  </View>
                ))
              )}
            </View>

            {/* Coming up, with countdowns */}
            <View style={[styles.sectionCard, cardStyle]}>
              <ThemedText style={styles.sectionTitle}>Coming up</ThemedText>
              {comingUp.length === 0 ? (
                <ThemedText style={{ color: theme.subText }}>
                  Nothing in the next 30 days
                </ThemedText>
              ) : (
                comingUp.map((entry) => (
                  <View key={entry.key} style={styles.eventRow}>
                    <ThemedText style={[styles.countdown, { color: theme.accent }]}>
                      {countdownText(entry.date)}
                    </ThemedText>
                    <ThemedText style={styles.eventTitle}>{entry.event.title}</ThemedText>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Small message after adding something */}
      {toast ? (
        <View style={[styles.toast, { backgroundColor: theme.primary }]}>
          <ThemedText style={{ color: "#fff", fontWeight: "bold" }}>{toast}</ThemedText>
        </View>
      ) : null}

      {/* The + button */}
      <TouchableOpacity style={styles.fabWrapper} onPress={() => setQuickOpen(true)}>
        <LinearGradient
          colors={theme.headerGradient}
          style={[
            styles.fab,
            { borderColor: theme.cardBorder, borderWidth: theme.borderWidth },
          ]}
        >
          <Ionicons name="add" size={32} color={theme.headerText} />
        </LinearGradient>
      </TouchableOpacity>

      <QuickAdd
        visible={quickOpen}
        onClose={() => setQuickOpen(false)}
        onAdded={handleAdded}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  searchCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: -10,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, fontSize: 15 },
  briefCard: { padding: 16, marginTop: 14 },
  briefHeader: { flexDirection: "row", alignItems: "center" },
  briefIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 10 },
  briefTitle: { fontSize: 18, fontWeight: "800" },
  briefText: { marginTop: 14, lineHeight: 21 },
  briefActions: { flexDirection: "row", gap: 8, marginTop: 14 },
  briefButton: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12 },
  balanceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  balanceRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  balanceTrack: { flex: 1, height: 7, borderRadius: 4, marginLeft: 10, overflow: "hidden" },
  balanceFill: { height: 7, borderRadius: 4 },
  focusRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7 },
  focusText: { marginLeft: 9, flex: 1 },
  buddyCard: { alignItems: "center", padding: 16, marginTop: 14 },
  mood: { fontSize: 18, fontWeight: "bold", marginTop: 4, textAlign: "center" },
  statRow: { flexDirection: "row", marginTop: 14 },
  statCard: { flex: 1, padding: 12, marginHorizontal: 4, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "bold", marginTop: 6 },
  statLabel: { fontSize: 11, textAlign: "center", marginTop: 2 },
  sectionCard: { padding: 16, marginTop: 14 },
  sectionTitle: { fontSize: 17, fontWeight: "bold", marginBottom: 10 },
  insightRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  insightText: { flex: 1, marginLeft: 10 },
  eventRow: { flexDirection: "row", marginBottom: 8 },
  eventTime: { width: 60, fontWeight: "bold" },
  countdown: { width: 90, fontWeight: "bold" },
  eventTitle: { flex: 1 },
  resultSection: { marginBottom: 12 },
  resultTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  resultTitle: { fontSize: 15, fontWeight: "bold", marginLeft: 8 },
  resultRow: { paddingVertical: 6, paddingLeft: 26 },
  resultMain: { fontSize: 15 },
  toast: {
    position: "absolute",
    bottom: 96,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  fabWrapper: { position: "absolute", right: 20, bottom: 20 },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
  },
});