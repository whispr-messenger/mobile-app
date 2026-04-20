import "react-native-gesture-handler";
import { enableScreens } from "react-native-screens";
import { useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthNavigator } from "./src/navigation/AuthNavigator";
import { ThemeProvider } from "./src/context/ThemeContext";
import { AuthProvider } from "./src/context/AuthContext";

enableScreens(false);

export default function App() {
  // Fix: constrain the app to the viewport height on web so the bottom
  // tab bar stays visible without the page itself becoming scrollable.
  useEffect(() => {
    if (Platform.OS === "web") {
      const html = document.documentElement;
      const body = document.body;
      html.style.height = "100%";
      body.style.height = "100%";
      body.style.overflow = "hidden";
    }
  }, []);
  return (
    <GestureHandlerRootView
      style={{
        flex: 1,
        ...(Platform.OS === "web"
          ? { height: "100dvh", overflow: "hidden" }
          : {}),
      }}
    >
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NavigationContainer>
              <AuthNavigator />
              <StatusBar style="light" />
            </NavigationContainer>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

