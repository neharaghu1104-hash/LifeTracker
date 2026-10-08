import { View, Image, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ThemedText from "./ThemedText";
import HeaderArt from "./HeaderArt";
import { useTheme } from "./ThemeContext";

export default function Header({ title, subtitle }) {
  const { theme, themeName, headerPhoto } = useTheme();
  const insets = useSafeAreaInsets();

  // The shape of the header comes from the theme
  const shape = {
    paddingTop: insets.top + 16,
    borderBottomLeftRadius: theme.radius + 6,
    borderBottomRightRadius: theme.radius + 6,
    borderBottomWidth: theme.headerBorder,
    borderColor: theme.cardBorder,
  };

  // With a photo: the picture, a dark fade, then the text in white
  if (headerPhoto) {
    return (
      <View style={[styles.header, shape]}>
        <Image
          source={{ uri: headerPhoto }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.65)"]}
          style={StyleSheet.absoluteFill}
        />
        <ThemedText style={[styles.title, { color: "#FFFFFF" }]}>{title}</ThemedText>
        <ThemedText style={[styles.subtitle, { color: "#FFFFFF" }]}>{subtitle}</ThemedText>
      </View>
    );
  }

  // Without a photo: the theme gradient with its animated scene
  return (
    <LinearGradient
      colors={theme.headerGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, shape]}
    >
      <HeaderArt key={themeName} />
      <ThemedText style={[styles.title, { color: theme.headerText }]}>{title}</ThemedText>
      <ThemedText style={[styles.subtitle, { color: theme.headerText }]}>{subtitle}</ThemedText>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 28, overflow: "hidden" },
  title: { fontSize: 28, fontWeight: "bold" },
  subtitle: { marginTop: 4, opacity: 0.85 },
});