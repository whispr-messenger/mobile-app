import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type SecureStoreModule = typeof import("expo-secure-store");

const getSecureStore = (): SecureStoreModule | null => {
  if (Platform.OS === "web") return null;
  try {
    return require("expo-secure-store") as SecureStoreModule;
  } catch {
    return null;
  }
};

export const storage = {
  async getItem(key: string): Promise<string | null> {
    const secureStore = getSecureStore();
    if (secureStore) return secureStore.getItemAsync(key);
    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    const secureStore = getSecureStore();
    if (secureStore) {
      await secureStore.setItemAsync(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    const secureStore = getSecureStore();
    if (secureStore) {
      await secureStore.deleteItemAsync(key);
      return;
    }
    await AsyncStorage.removeItem(key);
  },
};
