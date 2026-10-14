import { Tabs } from "expo-router";
import { View } from "react-native";
import { ServiceHeader, ServiceTabBar } from "@/service/ServiceHeader";
import { Guard } from "@/service/ui";
import { colors } from "@/theme";
export default function Layout() {
  return (
    <Guard budget>
      <View style={{ flex: 1 }}>
        <ServiceHeader />
        <Tabs
          tabBar={() => null}
          backBehavior="history"
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: colors.bg },
          }}
        />
        <ServiceTabBar />
      </View>
    </Guard>
  );
}
