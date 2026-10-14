import { Tabs } from "expo-router";
import { View } from "react-native";
import { useHomeStyle } from "@/service/homeStyle";
import { ServiceHeader, ServiceTabBar } from "@/service/ServiceHeader";
import { Guard } from "@/service/ui";
import { colors } from "@/theme";
export default function Layout() {
  const [style] = useHomeStyle();
  const bottomTabs = style === "character";
  return (
    <Guard budget>
      <View style={{ flex: 1 }}>
        <ServiceHeader showTabs={!bottomTabs} />
        <Tabs
          tabBar={() => null}
          backBehavior="history"
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: colors.bg },
          }}
        />
        {bottomTabs && <ServiceTabBar />}
      </View>
    </Guard>
  );
}
