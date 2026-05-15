/* eslint-disable @typescript-eslint/no-require-imports */
// Setup global Jest : mocks partages pour les modules natifs / expo.

// Coverage mode (v8 provider) is ~2-3x slower; default 5s timeout is too
// tight for waitFor in screen-level tests, causing flaky timeouts only
// under --coverage. Lift it globally.
jest.setTimeout(15_000);

// polyfill IndexedDB pour que les services web qui persistent une wrapping
// key (cf. src/services/webCryptoVault.web.ts) tournent sous Jest.
require("fake-indexeddb/auto");

// jsdom < 24 livre un crypto partiel sans SubtleCrypto. webcrypto de
// node:crypto est compatible API avec les globals navigateur que
// webCryptoVault attend (subtle, getRandomValues), on swap.
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    value: require("crypto").webcrypto,
    configurable: true,
    writable: true,
  });
}

// jsdom (sur la version de Node pinned par jest-expo) n'expose pas
// TextEncoder / TextDecoder en global de test. node:util a la meme API.
if (typeof globalThis.TextEncoder === "undefined") {
  const util = require("util");
  globalThis.TextEncoder = util.TextEncoder;
  globalThis.TextDecoder = util.TextDecoder;
}

// jest-expo n'expose pas window.dispatchEvent par defaut. react-native-web et
// certains hooks du theme l'appellent au mount, ce qui crashe le rendu de
// plusieurs ecrans (Groups, etc). On stub le minimum requis.
if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}
if (typeof globalThis.window.dispatchEvent !== "function") {
  globalThis.window.dispatchEvent = () => true;
}
if (typeof globalThis.window.addEventListener !== "function") {
  globalThis.window.addEventListener = () => {};
}
if (typeof globalThis.window.removeEventListener !== "function") {
  globalThis.window.removeEventListener = () => {};
}

// react-native-safe-area-context : on expose l'API complete
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children(insets),
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    SafeAreaInsetsContext: {
      Consumer: ({ children }) => children(insets),
      Provider: ({ children }) => children,
    },
    initialWindowMetrics: { insets, frame },
  };
});

// expo-linear-gradient : pass-through par defaut
jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }) => children,
}));

// @expo/vector-icons : rien afficher
jest.mock("@expo/vector-icons", () => {
  const Noop = () => null;
  return new Proxy({ __esModule: true, default: Noop }, { get: () => Noop });
});

// expo-secure-store : WHISPR-994 : src/services/storage.ts l'importe en
// statique (pas de fallback require dynamique). Sans ce mock setup-level,
// chaque test qui touche storage plante.
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
