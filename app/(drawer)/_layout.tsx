import { Drawer } from "expo-router/drawer";

export default function DrawerGroupLayout() {
  return (
    <Drawer screenOptions={{ headerShown: false }}>
      <Drawer.Screen
        name="datenschutz"
        options={{ drawerLabel: "Datenschutz" }}
      />
      <Drawer.Screen name="agb" options={{ drawerLabel: "AGB" }} />
      <Drawer.Screen name="impressum" options={{ drawerLabel: "Impressum" }} />
      <Drawer.Screen name="hilfe" options={{ drawerLabel: "Hilfe" }} />
    </Drawer>
  );
}
