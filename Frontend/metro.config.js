// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for react-native-reanimated web imports
config.resolver.sourceExts = [...config.resolver.sourceExts, 'web.ts', 'web.tsx'];

// Fix for semver module resolution in react-native-reanimated
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

module.exports = config;

