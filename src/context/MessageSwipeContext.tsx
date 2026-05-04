/**
 * MessageSwipeContext — exposes a single shared horizontal translation value
 * driven by a pan gesture on the chat list. All MessageBubble rows subscribe
 * to it so they translate left in sync, revealing each row's timestamp on the
 * right edge. The chat screen owns the SharedValue and the gesture.
 */

import React, { createContext, useContext, useMemo } from "react";
import { SharedValue } from "react-native-reanimated";

interface MessageSwipeContextValue {
  translateX: SharedValue<number>;
}

const MessageSwipeContext = createContext<MessageSwipeContextValue | null>(
  null,
);

interface ProviderProps {
  translateX: SharedValue<number>;
  children: React.ReactNode;
}

export const MessageSwipeProvider: React.FC<ProviderProps> = ({
  translateX,
  children,
}) => {
  // Stable identity so consumers don't re-render on every parent render.
  const value = useMemo(() => ({ translateX }), [translateX]);
  return (
    <MessageSwipeContext.Provider value={value}>
      {children}
    </MessageSwipeContext.Provider>
  );
};

export function useMessageSwipe(): MessageSwipeContextValue | null {
  return useContext(MessageSwipeContext);
}
