const base = require('./app.json');

// EAS owner / projectId pilotables par env (.env.local) pour permettre à
// chaque dev de builder le dev-client avec son propre compte EAS sans
// modifier app.json (qui est partagé). Fallback : valeurs équipe.
const easOwnerOverride = process.env.EAS_OWNER;
const easProjectIdOverride = process.env.EAS_PROJECT_ID;

module.exports = ({ config }) => ({
  ...base.expo,
  ...(easOwnerOverride ? { owner: easOwnerOverride } : {}),
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
    devAuthApiUrl: 'http://10.0.2.2:3010',
    devUserApiUrl: 'http://10.0.2.2:3011',
    legalPrivacyUrl:
      process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL || 'https://whispr.example/privacy',
    legalTermsUrl:
      process.env.EXPO_PUBLIC_LEGAL_TERMS_URL || 'https://whispr.example/terms',
    appVersion: '1.0.0',
    eas: {
      projectId:
        easProjectIdOverride || '203ca2cd-9035-489b-9c0d-ca4a1bfb2d36',
    },
  },
});
