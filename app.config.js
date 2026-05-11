const base = require('./app.json');

// EAS owner / projectId pilotables par env (.env.local) pour permettre à
// chaque dev de builder le dev-client avec son propre compte EAS sans
// modifier app.json (qui est partagé). Fallback : valeurs équipe.
const easOwnerOverride = process.env.EAS_OWNER;
const easProjectIdOverride = process.env.EAS_PROJECT_ID;
const basePlugins = Array.isArray(base.expo.plugins) ? base.expo.plugins : [];

function hasPlugin(plugins, pluginName) {
  return plugins.some((plugin) =>
    Array.isArray(plugin) ? plugin[0] === pluginName : plugin === pluginName,
  );
}

const plugins = [...basePlugins];

if (!hasPlugin(plugins, 'react-native-call-keeper')) {
  plugins.push('react-native-call-keeper');
}

if (!hasPlugin(plugins, 'expo-dev-client')) {
  plugins.push([
    'expo-dev-client',
    {
      // iPhone Camera often rejects the auto-generated `exp+...` scheme QR.
      // Reuse the app deep-link scheme so the QR opens the installed dev client.
      addGeneratedScheme: false,
    },
  ]);
}

module.exports = () => ({
  ...base.expo,
  ...(easOwnerOverride ? { owner: easOwnerOverride } : {}),
  plugins,
  ios: {
    ...base.expo.ios,
    infoPlist: {
      ...base.expo.ios?.infoPlist,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  extra: {
    ...base.expo.extra,
    apiBaseUrl: process.env.API_BASE_URL || 'https://whispr.devzeyu.com',
    appVersion: '1.0.0',
    eas: {
      projectId:
        easProjectIdOverride || '203ca2cd-9035-489b-9c0d-ca4a1bfb2d36',
    },
  },
});
