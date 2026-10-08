import { Text } from "react-native";
import { useTheme } from "./ThemeContext";

export default function ThemedText({ style, ...props }) {
  const { theme } = useTheme();
  return (
    <Text
      {...props}
      style={[{ color: theme.text, fontFamily: theme.fontFamily }, style]}
    />
  );
}