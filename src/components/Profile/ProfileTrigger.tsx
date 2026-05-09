/**
 * ProfileTrigger - wrapper qui declenche l'ouverture de la mini-card profil.
 *
 * Comportement :
 * - Touch (PWA mobile + iOS/Android natifs) : appui long 500ms ouvre la card.
 *   Un tap court ne fait rien au niveau du trigger : il propage donc au
 *   parent, ce qui preserve d'eventuels onPress existants (ex: navigation).
 * - Mouse (web desktop) : clic gauche court ouvre la card. Le trigger
 *   stoppe la propagation pour eviter qu'un onPress parent navigate aussi.
 *
 * On detecte le mode via Platform.OS et l'event source : sur web, on attache
 * un listener click DOM tandis que sur natif on utilise Pressable + delayLongPress.
 */
import React, { useCallback, useRef } from "react";
import { Pressable, Platform, View, GestureResponderEvent } from "react-native";
import { useMiniProfileCard } from "../../store/miniProfileCardStore";

interface ProfileTriggerProps {
  userId: string;
  /**
   * Si true, sur web le clic ouvre la card et la propagation est stoppee
   * (utile quand un parent gere un autre onPress conflictuel). Default true.
   */
  stopPropagationOnWeb?: boolean;
  children: React.ReactNode;
}

const LONG_PRESS_MS = 500;

export const ProfileTrigger: React.FC<ProfileTriggerProps> = ({
  userId,
  stopPropagationOnWeb = true,
  children,
}) => {
  const { open, close, isOpen, currentUserId } = useMiniProfileCard();
  const ref = useRef<View>(null);

  const triggerOpen = useCallback(() => {
    // ouvrir B alors que A est ouverte = close A puis open B
    if (isOpen && currentUserId !== userId) {
      close();
    }
    open(userId, ref);
  }, [open, close, isOpen, currentUserId, userId]);

  // ---- web : on intercepte le clic DOM ----
  if (Platform.OS === "web") {
    const handleClick = (e: any) => {
      if (stopPropagationOnWeb) {
        e.stopPropagation?.();
        e.preventDefault?.();
      }
      triggerOpen();
    };
    return (
      <View
        ref={ref}
        // @ts-expect-error react-native-web accepte onClick
        onClick={handleClick}
        accessibilityRole="button"
      >
        {children}
      </View>
    );
  }

  // ---- natif : long-press 500ms ----
  const handleLongPress = (_e: GestureResponderEvent) => {
    triggerOpen();
  };

  return (
    <Pressable
      ref={ref as never}
      onLongPress={handleLongPress}
      delayLongPress={LONG_PRESS_MS}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
};
