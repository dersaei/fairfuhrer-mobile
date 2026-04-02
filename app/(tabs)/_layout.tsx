import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';

// Prosta ikona zastępcza — zastąpimy osobną biblioteką ikon
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={[styles.iconPlaceholder, focused && styles.iconFocused]}>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2D6A4F',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#eee',
          height: 60,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Karte',
          tabBarIcon: ({ focused }) => <TabIcon label="map" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="liste"
        options={{
          title: 'Liste',
          tabBarIcon: ({ focused }) => <TabIcon label="list" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => <TabIcon label="user" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#ccc',
  },
  iconFocused: {
    backgroundColor: '#2D6A4F',
  },
});
