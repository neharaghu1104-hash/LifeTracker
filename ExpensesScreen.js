import { useState, useEffect, useCallback } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Header from "./Header";
import FadeInView from "./FadeInView";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import { useFocusEffect } from "@react-navigation/native";

const CURRENCY = "₹"; // change to your currency
const STORAGE_KEY = "expenses";
const BUDGET_KEY = "budgets";

// Each category has an icon and a color
const CATEGORIES = {
  Food: { icon: "restaurant", color: "#E17055" },
  Travel: { icon: "airplane", color: "#0984E3" },
  Bills: { icon: "receipt", color: "#6C5CE7" },
  Shopping: { icon: "bag-handle", color: "#FD79A8" },
  Other: { icon: "ellipsis-horizontal-circle", color: "#00B894" },
};
const INCOME_INFO = { icon: "cash", color: "#2E9E5B" };

// Size of the donut chart
const DONUT = 160;
const DONUT_STROKE = 28;
const DONUT_RADIUS = (DONUT - DONUT_STROKE) / 2;
const DONUT_LENGTH = 2 * Math.PI * DONUT_RADIUS;

export default function ExpensesScreen() {
  const { theme } = useTheme();
  const [expenses, setExpenses] = useState([]); // holds both expenses and income
  const [budgets, setBudgets] = useState({}); // { Food: 5000, Travel: 2000 }
  const [loaded, setLoaded] = useState(false);

  // The add form
  const [type, setType] = useState("expense"); // "expense" or "income"
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");

  // Budget editing
  const [editingBudgets, setEditingBudgets] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState({});

  // Search and filter
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

   // Load saved data every time this tab is opened
  useFocusEffect(
    useCallback(() => {
      async function loadData() {
        try {
          const savedExpenses = await AsyncStorage.getItem(STORAGE_KEY);
          if (savedExpenses) {
            const parsed = JSON.parse(savedExpenses);
            setExpenses(Array.isArray(parsed) ? parsed : []);
          } else {
            setExpenses([]);
          }
        } catch {
          setExpenses([]);
        }

        try {
          const savedBudgets = await AsyncStorage.getItem(BUDGET_KEY);
          if (savedBudgets) {
            const parsed = JSON.parse(savedBudgets);
            setBudgets(parsed && typeof parsed === "object" ? parsed : {});
          } else {
            setBudgets({});
          }
        } catch {
          setBudgets({});
        }

        setLoaded(true);
      }
      loadData();
    }, [])
  );

  // Save whenever something changes (after the first load is done)
  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }, [expenses, loaded]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
  }, [budgets, loaded]);

  function addEntry() {
    const value = Number(amount);
    if (!title.trim() || !value || value <= 0) return;

    const newItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: title.trim(),
      amount: value,
      type: type,
      category: type === "income" ? "Income" : category,
      date: new Date().toISOString(),
    };

    setExpenses((prev) => [newItem, ...prev]);
    setTitle("");
    setAmount("");
  }

  function deleteEntry(id) {
    setExpenses((prev) => prev.filter((item) => item.id !== id));
  }

  function startEditingBudgets() {
    const inputs = {};
    Object.keys(CATEGORIES).forEach((name) => {
      inputs[name] = budgets[name] ? String(budgets[name]) : "";
    });
    setBudgetInputs(inputs);
    setEditingBudgets(true);
  }

  function saveBudgets() {
    const newBudgets = {};
    Object.keys(CATEGORIES).forEach((name) => {
      const value = Number(budgetInputs[name]);
      if (value > 0) newBudgets[name] = value;
    });
    setBudgets(newBudgets);
    setEditingBudgets(false);
  }

  // ----- This month's numbers -----
  const now = new Date();

  function isThisMonth(item) {
    const d = new Date(item.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  const monthItems = expenses.filter(isThisMonth);
  const monthExpenses = monthItems.filter((item) => item.type !== "income");
  const monthSpent = monthExpenses.reduce((sum, item) => sum + item.amount, 0);
  const monthIncome = monthItems
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const balance = monthIncome - monthSpent;

  // Spending per category this month
  const categoryTotals = {};
  Object.keys(CATEGORIES).forEach((name) => {
    categoryTotals[name] = 0;
  });
  monthExpenses.forEach((item) => {
    const key = CATEGORIES[item.category] ? item.category : "Other";
    categoryTotals[key] += item.amount;
  });

  // Donut pieces: each category gets a slice
  let sliceStart = 0;
  const slices = Object.keys(CATEGORIES)
    .filter((name) => categoryTotals[name] > 0)
    .map((name) => {
      const length = (categoryTotals[name] / monthSpent) * DONUT_LENGTH;
      const slice = { name: name, length: length, start: sliceStart };
      sliceStart += length;
      return slice;
    });

  // Spending for the last 6 months, oldest first
  const lastSixMonths = [];
  for (let i = 5; i >= 0; i--) {
    const day = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const total = expenses
      .filter((item) => {
        if (item.type === "income") return false;
        const d = new Date(item.date);
        return d.getMonth() === day.getMonth() && d.getFullYear() === day.getFullYear();
      })
      .reduce((sum, item) => sum + item.amount, 0);
    lastSixMonths.push({
      key: `${day.getFullYear()}-${day.getMonth()}`,
      label: day.toLocaleDateString("en-US", { month: "short" }),
      total: total,
    });
  }
  const biggestMonth = Math.max(...lastSixMonths.map((m) => m.total), 1);

  // ----- Search and filter -----
  const filterOptions = ["All", "Income", ...Object.keys(CATEGORIES)];
  const shownItems = expenses.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(search.trim().toLowerCase());
    let matchesFilter = true;
    if (filter === "Income") {
      matchesFilter = item.type === "income";
    } else if (filter !== "All") {
      matchesFilter = item.type !== "income" && item.category === filter;
    }
    return matchesSearch && matchesFilter;
  });

  // ----- Looks from the current theme -----
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

  // Everything that sits above the list
  const topSection = (
    <View>
      {/* Summary */}
      <LinearGradient
        colors={[theme.accent, theme.accent2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.summaryCard,
          {
            borderRadius: theme.radius,
            borderColor: theme.cardBorder,
            borderWidth: theme.borderWidth,
          },
        ]}
      >
        <ThemedText style={[styles.summaryLabel, { color: theme.headerText }]}>
          Balance this month
        </ThemedText>
        <ThemedText style={[styles.summaryBalance, { color: theme.headerText }]}>
          {balance < 0 ? "-" : ""}
          {CURRENCY}
          {Math.abs(balance).toFixed(2)}
        </ThemedText>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryLabel, { color: theme.headerText }]}>
              Income
            </ThemedText>
            <ThemedText style={[styles.summaryValue, { color: theme.headerText }]}>
              {CURRENCY}
              {monthIncome.toFixed(0)}
            </ThemedText>
          </View>
          <View style={styles.summaryItem}>
            <ThemedText style={[styles.summaryLabel, { color: theme.headerText }]}>
              Spent
            </ThemedText>
            <ThemedText style={[styles.summaryValue, { color: theme.headerText }]}>
              {CURRENCY}
              {monthSpent.toFixed(0)}
            </ThemedText>
          </View>
        </View>
      </LinearGradient>

      {/* Add form */}
      <View style={[styles.sectionCard, cardStyle]}>
        <View style={styles.typeRow}>
          {["expense", "income"].map((name) => {
            const isActive = type === name;
            return (
              <TouchableOpacity
                key={name}
                style={[
                  styles.typeButton,
                  {
                    backgroundColor: isActive ? theme.primary : theme.inputBg,
                    borderColor: theme.cardBorder,
                    borderWidth: theme.borderWidth,
                  },
                ]}
                onPress={() => setType(name)}
              >
                <ThemedText style={{ color: isActive ? "#fff" : theme.text, fontWeight: "bold" }}>
                  {name === "expense" ? "Expense" : "Income"}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={inputStyle}
          placeholder={type === "income" ? "Where did it come from?" : "What did you spend on?"}
          placeholderTextColor={theme.subText}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={inputStyle}
          placeholder="Amount"
          placeholderTextColor={theme.subText}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />

        {type === "expense" && (
          <View style={styles.chipRow}>
            {Object.keys(CATEGORIES).map((name) => {
              const isActive = category === name;
              return (
                <TouchableOpacity
                  key={name}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isActive ? CATEGORIES[name].color : theme.inputBg,
                      borderColor: theme.cardBorder,
                      borderWidth: theme.borderWidth,
                    },
                  ]}
                  onPress={() => setCategory(name)}
                >
                  <Ionicons
                    name={CATEGORIES[name].icon}
                    size={16}
                    color={isActive ? "#fff" : CATEGORIES[name].color}
                  />
                  <ThemedText style={[styles.chipText, isActive && { color: "#fff" }]}>
                    {name}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <TouchableOpacity onPress={addEntry}>
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
              {type === "income" ? "Add Income" : "Add Expense"}
            </ThemedText>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Budgets */}
      <View style={[styles.sectionCard, cardStyle]}>
        <View style={styles.titleRow}>
          <ThemedText style={styles.sectionTitle}>Monthly budgets</ThemedText>
          <TouchableOpacity onPress={editingBudgets ? saveBudgets : startEditingBudgets}>
            <ThemedText style={{ color: theme.primary, fontWeight: "bold" }}>
              {editingBudgets ? "Save" : "Edit"}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {Object.keys(CATEGORIES).map((name) => {
          const spent = categoryTotals[name];
          const limit = budgets[name] || 0;
          const ratio = limit > 0 ? spent / limit : 0;
          const barColor = ratio > 1 ? "#E53935" : ratio >= 0.8 ? "#F5A623" : "#2E9E5B";

          return (
            <View key={name} style={styles.budgetRow}>
              <View style={styles.budgetTop}>
                <View style={styles.budgetName}>
                  <Ionicons name={CATEGORIES[name].icon} size={18} color={CATEGORIES[name].color} />
                  <ThemedText style={styles.budgetNameText}>{name}</ThemedText>
                </View>

                {editingBudgets ? (
                  <TextInput
                    style={[
                      styles.budgetInput,
                      {
                        backgroundColor: theme.inputBg,
                        color: theme.text,
                        borderColor: theme.cardBorder,
                        borderWidth: theme.borderWidth,
                      },
                    ]}
                    placeholder="Limit"
                    placeholderTextColor={theme.subText}
                    keyboardType="numeric"
                    value={budgetInputs[name]}
                    onChangeText={(text) => setBudgetInputs({ ...budgetInputs, [name]: text })}
                  />
                ) : (
                  <ThemedText style={{ color: theme.subText }}>
                    {CURRENCY}
                    {spent.toFixed(0)}
                    {limit > 0 ? ` / ${CURRENCY}${limit}` : " · no budget"}
                  </ThemedText>
                )}
              </View>

              {limit > 0 && !editingBudgets && (
                <View>
                  <View style={[styles.barTrack, { backgroundColor: theme.inputBg }]}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.min(ratio, 1) * 100}%`, backgroundColor: barColor },
                      ]}
                    />
                  </View>
                  {ratio > 1 && (
                    <ThemedText style={styles.overText}>
                      Over budget by {CURRENCY}
                      {(spent - limit).toFixed(0)}
                    </ThemedText>
                  )}
                  {ratio >= 0.8 && ratio <= 1 && (
                    <ThemedText style={styles.nearText}>Almost at your limit</ThemedText>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Charts */}
      <View style={[styles.sectionCard, cardStyle]}>
        <ThemedText style={styles.sectionTitle}>Where it went this month</ThemedText>
        {monthSpent === 0 ? (
          <ThemedText style={{ color: theme.subText }}>No spending this month yet</ThemedText>
        ) : (
          <View style={styles.donutRow}>
            <View style={{ width: DONUT, height: DONUT }}>
              <Svg width={DONUT} height={DONUT}>
                <Circle
                  cx={DONUT / 2}
                  cy={DONUT / 2}
                  r={DONUT_RADIUS}
                  stroke={theme.inputBg}
                  strokeWidth={DONUT_STROKE}
                  fill="none"
                />
                {slices.map((slice) => (
                  <Circle
                    key={slice.name}
                    cx={DONUT / 2}
                    cy={DONUT / 2}
                    r={DONUT_RADIUS}
                    stroke={CATEGORIES[slice.name].color}
                    strokeWidth={DONUT_STROKE}
                    fill="none"
                    strokeDasharray={`${slice.length} ${DONUT_LENGTH - slice.length}`}
                    strokeDashoffset={-slice.start}
                    rotation="-90"
                    origin={`${DONUT / 2}, ${DONUT / 2}`}
                  />
                ))}
              </Svg>
              <View style={styles.donutCenter}>
                <ThemedText style={styles.donutTotal}>
                  {CURRENCY}
                  {monthSpent.toFixed(0)}
                </ThemedText>
              </View>
            </View>

            <View style={styles.legend}>
              {slices.map((slice) => (
                <View key={slice.name} style={styles.legendRow}>
                  <View
                    style={[styles.legendDot, { backgroundColor: CATEGORIES[slice.name].color }]}
                  />
                  <ThemedText style={styles.legendText}>
                    {slice.name} {CURRENCY}
                    {categoryTotals[slice.name].toFixed(0)}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        <ThemedText style={[styles.sectionTitle, styles.chartGap]}>Last 6 months</ThemedText>
        <View style={styles.monthRow}>
          {lastSixMonths.map((month) => (
            <View key={month.key} style={styles.monthColumn}>
              <ThemedText style={[styles.monthValue, { color: theme.subText }]}>
                {month.total > 0 ? month.total.toFixed(0) : ""}
              </ThemedText>
              <View style={styles.monthTrack}>
                <View
                  style={[
                    styles.monthBar,
                    {
                      height: Math.max((month.total / biggestMonth) * 90, 4),
                      backgroundColor: theme.primary,
                    },
                  ]}
                />
              </View>
              <ThemedText style={[styles.monthLabel, { color: theme.subText }]}>
                {month.label}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      {/* Search and filter */}
      <ThemedText style={styles.listHeading}>Transactions</ThemedText>
      <TextInput
        style={inputStyle}
        placeholder="Search by title..."
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
                styles.filterChip,
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
      <Header title="Expenses" subtitle="Track money in and out" />

      <FlatList
        data={shownItems}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        ListHeaderComponent={topSection}
        ListEmptyComponent={
          <ThemedText style={[styles.empty, { color: theme.subText }]}>
            {expenses.length === 0 ? "Nothing here yet. Add your first one!" : "No matches found"}
          </ThemedText>
        }
        renderItem={({ item }) => {
          const isIncome = item.type === "income";
          const info = isIncome ? INCOME_INFO : CATEGORIES[item.category] || CATEGORIES.Other;
          return (
            <FadeInView>
              <View style={[styles.row, cardStyle]}>
                <View style={[styles.iconCircle, { backgroundColor: info.color }]}>
                  <Ionicons name={info.icon} size={22} color="#fff" />
                </View>
                <View style={styles.rowText}>
                  <ThemedText style={styles.rowTitle}>{item.title}</ThemedText>
                  <ThemedText style={[styles.rowSub, { color: theme.subText }]}>
                    {item.category} · {new Date(item.date).toLocaleDateString()}
                  </ThemedText>
                </View>
                <View style={styles.rowRight}>
                  <ThemedText
                    style={[styles.rowAmount, isIncome && { color: INCOME_INFO.color }]}
                  >
                    {isIncome ? "+" : ""}
                    {CURRENCY}
                    {item.amount.toFixed(2)}
                  </ThemedText>
                  <TouchableOpacity onPress={() => deleteEntry(item.id)}>
                    <Ionicons name="trash-outline" size={20} color="#E17055" />
                  </TouchableOpacity>
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
  summaryCard: { padding: 20, marginTop: -10 },
  summaryLabel: { fontSize: 13, opacity: 0.9 },
  summaryBalance: { fontSize: 36, fontWeight: "bold", marginTop: 2 },
  summaryRow: { flexDirection: "row", marginTop: 12 },
  summaryItem: { flex: 1 },
  summaryValue: { fontSize: 18, fontWeight: "bold" },
  sectionCard: { padding: 16, marginTop: 14 },
  sectionTitle: { fontSize: 17, fontWeight: "bold", marginBottom: 10 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typeRow: { flexDirection: "row", marginBottom: 12 },
  typeButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 8,
  },
  input: { borderRadius: 12, padding: 12, marginBottom: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { marginLeft: 6, fontWeight: "600" },
  filterChip: {
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  addButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 14,
    marginTop: 4,
  },
  addButtonText: { fontWeight: "bold", fontSize: 16, marginLeft: 8 },
  budgetRow: { marginBottom: 12 },
  budgetTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetName: { flexDirection: "row", alignItems: "center" },
  budgetNameText: { marginLeft: 8, fontWeight: "600" },
  budgetInput: { width: 110, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 },
  barTrack: { height: 10, borderRadius: 5, overflow: "hidden", marginTop: 6 },
  barFill: { height: 10, borderRadius: 5 },
  overText: { color: "#E53935", fontSize: 12, marginTop: 4 },
  nearText: { color: "#F5A623", fontSize: 12, marginTop: 4 },
  donutRow: { flexDirection: "row", alignItems: "center" },
  donutCenter: {
    position: "absolute",
    width: DONUT,
    height: DONUT,
    justifyContent: "center",
    alignItems: "center",
  },
  donutTotal: { fontSize: 18, fontWeight: "bold" },
  legend: { flex: 1, marginLeft: 16 },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  legendText: { fontSize: 13 },
  chartGap: { marginTop: 20 },
  monthRow: { flexDirection: "row", justifyContent: "space-between" },
  monthColumn: { alignItems: "center", flex: 1 },
  monthValue: { fontSize: 9, marginBottom: 4 },
  monthTrack: { height: 90, justifyContent: "flex-end" },
  monthBar: { width: 22, borderRadius: 8 },
  monthLabel: { marginTop: 6, fontSize: 12 },
  listHeading: { fontSize: 18, fontWeight: "bold", marginTop: 20, marginBottom: 10 },
  empty: { textAlign: "center", marginTop: 10 },
  row: { flexDirection: "row", alignItems: "center", padding: 12, marginBottom: 10 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  rowText: { flex: 1, marginLeft: 12 },
  rowTitle: { fontSize: 16, fontWeight: "600" },
  rowSub: { marginTop: 2, fontSize: 12 },
  rowRight: { alignItems: "flex-end" },
  rowAmount: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
});