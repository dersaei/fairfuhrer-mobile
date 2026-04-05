import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  GestureResponderEvent,
  LayoutChangeEvent,
  Animated,
} from "react-native";
import Svg, { Polygon, Rect } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";

// ─── Ikony (bez wbudowanego kółka — tło jest w stylu przycisku) ──────────────

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

// Skip ikony — białe strzałki (tło pomarańczowe daje LinearGradient na przycisku)
function SkipBackIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polygon points="14,9 11,12 14,15" fill="white" />
      <Polygon points="11,9 8,12 11,15" fill="white" />
    </Svg>
  );
}

function SkipForwardIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polygon points="10,9 13,12 10,15" fill="white" />
      <Polygon points="13,9 16,12 13,15" fill="white" />
    </Svg>
  );
}

// ─── Przycisk z animacją :active scale ───────────────────────────────────────

function AnimatedButton({
  onPress,
  children,
  style,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
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

  const progressAnim = useRef(new Animated.Value(0)).current;
  const speedAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const player = useAudioPlayer(src);
  const status = useAudioPlayerStatus(player);

  const isPlaying = status.playing;
  const currentTime = status.currentTime ?? 0;
  const duration = status.duration ?? 0;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  // Animacje wejścia (fadeSlideUp jak w web)
  useEffect(() => {
    Animated.sequence([
      Animated.delay(300),
      Animated.timing(progressAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(500),
      Animated.timing(speedAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // Pulse gdy gra (animation: pulse 2s infinite z web)
  useEffect(() => {
    if (isPlaying) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }, [isPlaying]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  const handleTrackPress = (e: GestureResponderEvent) => {
    if (!trackWidth || !duration) return;
    const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / trackWidth));
    player.seekTo(ratio * duration);
  };

  const progressStyle = {
    opacity: progressAnim,
    transform: [{ translateY: progressAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };
  const speedStyle = {
    opacity: speedAnim,
    transform: [{ translateY: speedAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };

  return (
    // BlurView = backdrop-filter: blur(10px) z web
    <BlurView intensity={60} tint="light" style={styles.audioPlayerBlur}>
      {/* LinearGradient na wierzchu BlurView jako tło = linear-gradient(135deg, #f8f9fa, #e9ecef) */}
      <LinearGradient
        colors={["rgba(248,249,250,0.85)", "rgba(233,236,239,0.85)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.audioPlayer}
      >
        {/* Kontrolki */}
        <View style={styles.audioControls}>
          {/* Skip back — pomarańczowy gradient + białe strzałki, jak .skipButton w web */}
          <AnimatedButton onPress={() => player.seekTo(Math.max(0, currentTime - 5))}>
            <LinearGradient
              colors={["rgba(252,108,20,1)", "rgba(252,108,20,0.85)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.skipButton}
            >
              <SkipBackIcon size={22} />
            </LinearGradient>
          </AnimatedButton>

          {/* Play/Pause — pulse gdy gra */}
          <Animated.View style={[styles.playButtonWrap, { transform: [{ scale: pulseAnim }] }]}>
            <AnimatedButton onPress={() => isPlaying ? player.pause() : player.play()}>
              <LinearGradient
                colors={isPlaying ? ["#dc3545", "#c82333"] : ["rgba(252,108,20,1)", "rgba(252,108,20,0.9)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.playButton}
              >
                {isPlaying ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
              </LinearGradient>
            </AnimatedButton>
          </Animated.View>

          {/* Skip forward */}
          <AnimatedButton onPress={() => player.seekTo(Math.min(duration, currentTime + 5))}>
            <LinearGradient
              colors={["rgba(252,108,20,1)", "rgba(252,108,20,0.85)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.skipButton}
            >
              <SkipForwardIcon size={22} />
            </LinearGradient>
          </AnimatedButton>
        </View>

        {/* Progress bar — fadeSlideUp */}
        <Animated.View style={[styles.progressContainer, progressStyle]}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.trackTouchable}
            onPress={handleTrackPress}
            onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
          >
            <View style={styles.track}>
              <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
              <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
            </View>
          </TouchableOpacity>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </Animated.View>

        {/* Speed buttons — fadeSlideUp z opóźnieniem */}
        <Animated.View style={[styles.speedControl, speedStyle]}>
          {SPEED_OPTIONS.map((speed) => (
            <TouchableOpacity
              key={speed}
              onPress={() => { setPlaybackSpeed(speed); player.setPlaybackRate(speed); }}
              activeOpacity={0.75}
            >
              {playbackSpeed === speed ? (
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
          ))}
        </Animated.View>
      </LinearGradient>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  // BlurView — backdrop-filter: blur(10px) z web
  audioPlayerBlur: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    overflow: "hidden",
  },
  // Gradient na BlurView — odpowiednik linear-gradient(135deg, #f8f9fa, #e9ecef) + padding: 1.2rem + border
  audioPlayer: {
    padding: 19,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  // gap: 1.2rem ≈ 19px
  audioControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 19,
  },
  // .skipButton w web: width/height 48px, border-radius 50%, rgba(255,255,255,0.8) + blur + shadow
  // Na mobile: pomarańczowy gradient (kółko) — jeszcze lepiej widoczne
  skipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(252,108,20,1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  // box-shadow 0 4px 16px rgba(252,108,20,0.3) + 0 2px 8px rgba(252,108,20,0.2)
  playButtonWrap: {
    shadowColor: "rgba(252,108,20,1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
    borderRadius: 28,
  },
  // width: 56px, height: 56px, border-radius: 50%
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  // gap: 1rem ≈ 16px, padding-top: 2vh ≈ 15px
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
  // height: 8px, background: linear-gradient(90deg, #dee2e6, #ced4da), inset shadow
  track: {
    height: 8,
    backgroundColor: "#dee2e6",
    borderRadius: 4,
    position: "relative",
    overflow: "visible",
  },
  // Wypełnienie paska — pomarańczowe
  trackFill: {
    height: 8,
    backgroundColor: "rgba(252,108,20,1)",
    borderRadius: 4,
  },
  // Thumb: 20x20, orange, border 2px white
  thumb: {
    position: "absolute",
    top: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(252,108,20,1)",
    marginLeft: -10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
  },
  // font-size: 0.9rem, font-weight: 500, color: #495057
  timeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#495057",
    fontFamily: "FiraSansCondensed_400Regular",
    width: 36,
    textAlign: "center",
  },
  // gap: 0.4rem ≈ 6px, padding-top: 0.75rem ≈ 12px
  speedControl: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  // height: 28px, min-width: 38px, padding: 0 8px, border-radius: 20px
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
  // active: linear-gradient orange, box-shadow orange
  speedButtonActive: {
    borderColor: "rgba(252,108,20,1)",
    shadowColor: "rgba(252,108,20,1)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  // font-size: 0.78rem, font-weight: 500, color: #495057
  speedButtonText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#495057",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  // active: color white, font-weight: 600
  speedButtonTextActive: {
    color: "#fff",
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontWeight: "600",
  },
});
