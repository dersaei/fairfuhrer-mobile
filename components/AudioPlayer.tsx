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

// ─── AudioPlayer ─────────────────────────────────────────────────────────────

const SPEED_OPTIONS = [1, 1.25, 1.5, 1.75, 2] as const;
type SpeedOption = (typeof SPEED_OPTIONS)[number];

interface AudioPlayerProps {
  src: string;
}

export function AudioPlayer({ src }: AudioPlayerProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<SpeedOption>(1);

  // Animacje wejścia — fadeSlideUp
  const progressAnim = useRef(new Animated.Value(0)).current;
  const speedAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const player = useAudioPlayer(src);
  const status = useAudioPlayerStatus(player);

  const isPlaying = status.playing;
  const currentTime = status.currentTime ?? 0;
  const duration = status.duration ?? 0;

  // Tryb audio — odtwarzaj przez głośnik nawet gdy wyciszenie
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true });
  }, []);

  // Animacje wejścia
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

  // Pulsowanie gdy gra
  useEffect(() => {
    if (isPlaying) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 1000, useNativeDriver: true }),
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

  const handleTogglePlay = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleSkipBack = () => {
    player.seekTo(Math.max(0, currentTime - 5));
  };

  const handleSkipForward = () => {
    player.seekTo(Math.min(duration, currentTime + 5));
  };

  const handleTrackPress = (e: GestureResponderEvent) => {
    if (!trackWidth || !duration) return;
    const x = e.nativeEvent.locationX;
    const ratio = Math.min(1, Math.max(0, x / trackWidth));
    player.seekTo(ratio * duration);
  };

  const handleSpeedChange = (speed: SpeedOption) => {
    setPlaybackSpeed(speed);
    player.setPlaybackRate(speed);
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
    <View style={styles.audioPlayer}>
      {/* Kontrolki */}
      <View style={styles.audioControls}>
        <TouchableOpacity style={styles.skipButton} activeOpacity={0.7} onPress={handleSkipBack}>
          <SkipBackIcon size={32} />
        </TouchableOpacity>

        <Animated.View style={[styles.playButtonWrap, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity
            style={[styles.playButton, isPlaying && styles.playButtonPlaying]}
            activeOpacity={0.85}
            onPress={handleTogglePlay}
          >
            {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity style={styles.skipButton} activeOpacity={0.7} onPress={handleSkipForward}>
          <SkipForwardIcon size={32} />
        </TouchableOpacity>
      </View>

      {/* Progress */}
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

      {/* Prędkość */}
      <Animated.View style={[styles.speedControl, speedStyle]}>
        {SPEED_OPTIONS.map((speed) => (
          <TouchableOpacity
            key={speed}
            style={[styles.speedButton, playbackSpeed === speed && styles.speedButtonActive]}
            onPress={() => handleSpeedChange(speed)}
            activeOpacity={0.7}
          >
            <Text style={[styles.speedButtonText, playbackSpeed === speed && styles.speedButtonTextActive]}>
              {speed}x
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  audioPlayer: {
    backgroundColor: "#edf0f2",
    padding: 18,
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
    gap: 16,
  },
  playButtonWrap: {
    shadowColor: "rgba(252,108,20,1)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
    borderRadius: 28,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(252,108,20,1)",
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonPlaying: {
    backgroundColor: "#dc3545",
  },
  skipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
  },
  trackTouchable: {
    flex: 1,
    height: 28,
    justifyContent: "center",
  },
  track: {
    height: 8,
    backgroundColor: "#dee2e6",
    borderRadius: 4,
    position: "relative",
    overflow: "visible",
  },
  trackFill: {
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.8)",
  },
  timeText: {
    fontSize: 13,
    color: "#495057",
    fontFamily: "FiraSansCondensed_400Regular",
    width: 36,
    textAlign: "center",
    fontWeight: "500",
  },
  speedControl: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  speedButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(252,108,20,0.25)",
    backgroundColor: "rgba(255,255,255,0.8)",
    minWidth: 38,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
  speedButtonActive: {
    backgroundColor: "rgba(252,108,20,1)",
    borderColor: "rgba(252,108,20,1)",
    shadowColor: "rgba(252,108,20,1)",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  speedButtonText: {
    fontSize: 12,
    color: "#495057",
    fontFamily: "FiraSansCondensed_400Regular",
  },
  speedButtonTextActive: {
    color: "#fff",
    fontFamily: "FiraSansCondensed_600SemiBold",
  },
});
