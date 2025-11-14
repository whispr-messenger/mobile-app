import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { getPreferences, updatePreferences } from '../api/preferences';

const SettingsContext = createContext(null);

export function SettingsProvider({ children, baseUrl, mediaBaseUrl, tokens, userId }) {
  const [theme, setTheme] = useState('dark'); // 'dark' | 'light'
  const [backgroundType, setBackgroundType] = useState('black'); // 'black' | 'color' | 'gradient' | 'image'
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [avatarUri, setAvatarUri] = useState(null); // string | null
  const [backgroundImageId, setBackgroundImageId] = useState(null); // string | null (mediaId)
  const accessToken = tokens?.accessToken;

  // Load persisted settings
  useEffect(() => {
    // Try server first if available
    (async () => {
      try {
        if (baseUrl && userId) {
          const prefs = await getPreferences({ baseUrl, userId, accessToken });
          if (prefs?.theme) setTheme(prefs.theme);
          if (prefs?.backgroundType) setBackgroundType(prefs.backgroundType);
          if (prefs?.backgroundColor) setBackgroundColor(prefs.backgroundColor);
          if (typeof prefs?.avatarUri !== 'undefined') setAvatarUri(prefs.avatarUri);
          if (typeof prefs?.backgroundImageId !== 'undefined') setBackgroundImageId(prefs.backgroundImageId);
          return; // loaded from server
        }
      } catch {
        // fall back to local storage
      }
    })();

    if (Platform.OS === 'web') {
      try {
        const raw = window.localStorage.getItem('whispr.settings');
        if (raw) {
          const obj = JSON.parse(raw);
          if (obj.theme) setTheme(obj.theme);
          if (obj.backgroundType) setBackgroundType(obj.backgroundType);
          if (obj.backgroundColor) setBackgroundColor(obj.backgroundColor);
          if (obj.avatarUri) setAvatarUri(obj.avatarUri);
          if (obj.backgroundImageId) setBackgroundImageId(obj.backgroundImageId);
        }
      } catch {}
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        const raw = await AsyncStorage.getItem('whispr.settings');
        if (raw && !cancelled) {
          const obj = JSON.parse(raw);
          if (obj.theme) setTheme(obj.theme);
          if (obj.backgroundType) setBackgroundType(obj.backgroundType);
          if (obj.backgroundColor) setBackgroundColor(obj.backgroundColor);
          if (obj.avatarUri) setAvatarUri(obj.avatarUri);
          if (obj.backgroundImageId) setBackgroundImageId(obj.backgroundImageId);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [baseUrl, userId, accessToken]);

  // Persist on change
  useEffect(() => {
    const obj = { theme, backgroundType, backgroundColor, avatarUri, backgroundImageId };
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem('whispr.settings', JSON.stringify(obj)); } catch {}
      return;
    }
    (async () => {
      try {
        const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
        await AsyncStorage.setItem('whispr.settings', JSON.stringify(obj));
      } catch {}
    })();
    // Also push to server if available
    (async () => {
      try {
        if (baseUrl && userId) {
          await updatePreferences({ baseUrl, userId, accessToken, payload: obj });
        }
      } catch {
        // ignore server errors silently for now
      }
    })();
  }, [theme, backgroundType, backgroundColor, avatarUri, backgroundImageId, baseUrl, userId, accessToken]);

  const value = useMemo(() => ({
    theme,
    setTheme,
    backgroundType,
    setBackgroundType,
    backgroundColor,
    setBackgroundColor,
    avatarUri,
    setAvatarUri,
    backgroundImageId,
    setBackgroundImageId,
    baseUrl,
    mediaBaseUrl,
    accessToken,
  }), [theme, backgroundType, backgroundColor, avatarUri]);

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}