import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Configuration des URLs selon l'environnement
const API_BASE_URL = Platform.select({
  ios: __DEV__ ? 'http://localhost:3000' : 'https://api.whispr.com',
  android: __DEV__ ? 'http://10.0.2.2:3000' : 'https://api.whispr.com',
});

const WS_BASE_URL = Platform.select({
  ios: __DEV__ ? 'ws://localhost:4000' : 'wss://ws.whispr.com',
  android: __DEV__ ? 'ws://10.0.2.2:4000' : 'wss://ws.whispr.com',
});

// Configuration du client axios
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour l'authentification automatique
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur pour la gestion des erreurs
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expiré, rediriger vers la connexion
      await AsyncStorage.removeItem('authToken');
      // Navigation vers l'écran de connexion
    }
    return Promise.reject(error);
  }
);

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  wsURL: WS_BASE_URL,
  timeout: 10000,
};

export default apiClient;
