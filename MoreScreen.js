import { View, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Header from "./Header";
import ThemedText from "./ThemedText";
import { useTheme } from "./ThemeContext";

const items=[
 ["Focus","Daily priorities","checkmark-circle-outline","Focus"],
 ["Mood & Energy","Private daily check-in","happy-outline","Mood"],
 ["Timeline","See your day as a story","git-branch-outline","Timeline"],
 ["Weekly Review","Your last seven days","bar-chart-outline","Review"],
 ["Insights","Patterns in your data","bulb-outline","Insights"],
 ["Goals","Flexible personal goals","flag-outline","Goals"],
 ["Steps","Activity tracking","footsteps-outline","Steps"],
 ["Calendar","Events and planning","calendar-outline","Calendar"],
 ["Notes","Your private notes","document-text-outline","Notes"],
 ["Settings","Style, security and preferences","settings-outline","Settings"],
];
export default function MoreScreen({navigation}){const {theme}=useTheme();return <View style={[styles.container,{backgroundColor:theme.background}]}><Header title="More" subtitle="Everything else in LifeTracker"/><ScrollView contentContainerStyle={styles.content}>{items.map(([title,sub,icon,target])=><TouchableOpacity key={target} onPress={()=>navigation.navigate(target)} style={[styles.row,{backgroundColor:theme.card,borderColor:theme.cardBorder,borderWidth:theme.borderWidth,borderRadius:theme.radius}]}><View style={[styles.icon,{backgroundColor:theme.inputBg}]}><Ionicons name={icon} size={21} color={theme.primary}/></View><View style={styles.body}><ThemedText style={styles.title}>{title}</ThemedText><ThemedText style={{color:theme.subText,fontSize:12}}>{sub}</ThemedText></View><Ionicons name="chevron-forward" size={20} color={theme.subText}/></TouchableOpacity>)}</ScrollView></View>}
const styles=StyleSheet.create({container:{flex:1},content:{padding:16,paddingBottom:30},row:{flexDirection:"row",alignItems:"center",padding:14,marginBottom:10},icon:{width:42,height:42,borderRadius:13,alignItems:"center",justifyContent:"center"},body:{flex:1,marginLeft:12},title:{fontSize:15,fontWeight:"800"}});
