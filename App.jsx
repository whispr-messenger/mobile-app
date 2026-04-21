import "react-native-gesture-handler";
import { registerGlobals } from "@livekit/react-native";
import { enableScreens } from "react-native-screens";

// WHISPR-calls: LiveKit requires registerGlobals() once at app bootstrap,
// before any Room/track usage. Must run on native platforms only.
registerGlobals();
import { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { AuthNavigator } from "./src/navigation/AuthNavigator";
import { linkingConfig } from "./src/navigation/linkingConfig";
import { navigationRef } from "./src/navigation/navigationRef";
import { ThemeProvider } from "./src/context/ThemeContext";
import { AuthProvider } from "./src/context/AuthContext";

enableScreens(false);

// WHISPR-1023: keep splash visible until Inter fonts are loaded.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

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

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView
      onLayout={onLayoutRootView}
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
            {/* WHISPR-1073: whispr:// deep links → conversation / group / profile screens. */}
            <NavigationContainer
              ref={navigationRef}
              linking={linkingConfig}
            >
              <AuthNavigator />
              <StatusBar style="light" />
            </NavigationContainer>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
