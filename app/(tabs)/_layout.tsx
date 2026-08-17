import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Circle, Polygon } from "react-native-svg";

// Expo Router: `initialRouteName` jako prop w <Tabs> bywa ignorowany
// (deep-linki, cold-start, restore state). `unstable_settings` jest
// autorytatywnym zrodlem dla routera i wygrywa z prop-em. Musi byc
// zdeklarowane rownolegle z komponentem, nie w srodku.
export const unstable_settings = {
  initialRouteName: "index",
};

// Tab-Farben an einer Stelle: Icons und Labels müssen dieselben Werte nutzen,
// sonst driften sie beim nächsten Design-Update auseinander. Inaktiv ist
// Schwarz statt Grau — Vorgabe für die Konsistenz mit der Website.
const TAB_ACTIVE = "#fc6c14";
const TAB_INACTIVE = "#181716";

function ListeIcon({ focused }: { focused: boolean }) {
  const color = focused ? TAB_ACTIVE : TAB_INACTIVE;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function KarteIcon({ focused }: { focused: boolean }) {
  const color = focused ? TAB_ACTIVE : TAB_INACTIVE;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={10} r={3} stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function TourIcon({ focused }: { focused: boolean }) {
  const color = focused ? TAB_ACTIVE : TAB_INACTIVE;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
      <Polygon points="10,8 16,12 10,16" fill={color} />
    </Svg>
  );
}

function ProfilIcon({ focused }: { focused: boolean }) {
  const color = focused ? TAB_ACTIVE : TAB_INACTIVE;
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
      <Path
        d="M4 20c0-4 3.582-7 8-7s8 3 8 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      // App startuje na Liste. `unstable_settings.initialRouteName` jest
      // autorytatywnym źródłem dla routera (deep-linki, cold-start, restore
      // state) i musi być zgodne z tą wartością.
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        // Renderuj wszystkie taby od razu (lazy=false) żeby Tour nie miał
        // opóźnienia przy pierwszym tapnięciu — filtrowanie ~500 pinów
        // (withAudioOnly + cityStats + categoryStats) trwa ~100ms na Androidzie,
        // widoczne jako lag. Z lazy=false Tour renderuje się w tle podczas
        // ekranu splash, więc pierwszy tap jest natychmiastowy.
        lazy: false,
        tabBarActiveTintColor: TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: "#eee",
          height: 60 + Math.max(insets.bottom, 16),
          paddingBottom: Math.max(insets.bottom, 16),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          fontFamily: "FiraSansCondensed_600SemiBold",
        },
      }}
    >
      {/* Kolejność: Liste | Karte | Tour | Profil (Liste na pierwszym miejscu) */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "Liste",
          tabBarIcon: ({ focused }) => <ListeIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="karte"
        options={{
          tabBarLabel: "Karte",
          tabBarIcon: ({ focused }) => <KarteIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tour"
        options={{
          tabBarLabel: "Tour",
          tabBarIcon: ({ focused }) => <TourIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          tabBarLabel: "Profil",
          tabBarIcon: ({ focused }) => <ProfilIcon focused={focused} />,
        }}
      />
    </Tabs>
  );
}
