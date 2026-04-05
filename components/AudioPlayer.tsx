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
import Svg, { Polygon, Rect, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from "expo-audio";

// ─── Ikony ────────────────────────────────────────────────────────────────────

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

// Identyczne z web AudioIcons.tsx — pomarańczowe kółko + białe strzałki
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

// ─── Przycisk z animacją :active scale (odpowiednik CSS button:active) ────────

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
    Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 50, bounciness: 0 }).start();

  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }).start();

  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
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
  const speedAnim    = useRef(new Animated.Value(0)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const pulseLoop    = useRef<Animated.CompositeAnimation | null>(null);

  const player = useAudioPlayer(src);
  const status = useAudioPlayerStatus(player);
  const isPlaying  = status.playing;
  const currentTime = status.currentTime ?? 0;
  const duration    = status.duration   ?? 0;

  useEffect(() => { setAudioModeAsync({ playsInSilentMode: true }); }, []);

  // fadeSlideUp — identyczne z web (delay 0.3s / 0.5s, duration 0.6s)
  useEffect(() => {
    Animated.sequence([Animated.delay(300), Animated.timing(progressAnim, { toValue: 1, duration: 600, useNativeDriver: true })]).start();
    Animated.sequence([Animated.delay(500), Animated.timing(speedAnim,    { toValue: 1, duration: 600, useNativeDriver: true })]).start();
  }, []);

  // pulse 2s infinite — identyczne z web keyframes pulse (scale 1 → 1.05 → 1)
  useEffect(() => {
    if (isPlaying) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
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
    player.seekTo(Math.min(1, Math.max(0, e.nativeEvent.locationX / trackWidth)) * duration);
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
    /*
     * Web: backdrop-filter: blur(10px) + linear-gradient(135deg, #f8f9fa, #e9ecef)
     * intensity={10} = blur(10px), tint="default" = bez narzucanej bieli
     * LinearGradient na wierzchu daje gradient z opacity < 1 by blur prześwitywał
     */
    <BlurView intensity={10} tint="default" style={styles.blurContainer}>
      <LinearGradient
        colors={["rgba(248,249,250,0.92)", "rgba(233,236,239,0.92)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.audioPlayer}
      >

        {/* ── Kontrolki ─────────────────────────────────────────────────────── */}
        <View style={styles.audioControls}>

          {/*
           * Skip back
           * Web: .skipButton = białe kółko rgba(255,255,255,0.8) + blur(10px) + shadow
           *      ikona w SVG = pomarańczowe kółko z białymi strzałkami (AudioIcons.tsx)
           * Mobile: BlurView jako białe kółko (blur(10px)) + SVG z pomarańczowym kółkiem na środku
           */}
          <AnimatedButton onPress={() => player.seekTo(Math.max(0, currentTime - 5))}>
            <BlurView intensity={10} tint="light" style={styles.skipButton}>
              <SkipBackIcon size={32} />
            </BlurView>
          </AnimatedButton>

          {/*
           * Play / Pause
           * Web: linear-gradient(135deg, orange→orange/0.9) + overflow:hidden + box-shadow orange
           *      playing: gradient red + pulse animation
           */}
          <Animated.View style={[styles.playButtonShadow, { transform: [{ scale: pulseAnim }] }]}>
            <AnimatedButton onPress={() => isPlaying ? player.pause() : player.play()}>
              <LinearGradient
                colors={isPlaying
                  ? ["#dc3545", "#c82333"]
                  : ["rgba(252,108,20,1)", "rgba(252,108,20,0.9)"]}
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
            <BlurView intensity={10} tint="light" style={styles.skipButton}>
              <SkipForwardIcon size={32} />
            </BlurView>
          </AnimatedButton>

        </View>

        {/* ── Progress bar — fadeSlideUp 0.3s ───────────────────────────────── */}
        <Animated.View style={[styles.progressContainer, progressStyle]}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.trackTouchable}
            onPress={handleTrackPress}
            onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
          >
            {/*
             * Web: linear-gradient(90deg, #dee2e6, #ced4da) + inset shadow
             * Mobile: LinearGradient jako tło toru
             */}
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

        {/* ── Speed buttons — fadeSlideUp 0.5s ──────────────────────────────── */}
        <Animated.View style={[styles.speedControl, speedStyle]}>
          {SPEED_OPTIONS.map((speed) => {
            const isActive = playbackSpeed === speed;
            return (
              <TouchableOpacity
                key={speed}
                onPress={() => { setPlaybackSpeed(speed); player.setPlaybackRate(speed); }}
                activeOpacity={0.75}
              >
                {/*
                 * Web: backdrop-filter: blur(10px) + rgba(255,255,255,0.8) border + shadow
                 * Active: linear-gradient orange + orange shadow
                 */}
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
                  <BlurView intensity={10} tint="light" style={styles.speedButton}>
                    <Text style={styles.speedButtonText}>{speed}x</Text>
                  </BlurView>
                )}
              </TouchableOpacity>
            );
          })}
        </Animated.View>

      </LinearGradient>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  // Zewnętrzny BlurView — backdrop-filter: blur(10px), overflow:hidden by border obcinał blur
  blurContainer: {
    overflow: "hidden",
    // box-shadow: 0 4px 16px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },

  // Gradient na BlurView — padding: 1.2rem, border: 1px solid rgba(255,255,255,0.2)
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

  /*
   * Skip button
   * Web: width/height 48px, border-radius 50%, rgba(255,255,255,0.8), blur(10px), shadow 0 2px 8px
   * BlurView daje blur + lekko białe tło (tint="light"); SVG na środku = pomarańczowe kółko
   */
  skipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },

  /*
   * Play button shadow wrap
   * Web: box-shadow 0 4px 16px rgba(252,108,20,0.3) + 0 2px 8px rgba(252,108,20,0.2)
   */
  playButtonShadow: {
    borderRadius: 28,
    shadowColor: "rgba(252,108,20,1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },

  /*
   * Play button
   * Web: width/height 56px, border-radius 50%, overflow:hidden (by ikona nie wychodziła poza)
   */
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  // gap: 1rem = 16px, padding-top: 2vh ≈ 15px, fadeSlideUp
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

  // Web: linear-gradient(90deg, #dee2e6, #ced4da) + inset shadow + border-radius 4px
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "visible",
    position: "relative",
  },

  // Pomarańczowe wypełnienie postępu
  trackFill: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 8,
    backgroundColor: "rgba(252,108,20,1)",
    borderRadius: 4,
  },

  // Web: thumb 20x20, orange gradient, border 2px white, shadow
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

  // font-size: 0.9rem, font-weight: 500, color: #495057
  timeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#495057",
    fontFamily: "FiraSansCondensed_400Regular",
    width: 36,
    textAlign: "center",
  },

  // gap: 0.4rem ≈ 6px, padding-top: 0.75rem ≈ 12px, fadeSlideUp
  speedControl: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },

  /*
   * Speed button
   * Web: height 28px, min-width 38px, padding 0 8px, border-radius 20px
   *      background rgba(255,255,255,0.8), border 1.5px rgba(252,108,20,0.25)
   *      backdrop-filter blur(10px), box-shadow 0 1px 4px rgba(0,0,0,0.08)
   * BlurView daje blur — backgroundColor na BlurView ignorowane, dlatego tint="light"
   */
  speedButton: {
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(252,108,20,0.25)",
    minWidth: 38,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },

  // Active: linear-gradient orange (LinearGradient), border orange, shadow orange
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

  // Active: white, font-weight 600
  speedButtonTextActive: {
    color: "#fff",
    fontFamily: "FiraSansCondensed_600SemiBold",
    fontWeight: "600",
  },
});
