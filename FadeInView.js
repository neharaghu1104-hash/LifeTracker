import { useEffect, useRef } from "react";
import { Animated } from "react-native";

export default function FadeInView({ children }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: opacity, transform: [{ translateY: slide }] }}>
      {children}
    </Animated.View>
  );
}