import { useState } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Path, Circle, Line } from "react-native-svg";

// Wrapper um TextInput mit Sichtbarkeits-Toggle. Ersetzt alle bisherigen
// `<TextInput secureTextEntry ... />` in AuthScreen, EinstellungenSection
// etc. — ein Ort, eine Implementierung, konsistentes Verhalten.
//
// Verwendung:
//   <PasswordInput value={pw} onChangeText={setPw} placeholder="..." />
//
// Alle TextInput-Props (außer secureTextEntry — das wird intern verwaltet)
// werden durchgereicht. `containerStyle` für Abstand/Layout des Wrappers;
// `style` (von TextInput) für das eigentliche Eingabefeld.

type Props = Omit<TextInputProps, "secureTextEntry"> & {
  containerStyle?: StyleProp<ViewStyle>;
};

export default function PasswordInput({ containerStyle, style, ...textInputProps }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        {...textInputProps}
        style={[styles.input, style]}
        secureTextEntry={!visible}
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        style={styles.iconBtn}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Passwort verbergen" : "Passwort anzeigen"}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </TouchableOpacity>
    </View>
  );
}

function EyeIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
        stroke="#666"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3} stroke="#666" strokeWidth={1.8} />
    </Svg>
  );
}

function EyeOffIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.43 10.43 0 0 1 12 5c5 0 9 4 10 7-.6 1.4-1.5 2.7-2.6 3.7M6.6 6.6C3.6 8.2 2 12 2 12s2.6 5.5 7.5 6.7"
        stroke="#666"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1={2} y1={2} x2={22} y2={22} stroke="#666" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    position: "relative",
    justifyContent: "center",
  },
  input: {
    paddingRight: 44, // Platz für das Augen-Icon rechts
  },
  iconBtn: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    width: 28,
  },
});
