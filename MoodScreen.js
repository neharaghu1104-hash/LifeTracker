import { useCallback, useState } from "react";
import { View, ScrollView, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Header from "./Header";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import { KEYS } from "./lifeData";
import { getToday } from "./dateHelpers";

const moods = ["😞", "😕", "😐", "🙂", "😄"];
export default function MoodScreen() {
  const { theme } = useTheme();
  const date = getToday();
  const [mood, setMood] = useState(0); const [energy, setEnergy] = useState(5); const [note, setNote] = useState(""); const [saved, setSaved] = useState(false);
  useFocusEffect(useCallback(() => { (async () => { const raw = await AsyncStorage.getItem(KEYS.mood); const all = raw ? JSON.parse(raw) : {}; const x = all[date]; if (x) { setMood(x.mood); setEnergy(x.energy); setNote(x.note || ""); } })(); }, [date]));
  async function save() { const raw = await AsyncStorage.getItem(KEYS.mood); const all = raw ? JSON.parse(raw) : {}; all[date] = { mood, energy, note, savedAt: new Date().toISOString() }; await AsyncStorage.setItem(KEYS.mood, JSON.stringify(all)); setSaved(true); setTimeout(() => setSaved(false), 1600); }
  return <View style={[styles.container, { backgroundColor: theme.background }]}><Header title="Mood & Energy" subtitle="A quick private check-in" /><ScrollView contentContainerStyle={styles.content}>
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder, borderWidth: theme.borderWidth, borderRadius: theme.radius }]}>
      <ThemedText style={styles.title}>How was your day?</ThemedText>
      <View style={styles.moods}>{moods.map((m, i) => <TouchableOpacity key={m} onPress={() => setMood(i + 1)} style={[styles.mood, mood === i + 1 && { backgroundColor: theme.inputBg, borderColor: theme.primary }]}><ThemedText style={styles.emoji}>{m}</ThemedText></TouchableOpacity>)}</View>
      <ThemedText style={styles.label}>Energy · {energy}/10</ThemedText><View style={styles.energy}>{Array.from({ length: 10 }, (_, i) => <TouchableOpacity key={i} onPress={() => setEnergy(i + 1)} style={[styles.energyDot, { backgroundColor: i < energy ? theme.primary : theme.inputBg, borderColor: theme.cardBorder }]} />)}</View>
      <TextInput value={note} onChangeText={setNote} multiline placeholder="Optional note about your day..." placeholderTextColor={theme.subText} style={[styles.note, { color: theme.text, backgroundColor: theme.inputBg, borderColor: theme.cardBorder }]} />
      <TouchableOpacity onPress={save} style={[styles.button, { backgroundColor: theme.primary }]}><ThemedText style={styles.buttonText}>{saved ? "Saved ✓" : "Save check-in"}</ThemedText></TouchableOpacity>
    </View>
  </ScrollView></View>;
}
const styles=StyleSheet.create({container:{flex:1},content:{padding:16},card:{padding:20},title:{fontSize:22,fontWeight:"800",textAlign:"center"},moods:{flexDirection:"row",justifyContent:"space-between",marginTop:24},mood:{width:52,height:52,borderRadius:26,borderWidth:1,borderColor:"transparent",alignItems:"center",justifyContent:"center"},emoji:{fontSize:30},label:{fontWeight:"700",marginTop:28},energy:{flexDirection:"row",gap:7,marginTop:12},energyDot:{width:22,height:22,borderRadius:11,borderWidth:1},note:{minHeight:100,borderWidth:1,borderRadius:14,padding:14,marginTop:24,textAlignVertical:"top"},button:{marginTop:14,padding:15,borderRadius:14,alignItems:"center"},buttonText:{color:"#fff",fontWeight:"800"}});
