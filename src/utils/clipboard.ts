import * as Clipboard from "expo-clipboard";

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await Clipboard.setStringAsync(text);
    try {
      const readBack = await Clipboard.getStringAsync();
      if (readBack !== text) return false;
    } catch {
      // iOS may block read-back due to paste permission — copy still succeeded
    }
    return true;
  } catch (e) {
    console.warn("[Clipboard] copy failed:", e);
    return false;
  }
};
