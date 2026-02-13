if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, 'toReversed', {
    value: function () {
      return this.slice().reverse();
    },
    writable: true,
    configurable: true,
  });
}

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for react-native-reanimated web imports
config.resolver.sourceExts = [...config.resolver.sourceExts, 'web.ts', 'web.tsx'];

// Fix for semver module resolution in react-native-reanimated
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Fix for CommonJS modules in nested node_modules
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
