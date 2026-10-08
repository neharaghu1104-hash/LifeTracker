import AsyncStorage from "@react-native-async-storage/async-storage";
import { getToday, dateToString, eventsOn } from "./dateHelpers";

// Expenses and notes are saved with a full timestamp like "2026-10-06T19:00:00.000Z".
// These two turn it into the local day ("2026-10-07") and local time ("00:30").
export function dayOf(item) {
  return dateToString(new Date(item.date));
}

export function timeOf(item) {
  const d = new Date(item.date);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export const KEYS = {
  expenses: "expenses",
  notes: "notes",
  events: "events",
  steps: "stepHistory",
  focus: "dailyFocus",
  mood: "dailyMood",
  goals: "lifeGoals",
  budgets: "budgets",
  privacy: "privacySettings",
  username: "username",
};

export async function loadLifeData() {
  const keys = Object.values(KEYS);
  const values = await AsyncStorage.multiGet(keys);
  const map = Object.fromEntries(values);
  const json = (key, fallback) => {
    try { return map[key] ? JSON.parse(map[key]) : fallback; } catch { return fallback; }
  };
  return {
    expenses: json(KEYS.expenses, []),
    notes: json(KEYS.notes, []),
    events: json(KEYS.events, []),
    steps: json(KEYS.steps, {}),
    focus: json(KEYS.focus, {}),
    mood: json(KEYS.mood, {}),
    goals: json(KEYS.goals, []),
    budgets: json(KEYS.budgets, {}),
    privacy: json(KEYS.privacy, { autoLockSeconds: 30, protectExpenses: false, protectTimeline: false }),
    username: map[KEYS.username] || "",
  };
}

export async function saveJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export function dayData(data, date = getToday()) {
  return {
    focus: data.focus?.[date] || [],
    mood: data.mood?.[date] || null,
    steps: data.steps?.[date] || 0,
    events: eventsOn(data.events || [], date), // includes yearly events like birthdays
    expenses: (data.expenses || []).filter((e) => dayOf(e) === date),
    notes: (data.notes || []).filter((n) => dayOf(n) === date),
  };
}

export function monthExpenses(expenses, date = new Date()) {
  return expenses.filter((e) => {
    if (e.type === "income") return false;
    const d = new Date(e.date);
    return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
  });
}

export function buildTimeline(data, date = getToday()) {
  const day = dayData(data, date);
  const rows = [];
  day.events.forEach((e) => rows.push({ id: `event-${e.id}`, time: e.time || "--:--", icon: "calendar", title: e.title, detail: e.note || "Event", kind: "event" }));
  day.expenses.forEach((e) => rows.push({ id: `expense-${e.id}`, time: timeOf(e), icon: e.type === "income" ? "arrow-down" : "wallet", title: `${e.type === "income" ? "+" : "−"}₹${Number(e.amount || 0).toFixed(0)} · ${e.title}`, detail: e.category || "Expense", kind: "expense" }));
  day.notes.forEach((n) => rows.push({ id: `note-${n.id}`, time: timeOf(n), icon: "document-text", title: n.title || "Untitled note", detail: n.locked ? "Locked note" : (n.tag || "Note"), kind: "note" }));
  day.focus.filter((f) => f.completed).forEach((f) => rows.push({ id: `focus-${f.id}`, time: f.completedAt || "", icon: "checkmark-circle", title: f.title, detail: "Focus completed", kind: "focus" }));
  if (day.steps > 0) rows.push({ id: `steps-${date}`, time: "", icon: "footsteps", title: `${day.steps.toLocaleString()} steps`, detail: "Activity", kind: "steps" });
  if (day.mood) rows.push({ id: `mood-${date}`, time: "", icon: "happy", title: `${day.mood.mood}/5 mood`, detail: `Energy ${day.mood.energy}/10`, kind: "mood" });
  return rows.sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}

export function dateRange(days = 7) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    out.push(dateToString(d));
  }
  return out;
}