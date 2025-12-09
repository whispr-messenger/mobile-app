/**
 * API Configuration - Gestion mock vs réel
 * Permet de basculer entre les données mockées et l'API réelle
 */

export interface ApiConfig {
  useMock: boolean;
  apiBaseUrl: string;
  authServiceUrl: string;
}

// Détection automatique via variable d'environnement
const getApiConfig = (): ApiConfig => {
  // En React Native/Expo, on utilise process.env.EXPO_PUBLIC_*
  // En développement, on utilise les mocks par défaut
  const USE_MOCK = __DEV__ && process.env.EXPO_PUBLIC_USE_MOCK !== 'false';
  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.whispr.local/api/v1';
  const AUTH_SERVICE_URL = process.env.EXPO_PUBLIC_AUTH_SERVICE_URL || 'https://whispr.epitech-msc2026.me/auth/v1';

  return {
    useMock: USE_MOCK,
    apiBaseUrl: API_BASE_URL,
    authServiceUrl: AUTH_SERVICE_URL,
  };
};

export const apiConfig = getApiConfig();

// Log pour debug
if (__DEV__) {
  console.log('[API Config]', {
    useMock: apiConfig.useMock,
    apiBaseUrl: apiConfig.apiBaseUrl,
    authServiceUrl: apiConfig.authServiceUrl,
  });
}

