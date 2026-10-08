import { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeContext";

// Each theme gets its own little scene
const SCENES = {
  aurora: {
    icons: ["star", "sparkles", "star-outline", "star", "sparkles-outline", "star-outline", "star"],
    motion: "twinkle",
  },
  nature: {
    icons: ["leaf", "flower", "leaf-outline", "leaf", "flower-outline", "leaf"],
    motion: "float",
  },
  brutal: {
    icons: ["square", "ellipse", "triangle", "square-outline", "ellipse-outline", "triangle-outline"],
    motion: "bounce",
  },
  paper: {
    icons: ["paper-plane", "pencil", "bookmark", "paper-plane-outline", "pencil-outline", "bookmark-outline"],
    motion: "float",
  },
};

// One animated icon
function ArtItem({ icon, motion, index, color }) {
  const progress = useRef(new Animated.Value(0)).current;
  const duration = 1200 + index * 350; // each icon moves at its own speed

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: duration, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: duration, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Spread the icons over the right half of the header
  const left = 42 + ((index * 17) % 50);
  const top = 14 + ((index * 23) % 70);
  const size = 18 + ((index * 7) % 14);

  function range(from, to) {
    return progress.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  }

  let animatedStyle;
  if (motion === "twinkle") {
    animatedStyle = {
      opacity: range(0.15, 0.9),
      transform: [{ scale: range(0.7, 1.25) }],
    };
  } else if (motion === "float") {
    animatedStyle = {
      opacity: 0.55,
      transform: [{ translateY: range(0, -12) }, { rotate: range("-15deg", "15deg") }],
    };
  } else {
    animatedStyle = {
      opacity: 0.6,
      transform: [{ translateY: range(0, -18) }],
    };
  }

  return (
    <Animated.View style={[styles.item, { left: `${left}%`, top: top }, animatedStyle]}>
      <Ionicons name={icon} size={size} color={color} />
    </Animated.View>
  );
}

export default function HeaderArt() {
  const { theme, themeName } = useTheme();
  const scene = SCENES[themeName];

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {scene.icons.map((icon, index) => (
        <ArtItem
          key={index}
          icon={icon}
          motion={scene.motion}
          index={index}
          color={theme.headerText}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { position: "absolute" },
});