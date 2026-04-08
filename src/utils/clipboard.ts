import * as Clipboard from "expo-clipboard";

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch (e) {
    console.warn("[Clipboard] copy failed:", e);
    return false;
  }
};
