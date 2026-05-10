/**
 * MiniProfileCardHost - mount point pour la mini-card profil. Doit etre rendu
 * une fois en haut de l'app (apres NavigationContainer pour pouvoir naviguer).
 *
 * Sur natif (iOS/Android) on utilise Modal avec backdrop sombre.
 * Sur web on utilise un overlay absolu en plein ecran avec la card centree
 * (le positionnement par rapport a l'anchor est laisse a une V2 ; pour le MVP
 * la card est centree, ce qui marche sur petits ecrans web et est lisible
 * partout).
 *
 * Click outside / Escape / back press = close.
 */
import React, { useCallback, useEffect } from "react";
import {
  Modal,
  View,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import { useMiniProfileCard } from "../../store/miniProfileCardStore";
import { useAuth } from "../../context/AuthContext";
import { messagingAPI } from "../../services/messaging/api";
import { MiniProfileCard } from "./MiniProfileCard";
import type { AuthStackParamList } from "../../navigation/AuthNavigator";

export const MiniProfileCardHost: React.FC = () => {
  const { isOpen, currentUserId: viewedUserId, close } = useMiniProfileCard();
  const { userId: authUserId } = useAuth();
  const navigation = useNavigation<StackNavigationProp<AuthStackParamList>>();

  // Echap fermeture sur web
  useEffect(() => {
    if (!isOpen || Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const w = globalThis as unknown as {
      addEventListener: (t: string, h: (e: KeyboardEvent) => void) => void;
      removeEventListener: (t: string, h: (e: KeyboardEvent) => void) => void;
    };
    w.addEventListener("keydown", onKey);
    return () => {
      w.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close]);

  const handleOpenFullProfile = useCallback(() => {
    if (!viewedUserId) return;
    close();
    navigation.navigate("UserProfile", { userId: viewedUserId });
  }, [viewedUserId, close, navigation]);

  const handleOpenSelfProfile = useCallback(() => {
    close();
    navigation.navigate("MyProfile");
  }, [close, navigation]);

  const handleMessage = useCallback(async () => {
    if (!viewedUserId) return;
    try {
      const conversation =
        await messagingAPI.createDirectConversation(viewedUserId);
      close();
      navigation.navigate("Chat", { conversationId: conversation.id });
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Impossible de creer la conversation";
      Alert.alert("Erreur", message);
    }
  }, [viewedUserId, close, navigation]);

  if (!isOpen || !viewedUserId) return null;

  const cardEl = (
    <MiniProfileCard
      userId={viewedUserId}
      currentUserId={authUserId}
      onClose={close}
      onOpenFullProfile={handleOpenFullProfile}
      onOpenSelfProfile={handleOpenSelfProfile}
      onMessage={handleMessage}
    />
  );

  if (Platform.OS === "web") {
    return (
      <View style={styles.webOverlay} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.webCenter}>{cardEl}</View>
      </View>
    );
  }

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheet}>
          {cardEl}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sheet: {
    width: "90%",
    maxWidth: 360,
    alignItems: "center",
  },
  webOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  webCenter: {
    width: "90%",
    maxWidth: 360,
  },
});
