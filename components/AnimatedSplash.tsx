import { useEffect, useRef } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

interface Props {
  onFinished: () => void;
}

export default function AnimatedSplash({ onFinished }: Props) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const called = useRef(false);

  useEffect(() => {
    opacity.value = withTiming(0, { duration: 900 });
    scale.value = withTiming(1.1, { duration: 900 }, (finished) => {
      if (finished && !called.current) {
        called.current = true;
        scheduleOnRN(onFinished);
      }
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, animatedStyle]}>
      <Image source={require("@/assets/app-icon.png")} style={styles.logo} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  logo: {
    width: 180,
    height: 180,
  },
});
