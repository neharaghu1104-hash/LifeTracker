import { useCallback, useState } from "react";
import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Header from "./Header";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import { loadLifeData, buildTimeline } from "./lifeData";
import { getToday, formatDate, dateToString } from "./dateHelpers";

export default function TimelineScreen() {
  const { theme } = useTheme(); const [date, setDate] = useState(getToday()); const [rows, setRows] = useState([]);
  const load = useCallback(async () => { const data = await loadLifeData(); setRows(buildTimeline(data, date)); }, [date]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const shift = (delta) => { const d = new Date(date + "T00:00:00"); d.setDate(d.getDate() + delta); setDate(dateToString(d)); };
  return <View style={[styles.container,{backgroundColor:theme.background}]}><Header title="Life Timeline" subtitle="Everything that made up your day" /><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.dateRow}><TouchableOpacity onPress={()=>shift(-1)}><Ionicons name="chevron-back" size={24} color={theme.primary}/></TouchableOpacity><ThemedText style={styles.date}>{date === getToday() ? "Today" : formatDate(date)}</ThemedText><TouchableOpacity onPress={()=>shift(1)}><Ionicons name="chevron-forward" size={24} color={theme.primary}/></TouchableOpacity></View>
    <View style={[styles.card,{backgroundColor:theme.card,borderColor:theme.cardBorder,borderWidth:theme.borderWidth,borderRadius:theme.radius}]}>
      {rows.length === 0 ? <ThemedText style={[styles.empty,{color:theme.subText}]}>Nothing recorded for this day yet. Add an expense, event, note, focus item or check-in.</ThemedText> : rows.map((r,i)=><View key={r.id} style={styles.row}><View style={[styles.icon,{backgroundColor:theme.inputBg}]}><Ionicons name={r.icon} size={19} color={theme.primary}/></View><View style={styles.body}><ThemedText style={styles.rowTitle}>{r.title}</ThemedText><ThemedText style={{color:theme.subText,fontSize:12}}>{r.time ? `${r.time} · ` : ""}{r.detail}</ThemedText></View>{i<rows.length-1 && <View style={[styles.line,{backgroundColor:theme.cardBorder}]}/>}</View>)}
    </View>
  </ScrollView></View>;
}
const styles=StyleSheet.create({container:{flex:1},content:{padding:16},dateRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:8,marginBottom:12},date:{fontSize:18,fontWeight:"800"},card:{padding:16},row:{flexDirection:"row",minHeight:66,alignItems:"center",position:"relative"},icon:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center"},body:{flex:1,marginLeft:12},rowTitle:{fontWeight:"700",fontSize:15},line:{position:"absolute",left:20,top:53,bottom:-1,width:1},empty:{textAlign:"center",padding:30,lineHeight:21}});