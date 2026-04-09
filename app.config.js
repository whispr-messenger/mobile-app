const base = require('./app.json');

module.exports = ({ config }) => ({
  ...base.expo,
  extra: {
    apiBaseUrl: process.env.API_BASE_URL || 'https://preprod-whispr-api.roadmvn.com',
    devAuthApiUrl: 'http://10.0.2.2:3010',
    devUserApiUrl: 'http://10.0.2.2:3011',
    appVersion: '1.0.0',
  },
});
