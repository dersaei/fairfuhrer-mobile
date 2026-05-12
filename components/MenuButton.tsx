import { TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useDrawer } from "@/context/DrawerContext";

interface Props {
  tint?: string;
}

export default function MenuButton({ tint = "#181716" }: Props) {
  const { openDrawer } = useDrawer();
  return (
    <TouchableOpacity onPress={openDrawer} hitSlop={8} style={s.btn}>
      <Svg width={44} height={44} viewBox="0 0 24 24" fill="none">
        <Path d="M4 6h16M4 12h16M4 18h16" stroke={tint} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { paddingHorizontal: 4, paddingVertical: 4 },
});
