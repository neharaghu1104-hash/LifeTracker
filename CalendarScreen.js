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
import { Calendar } from "react-native-calendars";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Header from "./Header";
import FadeInView from "./FadeInView";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import {
  getToday,
  byTime,
  eventsOn,
  countdownText,
  formatDate,
  getUpcoming,
} from "./dateHelpers";
import { useFocusEffect } from "@react-navigation/native";

const STORAGE_KEY = "events";

// Checks a time like "09:30" or "18:00"
function isValidTime(text) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
}

export default function CalendarScreen() {
  const { theme, themeName } = useTheme();
  const [events, setEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [visibleYear, setVisibleYear] = useState(new Date().getFullYear());
  const [view, setView] = useState("day"); // "day" or "agenda"
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [time, setTime] = useState("09:00"); // 24-hour format
  const [repeatYearly, setRepeatYearly] = useState(false);
  const [loaded, setLoaded] = useState(false);

    // Load saved events every time this tab is opened
  useFocusEffect(
    useCallback(() => {
      async function loadEvents() {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setEvents(JSON.parse(saved));
        setLoaded(true);
      }
      loadEvents();
    }, [])
  );
  // Save whenever the list changes (after the first load is done)
  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    }
  }, [events, loaded]);

  function addEvent() {
    if (!title.trim()) return;

    if (!isValidTime(time)) {
      Alert.alert("Invalid time", "Please use 24-hour format like 09:30 or 18:00");
      return;
    }

    const newEvent = {
      id: Date.now().toString(),
      title: title.trim(),
      note: note.trim(),
      date: selectedDate,
      time: time,
      repeat: repeatYearly ? "yearly" : "none",
    };

    setEvents([...events, newEvent]);
    setTitle("");
    setNote("");
    setRepeatYearly(false);
  }

  function deleteEvent(id) {
    setEvents(events.filter((item) => item.id !== id));
  }

  // The list below the form: the selected day, or the next 30 days
  const listItems =
    view === "day"
      ? eventsOn(events, selectedDate)
          .sort(byTime)
          .map((item) => ({ key: item.id, date: selectedDate, event: item }))
      : getUpcoming(events, 30);

  // Put a dot under every date that has an event
  const markedDates = {};
  events.forEach((item) => {
    if (item.repeat === "yearly") {
      // Show yearly events in the years around the one on screen
      [visibleYear - 1, visibleYear, visibleYear + 1].forEach((year) => {
        const dateString = `${year}-${item.date.slice(5)}`;
        if (dateString >= item.date) {
          markedDates[dateString] = { marked: true, dotColor: theme.accent };
        }
      });
    } else {
      markedDates[item.date] = { marked: true, dotColor: theme.accent };
    }
  });
  // Highlight the selected date
  markedDates[selectedDate] = {
    ...markedDates[selectedDate],
    selected: true,
    selectedColor: theme.primary,
  };

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

  // Each event gets one of these colors for its left strip
  const stripColors = [theme.primary, theme.accent, theme.accent2];

  // The calendar and form that sit above the list
  const topSection = (
    <View>
      <View style={[styles.calendarCard, cardStyle]}>
        <Calendar
          key={themeName}
          markedDates={markedDates}
          onDayPress={(day) => {
            setSelectedDate(day.dateString);
            setView("day");
          }}
          onMonthChange={(month) => setVisibleYear(month.year)}
          theme={{
            calendarBackground: theme.card,
            textSectionTitleColor: theme.subText,
            dayTextColor: theme.text,
            todayTextColor: theme.primary,
            selectedDayTextColor: theme.headerText,
            textDisabledColor: theme.subText,
            monthTextColor: theme.text,
            arrowColor: theme.primary,
            textMonthFontWeight: "bold",
            textMonthFontSize: 18,
            textDayFontFamily: theme.fontFamily,
            textMonthFontFamily: theme.fontFamily,
            textDayHeaderFontFamily: theme.fontFamily,
          }}
        />
      </View>

      <View style={[styles.formCard, cardStyle]}>
        <ThemedText style={styles.formHeading}>
          New event on {formatDate(selectedDate)}
        </ThemedText>
        <TextInput
          style={inputStyle}
          placeholder="Event title (e.g. Mom's birthday)"
          placeholderTextColor={theme.subText}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={inputStyle}
          placeholder="Note (optional)"
          placeholderTextColor={theme.subText}
          value={note}
          onChangeText={setNote}
        />
        <TextInput
          style={inputStyle}
          placeholder="Time (24-hour, e.g. 09:30)"
          placeholderTextColor={theme.subText}
          value={time}
          onChangeText={setTime}
        />

        <View style={styles.switchRow}>
          <ThemedText>Repeat every year</ThemedText>
          <Switch
            value={repeatYearly}
            onValueChange={setRepeatYearly}
            trackColor={{ true: theme.primary }}
          />
        </View>

        <TouchableOpacity onPress={addEvent}>
          <LinearGradient
            colors={theme.headerGradient}
            style={[
              styles.addButton,
              {
                borderColor: theme.cardBorder,
                borderWidth: theme.borderWidth,
                borderRadius: theme.radius,
              },
            ]}
          >
            <Ionicons name="add-circle" size={22} color={theme.headerText} />
            <ThemedText style={[styles.addButtonText, { color: theme.headerText }]}>
              Add Event
            </ThemedText>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Switch between the selected day and the next 30 days */}
      <View style={styles.viewRow}>
        {[
          { id: "day", label: "Selected day" },
          { id: "agenda", label: "Next 30 days" },
        ].map((option) => {
          const isActive = view === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.viewButton,
                {
                  backgroundColor: isActive ? theme.primary : theme.inputBg,
                  borderColor: theme.cardBorder,
                  borderWidth: theme.borderWidth,
                },
              ]}
              onPress={() => setView(option.id)}
            >
              <ThemedText style={{ color: isActive ? "#fff" : theme.text, fontWeight: "bold" }}>
                {option.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>

      <ThemedText style={styles.listHeading}>
        {view === "day" ? `Events on ${formatDate(selectedDate)}` : "Coming up"}
      </ThemedText>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Header title="Calendar" subtitle="Plan your important days" />

      <FlatList
        data={listItems}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={topSection}
        ListEmptyComponent={
          <ThemedText style={[styles.empty, { color: theme.subText }]}>
            {view === "day" ? "No events on this day" : "Nothing planned in the next 30 days"}
          </ThemedText>
        }
        renderItem={({ item }) => (
          <FadeInView>
            <View
              style={[
                styles.card,
                cardStyle,
                { borderLeftWidth: 8, borderLeftColor: stripColors[Number(item.event.id) % 3] },
              ]}
            >
              <View style={styles.cardText}>
                {view === "agenda" && (
                  <ThemedText style={[styles.cardDate, { color: theme.subText }]}>
                    {formatDate(item.date)}
                  </ThemedText>
                )}
                <ThemedText style={styles.cardTitle}>{item.event.title}</ThemedText>

                <View style={styles.metaRow}>
                  {item.event.time ? (
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={14} color={theme.primary} />
                      <ThemedText style={[styles.metaText, { color: theme.primary }]}>
                        {item.event.time}
                      </ThemedText>
                    </View>
                  ) : null}
                  <View style={styles.metaItem}>
                    <Ionicons name="hourglass-outline" size={14} color={theme.accent} />
                    <ThemedText style={[styles.metaText, { color: theme.accent }]}>
                      {countdownText(item.date)}
                    </ThemedText>
                  </View>
                  {item.event.repeat === "yearly" && (
                    <View style={styles.metaItem}>
                      <Ionicons name="repeat" size={14} color={theme.subText} />
                      <ThemedText style={[styles.metaText, { color: theme.subText }]}>
                        Yearly
                      </ThemedText>
                    </View>
                  )}
                </View>

                {item.event.note ? (
                  <ThemedText style={styles.cardNote}>{item.event.note}</ThemedText>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => deleteEvent(item.event.id)}>
                <Ionicons name="trash-outline" size={22} color="#E17055" />
              </TouchableOpacity>
            </View>
          </FadeInView>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  calendarCard: { padding: 8, marginTop: -10, overflow: "hidden" },
  formCard: { padding: 16, marginTop: 16 },
  formHeading: { fontSize: 16, fontWeight: "bold", marginBottom: 10 },
  input: { borderRadius: 12, padding: 12, marginBottom: 10 },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
  },
  addButtonText: { fontWeight: "bold", fontSize: 16, marginLeft: 8 },
  viewRow: { flexDirection: "row", marginTop: 16 },
  viewButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
  },
  listHeading: { fontSize: 18, fontWeight: "bold", marginTop: 16, marginBottom: 10 },
  empty: { textAlign: "center", marginTop: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 10,
  },
  cardText: { flex: 1, marginRight: 10 },
  cardDate: { fontSize: 12, marginBottom: 2 },
  cardTitle: { fontSize: 17, fontWeight: "bold" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  metaItem: { flexDirection: "row", alignItems: "center", marginRight: 14 },
  metaText: { marginLeft: 4, fontSize: 13 },
  cardNote: { marginTop: 6 },
});