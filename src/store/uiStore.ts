import { create } from "zustand";

interface UIState {
  bottomTabBarHidden: boolean;
}

interface UIActions {
  setBottomTabBarHidden: (hidden: boolean) => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
  bottomTabBarHidden: false,
  setBottomTabBarHidden: (hidden) => set({ bottomTabBarHidden: hidden }),
}));
