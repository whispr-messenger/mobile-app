import AsyncStorage from "@react-native-async-storage/async-storage";

export const storage = {
  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  },

  async deleteItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};
