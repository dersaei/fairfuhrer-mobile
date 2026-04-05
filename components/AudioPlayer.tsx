import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
  LayoutChangeEvent,
} from "react-native";
import Svg, { Polygon, Rect, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

const haptic = {
  light:     () => ReactNativeHapticFeedback.trigger("impactLight",     { enableVibrateFallback: true }),
  medium:    () => ReactNativeHapticFeedback.trigger("impactMedium",    { enableVibrateFallback: true }),
  selection: () => ReactNativeHapticFeedback.trigger("selection",       { enableVibrateFallback: true }),
};
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  withDelay,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";

// ─── Ikony — identyczne z web AudioIcons.tsx ─────────────────────────────────

function PlayIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polygon points="9.5,7.5 16.5,12 9.5,16.5" fill="white" />
    </Svg>
  );
}

function PauseIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="7.5" width="2.5" height="9" fill="white" rx="0.5" />
      <Rect x="12.5" y="7.5" width="2.5" height="9" fill="white" rx="0.5" />
    </Svg>
  );
}

function SkipBackIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="11" fill="rgba(252,108,20,1)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
      <Polygon points="14,9 11,12 14,15" fill="white" />
      <Polygon points="11,9 8,12 11,15" fill="white" />
    </Svg>
  );
}

function SkipForwardIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="11" fill="rgba(252,108,20,1)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
      <Polygon points="10,9 13,12 10,15" fill="white" />
      <Polygon points="13,9 16,12 13,15" fill="white" />
    </Svg>
  );
}

// ─── Przycisk z animacją press (cubic-bezier jak w web :active) ───────────────

