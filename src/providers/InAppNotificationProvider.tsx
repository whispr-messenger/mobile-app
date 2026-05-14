import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { navigationRef } from "../navigation/navigationRef";
import { TokenService } from "../services/TokenService";
import { useConversationsStore } from "../store/conversationsStore";
import { useToastStore } from "../store/toastStore";
import type { Message } from "../types/messaging";

type RouteParams = {
  conversationId?: string;
};

function getActiveConversationId(): string | null {
  const route = navigationRef.getCurrentRoute();
  if (route?.name !== "Chat") return null;

  const params = route.params as RouteParams | undefined;
  return typeof params?.conversationId === "string"
    ? params.conversationId
    : null;
}

export const InAppNotificationProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { isAuthenticated, userId } = useAuth();
  const applyNewMessage = useConversationsStore((s) => s.applyNewMessage);
  const showToast = useToastStore((s) => s.show);
  const [token, setToken] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated || !userId) {
      setToken("");
      return () => {
        cancelled = true;
      };
    }

    TokenService.getAccessToken().then((nextToken) => {
      if (!cancelled) setToken(nextToken ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, userId]);

  const handleNewMessage = useCallback(
    (message: Message) => {
      if (!userId || !message?.id) return;

      void applyNewMessage(message, userId);

      if (message.sender_id === userId) return;
      if (getActiveConversationId() === message.conversation_id) return;

      // showToast écrit dans le store global — le Toast est rendu au niveau
      // root dans App.jsx, hors de tout conteneur overflow:hidden, pour
      // garantir la visibilité en PWA web.
      showToast("Nouveau message", "info");
    },
    [applyNewMessage, showToast, userId],
  );

  useWebSocket({
    userId: userId ?? "",
    token,
    onNewMessage: handleNewMessage,
  });

  return <>{children}</>;
};

export default InAppNotificationProvider;
