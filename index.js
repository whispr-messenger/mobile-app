import 'react-native-get-random-values';
import { registerRootComponent } from 'expo';
import * as ExpoCrypto from 'expo-crypto';

// Polyfill global.crypto.getRandomValues for tweetnacl (not available in Hermes)
if (!global.crypto) {
  global.crypto = {};
}
if (!global.crypto.getRandomValues) {
  global.crypto.getRandomValues = ExpoCrypto.getRandomValues;
}

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