function PressButton({
  onPress,
  children,
  style,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    // scale(0.9) — odpowiednik CSS button:active { transform: scale(0.9) }
    scale.value = withTiming(0.9, { duration: 100, easing: Easing.out(Easing.cubic) });
  };

  const onPressOut = () => {
    // sprężynowy powrót — cubic-bezier(0.34, 1.56, 0.64, 1) z web
    scale.value = withSpring(1, { damping: 10, stiffness: 200, mass: 0.5 });
  };

  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={[style, animStyle]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── AudioPlayer ─────────────────────────────────────────────────────────────

const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2] as const;
type SpeedOption = (typeof SPEED_OPTIONS)[number];

interface AudioPlayerProps {
  src: string;
}

export function AudioPlayer({ src }: AudioPlayerProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<SpeedOption>(1);

  const player  = useAudioPlayer(src);
  const status  = useAudioPlayerStatus(player);
  const isPlaying   = status.playing;
  const currentTime = status.currentTime ?? 0;
  const duration    = status.duration    ?? 0;
  const progress    = duration > 0 ? currentTime / duration : 0;

  // ── Shared values ─────────────────────────────────────────────────────────

  // fadeSlideUp dla progress i speed (opacity 0→1 + translateY 10→0)
  const progressOpacity   = useSharedValue(0);
  const progressTranslateY = useSharedValue(10);
  const speedOpacity      = useSharedValue(0);
  const speedTranslateY   = useSharedValue(10);

  // pulse dla play button gdy gra (scale 1→1.05→1, 2s loop)
  const pulseScale = useSharedValue(1);

  // ── Efekty ────────────────────────────────────────────────────────────────

  useEffect(() => { setAudioModeAsync({ playsInSilentMode: true }); }, []);

  // fadeSlideUp — delay 0.3s dla progress, 0.5s dla speed (jak w web CSS animation)
  useEffect(() => {
    const ease = Easing.bezier(0.25, 0.46, 0.45, 0.94);

    progressOpacity.value    = withDelay(300, withTiming(1,  { duration: 600, easing: ease }));
    progressTranslateY.value = withDelay(300, withTiming(0,  { duration: 600, easing: ease }));
    speedOpacity.value       = withDelay(500, withTiming(1,  { duration: 600, easing: ease }));
    speedTranslateY.value    = withDelay(500, withTiming(0,  { duration: 600, easing: ease }));
  }, []);

  // pulse 2s infinite — identyczne z web @keyframes pulse (scale 1→1.05→1)
  useEffect(() => {
    if (isPlaying) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000, easing: Easing.bezier(0.25, 0.46, 0.45, 0.94) }),
          withTiming(1,    { duration: 1000, easing: Easing.bezier(0.25, 0.46, 0.45, 0.94) })
        ),
        -1 // nieskończony loop
      );
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withTiming(1, { duration: 150 });
    }
  }, [isPlaying]);

  // ── Animated styles ───────────────────────────────────────────────────────

  const progressStyle = useAnimatedStyle(() => ({
    opacity: progressOpacity.value,
    transform: [{ translateY: progressTranslateY.value }],
  }));

  const speedStyle = useAnimatedStyle(() => ({
    opacity: speedOpacity.value,
    transform: [{ translateY: speedTranslateY.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const formatTime = (t: number) =>
    `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

  const handleTrackPress = (e: GestureResponderEvent) => {
    if (!trackWidth || !duration) return;
    player.seekTo(Math.min(1, Math.max(0, e.nativeEvent.locationX / trackWidth)) * duration);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <LinearGradient
      colors={["#f8f9fa", "#e9ecef"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.audioPlayer}
    >

      {/* Kontrolki */}
      <View style={styles.audioControls}>

        <PressButton onPress={() => { haptic.light(); player.seekTo(Math.max(0, currentTime - 5)); }}>
          <View style={styles.skipButton}>
            <SkipBackIcon size={32} />
          </View>
        </PressButton>

        {/* Play/Pause z pulse */}
        <Animated.View style={[styles.playButtonShadow, pulseStyle]}>
          <PressButton onPress={() => {
            isPlaying ? haptic.light() : haptic.medium();
            isPlaying ? player.pause() : player.play();
          }}>
            <LinearGradient
              colors={isPlaying ? ["#dc3545", "#c82333"] : ["rgba(252,108,20,1)", "rgba(252,108,20,0.9)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.playButton}
            >
              {isPlaying ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
            </LinearGradient>
          </PressButton>
        </Animated.View>

        <PressButton onPress={() => { haptic.light(); player.seekTo(Math.min(duration, currentTime + 5)); }}>
          <View style={styles.skipButton}>
            <SkipForwardIcon size={32} />
          </View>
        </PressButton>

      </View>

      {/* Progress — fadeSlideUp 0.3s */}
      <Animated.View style={[styles.progressContainer, progressStyle]}>
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.trackTouchable}
          onPress={handleTrackPress}
          onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
        >
          <LinearGradient
            colors={["#dee2e6", "#ced4da"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.track}
          >
            <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
            <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.timeText}>{formatTime(duration)}</Text>
      </Animated.View>

      {/* Speed — fadeSlideUp 0.5s */}
      <Animated.View style={[styles.speedControl, speedStyle]}>
        {SPEED_OPTIONS.map((speed) => {
          const isActive = playbackSpeed === speed;
          return (
            <TouchableOpacity
              key={speed}
              onPress={() => { haptic.selection(); setPlaybackSpeed(speed); player.setPlaybackRate(speed); }}
              activeOpacity={0.75}
            >
              {isActive ? (
                <LinearGradient
                  colors={["rgba(252,108,20,1)", "rgba(252,108,20,0.9)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.speedButton, styles.speedButtonActive]}
                >
                  <Text style={[styles.speedButtonText, styles.speedButtonTextActive]}>{speed}x</Text>
                </LinearGradient>
              ) : (
                <View style={styles.speedButton}>
                  <Text style={styles.speedButtonText}>{speed}x</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </Animated.View>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  audioPlayer: {
    padding: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  audioControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 19,
  },
  skipButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
  playButtonShadow: {
    borderRadius: 28,
    shadowColor: "rgba(252,108,20,1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 15,
  },
  trackTouchable: {
    flex: 1,
    height: 28,
    justifyContent: "center",
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "visible",
  },
  trackFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 8,
    backgroundColor: "rgba(252,108,20,1)",
    borderRadius: 4,
  },
  thumb: {
    position: "absolute",
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(252,108,20,1)",
    marginLeft: -10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#495057",
    fontFamily: "FiraSansCondensed_400Regular",
    width: 36,
    textAlign: "center",
  },
  speedControl: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  speedButton: {
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(252,108,20,0.25)",
    backgroundColor: "rgba(255,255,255,0.8)",
    minWidth: 38,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  speedButtonActive: {
    borderColor: "rgba(252,108,20,1)",
    shadowColor: "rgba(252,108,20,1)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  speedButtonText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#495057",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  speedButtonTextActive: {
    color: "#fff",
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontWeight: "600",
  },
});
