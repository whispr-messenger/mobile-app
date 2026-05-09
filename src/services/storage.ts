import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// WHISPR-1399 - sur web Metro doit resolver storage.web.ts (vault chiffre).
// Si on tombe ici sur web, c est une mauvaise resolution et la cle
// d identite Signal finirait en clair dans localStorage. Fail-fast.
function assertNotWeb(): void {
  if (Platform.OS === "web") {
    throw new Error(
      "[storage] Platform.OS=web mais storage.ts (native) a ete charge. " +
        "Metro doit resolver storage.web.ts. Verifier la config bundler.",
    );
  }
}

export const storage = {
  async getItem(key: string): Promise<string | null> {
    assertNotWeb();
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    assertNotWeb();
    await SecureStore.setItemAsync(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    assertNotWeb();
    await SecureStore.deleteItemAsync(key);
  },
};
