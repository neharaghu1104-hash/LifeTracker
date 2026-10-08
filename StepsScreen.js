import { useState, useEffect, useRef } from "react";
import { AppState, View, ScrollView, Animated, StyleSheet, TouchableOpacity } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Pedometer } from "expo-sensors";
import {
  hasBuiltInCounter,
  askStepPermission,
  startStepCounter,
  refreshSteps,
  openBatterySettings,
  openAppSettings,
} from "./stepCounter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Header from "./Header";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";

const STORAGE_KEY = "stepHistory";
const DAILY_GOAL = 6000;
const SIZE = 220;
const STROKE = 18;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function dateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function StepsScreen() {
  const { theme } = useTheme();
  const [history, setHistory] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("Starting...");
  const lastCount = useRef(0);
  const builtInOn = useRef(false); // true when the built-in all-day counter is working
  const [permission, setPermission] = useState("checking"); // "checking", "granted" or "denied"
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function loadHistory() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setHistory(JSON.parse(saved));
      } finally {
        setLoaded(true);
      }
    }
    loadHistory();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history, loaded]);

  // Reads the all-day totals saved by the built-in counter
  async function refreshBuiltIn() {
    const merged = await refreshSteps();
    if (!merged) return false;
    builtInOn.current = true;
    setHistory(merged);
    setStatus("Counting all day, even when the app is closed");
    return true;
  }

  useEffect(() => {
    if (!loaded) return;
    let subscription = null;
    let timer = null;
    let active = true;

    async function startCounting() {
      // 1. Ask the phone for permission (the "Allow physical activity?" question)
      const allowed = await askStepPermission();
      if (!active) return;
      setPermission(allowed ? "granted" : "denied");
      if (!allowed) {
        setStatus("Allow Physical activity permission to count steps");
        return;
      }

      // 2. All-day counting: the phone's step sensor + a background reader
      if (hasBuiltInCounter()) {
        await startStepCounter();
        if (await refreshBuiltIn()) {
          timer = setInterval(refreshBuiltIn, 10000); // keep the number fresh while this screen is open
          return;
        }
      }

      // 3. Older way: live counting only while the app is open
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        setStatus("Step sensor is not available on this phone");
        return;
      }

      const permission = await Pedometer.requestPermissionsAsync();
      if (!permission.granted) {
        setStatus("Allow Physical activity permission in phone settings");
        return;
      }

      setStatus("Live tracking is on");
      lastCount.current = 0;
      subscription = Pedometer.watchStepCount(result => {
        if (!active || builtInOn.current) return;
        const newSteps = result.steps - lastCount.current;
        lastCount.current = result.steps;
        if (newSteps <= 0) return;
        const today = dateKey(new Date());
        setHistory(old => ({ ...old, [today]: (old[today] || 0) + newSteps }));
      });
    }

    startCounting();

    const appState = AppState.addEventListener("change", async state => {
      if (state === "active" && builtInOn.current) await refreshBuiltIn();
    });

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      if (subscription) subscription.remove();
      appState.remove();
    };
  }, [loaded]);

  const todaySteps = history[dateKey(new Date())] || 0;
  const fraction = Math.min(todaySteps / DAILY_GOAL, 1);

  useEffect(() => {
    Animated.timing(progress, { toValue: fraction, duration: 800, useNativeDriver: false }).start();
  }, [fraction]);

  const strokeDashoffset = progress.interpolate({ inputRange: [0, 1], outputRange: [CIRCUMFERENCE, 0] });
  const distanceKm = (todaySteps * 0.0008).toFixed(2);
  const calories = Math.round(todaySteps * 0.04);

  const lastSevenDays = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    const key = dateKey(day);
    lastSevenDays.push({ key, label: day.toLocaleDateString("en-US", { weekday: "short" }), steps: history[key] || 0, isToday: i === 0 });
  }

  const cardStyle = {
    backgroundColor: theme.card,
    borderColor: theme.cardBorder,
    borderWidth: theme.borderWidth,
    borderRadius: theme.radius,
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <Header title="Steps" subtitle={status} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.ringCard, cardStyle]}>
          <View style={styles.ringWrapper}>
            <Svg width={SIZE} height={SIZE}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={theme.inputBg} strokeWidth={STROKE} fill="none" />
              <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={theme.primary} strokeWidth={STROKE} fill="none" strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={strokeDashoffset} rotation="-90" origin={`${SIZE / 2}, ${SIZE / 2}`} />
            </Svg>
            <View style={styles.ringCenter}>
              <Ionicons name="footsteps" size={28} color={theme.primary} />
              <ThemedText style={styles.stepsNumber}>{todaySteps}</ThemedText>
              <ThemedText style={{ color: theme.subText }}>of {DAILY_GOAL} steps</ThemedText>
            </View>
          </View>
        </View>

        {permission === "denied" && (
          <View style={[styles.helpCard, cardStyle]}>
            <ThemedText style={{ color: theme.subText, lineHeight: 20 }}>
              Steps are counted by your phone's step sensor. LifeTracker needs the Physical activity permission to read it.
            </ThemedText>
            <TouchableOpacity onPress={openAppSettings} style={[styles.helpButton, { backgroundColor: theme.primary }]}>
              <ThemedText style={{ color: "#fff", fontWeight: "800" }}>Open settings</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {permission === "granted" && hasBuiltInCounter() && (
          <View style={[styles.helpCard, cardStyle]}>
            <ThemedText style={{ color: theme.subText, lineHeight: 20 }}>
              Tip: on some phones, battery saving stops background apps. Set LifeTracker to "Unrestricted" or "Don't optimize" so steps are never missed.
            </ThemedText>
            <TouchableOpacity onPress={openBatterySettings} style={[styles.helpButton, { backgroundColor: theme.primary }]}>
              <ThemedText style={{ color: "#fff", fontWeight: "800" }}>Battery settings</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.statRow}>
          <View style={[styles.statCard, cardStyle]}><Ionicons name="flame" size={26} color={theme.accent} /><ThemedText style={styles.statValue}>{calories}</ThemedText><ThemedText style={[styles.statLabel, { color: theme.subText }]}>kcal (approx)</ThemedText></View>
          <View style={[styles.statCard, cardStyle]}><Ionicons name="navigate" size={26} color={theme.accent2} /><ThemedText style={styles.statValue}>{distanceKm}</ThemedText><ThemedText style={[styles.statLabel, { color: theme.subText }]}>km (approx)</ThemedText></View>
        </View>

        <View style={[styles.weekCard, cardStyle]}>
          <ThemedText style={styles.weekTitle}>Last 7 days</ThemedText>
          <View style={styles.weekRow}>
            {lastSevenDays.map(day => {
              const barHeight = Math.max(Math.min(day.steps / DAILY_GOAL, 1) * 100, 6);
              return <View key={day.key} style={styles.dayColumn}>
                <ThemedText style={[styles.dayCount, { color: theme.subText }]}>{day.steps}</ThemedText>
                <View style={styles.barTrack}><View style={[styles.bar, { height: barHeight, backgroundColor: day.isToday ? theme.primary : theme.accent2 }]} /></View>
                <ThemedText style={[styles.dayLabel, { color: day.isToday ? theme.primary : theme.subText }, day.isToday && { fontWeight: "bold" }]}>{day.label}</ThemedText>
              </View>;
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  ringCard: { padding: 20, alignItems: "center", marginTop: -10 },
  ringWrapper: { width: SIZE, height: SIZE },
  ringCenter: { position: "absolute", width: SIZE, height: SIZE, justifyContent: "center", alignItems: "center" },
  stepsNumber: { fontSize: 40, fontWeight: "bold" },
  helpCard: { padding: 16, marginTop: 16 },
  helpButton: { padding: 13, borderRadius: 12, alignItems: "center", marginTop: 12 },
  statRow: { flexDirection: "row", marginTop: 16 },
  statCard: { flex: 1, padding: 16, marginHorizontal: 6 },
  statValue: { fontSize: 26, fontWeight: "bold", marginTop: 6 },
  statLabel: { fontSize: 12 },
  weekCard: { padding: 16, marginTop: 16 },
  weekTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  dayColumn: { alignItems: "center", flex: 1 },
  dayCount: { fontSize: 9, marginBottom: 4 },
  barTrack: { height: 100, justifyContent: "flex-end" },
  bar: { width: 22, borderRadius: 11 },
  dayLabel: { marginTop: 6, fontSize: 12 },
});
