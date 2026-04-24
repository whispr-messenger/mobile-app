import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "@whispr/profile_setup_done";

export const profileSetupFlag = {
  async get(): Promise<"0" | "1" | null> {
    const v = await AsyncStorage.getItem(KEY);
    return v === "0" || v === "1" ? v : null;
  },
  async markPending(): Promise<void> {
    await AsyncStorage.setItem(KEY, "0");
  },
  async markDone(): Promise<void> {
    await AsyncStorage.setItem(KEY, "1");
  },
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(KEY);
  },
};
