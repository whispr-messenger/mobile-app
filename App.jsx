import "react-native-gesture-handler";
// WHISPR-calls: Metro resolves bootstrap.native vs bootstrap.web based on
// platform — native runs registerGlobals() from @livekit/react-native,
// web is a no-op (no native WebRTC bindings to install).
import "./src/services/calls/bootstrap";
import { enableScreens } from "react-native-screens";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ImageBackground, Platform, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { DefaultTheme, NavigationContainer } from "@react-navigation/native";
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
import { ThemeProvider, useTheme } from "./src/context/ThemeContext";
import { AuthProvider } from "./src/context/AuthContext";
import { BottomTabBar } from "./src/components/Navigation/BottomTabBar";
import { MiniProfileCardHost } from "./src/components/Profile";
import { hydrateReadReceiptsPref } from "./src/services/messaging/readReceiptsPref";

enableScreens(false);

// WHISPR-1023: keep splash visible until Inter fonts are loaded.
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppShell() {
  const { settings } = useTheme();
  const [currentRouteName, setCurrentRouteName] = useState("");
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: "transparent",
        card: "transparent",
        border: "transparent",
      },
    }),
    [],
  );

  const syncCurrentRouteName = useCallback(() => {
    setCurrentRouteName(navigationRef.getCurrentRoute()?.name ?? "");
  }, []);

  return (
    <AuthProvider>
      {/* WHISPR-1073: whispr:// deep links → conversation / group / profile screens. */}
      <NavigationContainer
        ref={navigationRef}
        linking={linkingConfig}
        theme={navigationTheme}
        onReady={syncCurrentRouteName}
        onStateChange={syncCurrentRouteName}
      >
        <View style={styles.appRoot}>
          {settings.backgroundPreset === "custom" &&
          settings.customBackgroundUri ? (
            <ImageBackground
              key={`${settings.customBackgroundUri}:${settings.customBackgroundVersion ?? 0}`}
              source={{ uri: settings.customBackgroundUri }}
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
              imageStyle={styles.customBackgroundImage}
            />
          ) : null}
          <View
            style={styles.appContent}
            accessibilityLabel={`app-background-${settings.backgroundPreset}`}
          >
            <AuthNavigator />
          </View>
        </View>
        <BottomTabBar currentRouteName={currentRouteName} />
        <MiniProfileCardHost />
        <StatusBar style="light" />
      </NavigationContainer>
    </AuthProvider>
  );
}

export default function App() {
  const [fontsLoaded, fontsError] = useFonts({
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

  useEffect(() => {
    if (fontsLoaded || fontsError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontsError]);

  // hydrate la preference accuses de lecture des le boot pour que useWebSocket
  // l ait deja en cache au premier message envoye/recu
  useEffect(() => {
    hydrateReadReceiptsPref().catch(() => {});
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontsError) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontsError]);

  if (!fontsLoaded && !fontsError) {
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
          <AppShell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
    backgroundColor: "#050816",
  },
  appContent: {
    flex: 1,
  },
  customBackgroundImage: {
    opacity: 1,
  },
});
