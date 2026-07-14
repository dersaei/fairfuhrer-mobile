import { useEffect, useRef } from "react";
import { Image, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

interface Props {
  onFinished: () => void;
}

// Splash chowany po 900ms animacji. Ale w niektorych scenariuszach
// (Reanimated 4.x + Worklets 0.7 na iOS 18) callback z withTiming
// bywa nie wywolywany — apka zostaje na splashu na zawsze. Fallback
// timer wywoluje onFinished po 1500ms nawet gdy worklets padnie.
const SPLASH_DURATION_MS = 900;
const FALLBACK_TIMEOUT_MS = 1500;

export default function AnimatedSplash({ onFinished }: Props) {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const called = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (called.current) return;
      called.current = true;
      onFinished();
    };

    opacity.value = withTiming(0, { duration: SPLASH_DURATION_MS });
    scale.value = withTiming(1.1, { duration: SPLASH_DURATION_MS }, (finished) => {
      if (finished) {
        scheduleOnRN(finish);
      }
    });

    // Safety net: gdyby worklet-callback nie odpalil (znany problem
    // Reanimated 4 + Worklets 0.7 na niektorych urzadzeniach iOS),
    // odpalamy finish z JS-side timer. Guard `called` chroni przed
    // podwojnym wywolaniem.
    const fallback = setTimeout(finish, FALLBACK_TIMEOUT_MS);
    return () => clearTimeout(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, animatedStyle]}>
      <Image source={require("@/assets/splash.png")} style={styles.logo} resizeMode="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FE6918",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  logo: {
    width: 230,
    height: 293,
  },
});
