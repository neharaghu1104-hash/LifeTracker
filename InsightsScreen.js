import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Header from "./Header";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";
import { loadLifeData } from "./lifeData";
import { buildInsights } from "./insights";
export default function InsightsScreen(){const {theme}=useTheme();const [items,setItems]=useState([]);useFocusEffect(useCallback(()=>{(async()=>{const d=await loadLifeData();setItems(buildInsights(d.expenses,d.budgets,d.steps));})();},[]));return <View style={[styles.container,{backgroundColor:theme.background}]}><Header title="Insights" subtitle="Patterns from your own data"/><ScrollView contentContainerStyle={styles.content}>{items.map((x,i)=><View key={i} style={[styles.card,{backgroundColor:theme.card,borderColor:theme.cardBorder,borderWidth:theme.borderWidth,borderRadius:theme.radius}]}><Ionicons name={x.icon} size={23} color={theme.primary}/><ThemedText style={styles.text}>{x.text}</ThemedText></View>)}{items.length===0&&<ThemedText style={{color:theme.subText}}>Keep using LifeTracker and meaningful patterns will appear here.</ThemedText>}</ScrollView></View>}
const styles=StyleSheet.create({container:{flex:1},content:{padding:16},card:{padding:18,flexDirection:"row",alignItems:"center",marginBottom:10},text:{flex:1,marginLeft:12,lineHeight:20}});
