/**
 * Store Zustand singleton qui maintient au plus une mini-card profil visible.
 * Ouvrir une card alors qu'une autre est deja affichee = close A puis open B.
 */
import { RefObject } from "react";
import { create } from "zustand";

interface MiniProfileCardState {
  isOpen: boolean;
  userId: string | null;
  /** ref du composant declencheur, sert a positionner le popover sur web */
  anchorRef: RefObject<unknown> | null;
}

interface MiniProfileCardActions {
  open: (userId: string, anchorRef: RefObject<unknown> | null) => void;
  close: () => void;
}

export const useMiniProfileCardStore = create<
  MiniProfileCardState & MiniProfileCardActions
>((set) => ({
  isOpen: false,
  userId: null,
  anchorRef: null,
  open: (userId, anchorRef) => set({ isOpen: true, userId, anchorRef }),
  close: () => set({ isOpen: false, userId: null, anchorRef: null }),
}));

/** API hook orientee usage cote composants (open/close raccourcis). */
export function useMiniProfileCard() {
  const open = useMiniProfileCardStore((s) => s.open);
  const close = useMiniProfileCardStore((s) => s.close);
  const isOpen = useMiniProfileCardStore((s) => s.isOpen);
  const userId = useMiniProfileCardStore((s) => s.userId);
  return { open, close, isOpen, currentUserId: userId };
}
