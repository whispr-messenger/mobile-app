# Restore App Entry & Wire Moderation Test Screen

Date: 2026-04-10
Branch context: `deploy/preprod`

## Problem

During the TFLite → TFJS moderation model migration, `App.js` was temporarily
replaced with a test harness (`export { default } from './ModerationTest';`).
As a result, the real application entry (auth, chat, settings, etc.) no longer
loads. The rest of the moderation integration is already in place:

- `ChatScreen.tsx` calls `gateChatImageBeforeSend(uri)` before media upload
- `gate-chat-image.ts` routes to `tfjsService.gate()`
- `tfjs.service.ts` (native) and `tfjs.service.web.ts` (web) both work
- `metro.config.js` bundles `.bin` weight shards

What's missing is (1) restoring the real `App.js` entry and (2) keeping the
moderation test screen accessible through the normal app, behind a dev-only
entry point in Settings.

## Goals

1. Restore `App.js` so the normal login / register / chat flow loads again.
2. Keep the on-device TFJS moderation gate wired to the chat image send flow
   (already done — verify only, do not change).
3. Expose the `ModerationTest` screen through the app navigator, reachable via
   a `__DEV__`-guarded row in `SettingsScreen`.

## Non-Goals

- Changing model format, threshold, or class labels.
- Touching `ChatScreen.tsx` (moderation call is already correct).
- Adding a production-visible debug UI.

## Design

### 1. `App.js`

Revert to the git `HEAD` version:

```jsx
import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      document.body.style.overflow = 'auto';
    }
  }, []);
  return (
    <ThemeProvider>
      <AuthProvider>
        <NavigationContainer>
          <AuthNavigator />
          <StatusBar style="light" />
        </NavigationContainer>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

Delete `App.js.bak` (stale file, same contents as the broken `App.js`).

### 2. Moderation test screen in the navigator

- Create `src/screens/Debug/ModerationTestScreen.tsx` — a TypeScript port of
  the existing `ModerationTest.js`, with a `navigation.goBack()` header button
  so the user can return to Settings.
- Delete the root-level `ModerationTest.js`.
- In `src/navigation/AuthNavigator.tsx`:
  - Add `ModerationTest: undefined;` to `AuthStackParamList`.
  - Import `ModerationTestScreen` and register it as a `<Stack.Screen>`.

### 3. `__DEV__` debug entry in Settings

In `src/screens/Settings/SettingsScreen.tsx`, inside the existing settings
section list, add a row gated by `if (__DEV__)`:

```tsx
{__DEV__ && (
  <TouchableOpacity onPress={() => navigation.navigate('ModerationTest')}>
    <Text>Debug · Moderation Test</Text>
  </TouchableOpacity>
)}
```

Metro strips `__DEV__` branches in production bundles, so end users will not
see the row in release builds.

## Data Flow (unchanged, for reference)

```
ChatScreen.handleMediaMessage(uri, 'image')
  → gateChatImageBeforeSend(uri)
       → tfjsService.gate({ uri })      // local TFJS inference
  → allowed?
     ├─ no  → Alert("Image bloquée"), return (no network call)
     └─ yes → MediaService.uploadMedia → POST /media/v1/upload
              → messagingApi.sendMessage with media_id
```

## Verification

- `npm run lint:fix`
- `npx prettier --write "src/**/*.{ts,tsx}"`
- `npx tsc --noEmit` (if the project exposes a tsconfig)
- `npm test -- --watchAll=false`

All must be clean before reporting completion.
