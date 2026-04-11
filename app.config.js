const base = require('./app.json');

module.exports = ({ config }) => ({
  ...base.expo,
  ios: {
    ...base.expo.ios,
    infoPlist: {
      ...base.expo.ios?.infoPlist,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  extra: {
    apiBaseUrl: process.env.API_BASE_URL || 'https://preprod-whispr-api.roadmvn.com',
    devAuthApiUrl: 'http://10.0.2.2:3010',
    devUserApiUrl: 'http://10.0.2.2:3011',
    appVersion: '1.0.0',
    eas: {
      projectId: '203ca2cd-9035-489b-9c0d-ca4a1bfb2d36',
    },
  },
});
