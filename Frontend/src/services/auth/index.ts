/**
 * AuthService Factory - Choisit automatiquement entre Mock et Real
 * Basé sur la configuration API
 */

import { apiConfig } from '../../config/api.config';
import { AuthServiceMock } from './AuthServiceMock';
import { AuthServiceReal } from './AuthServiceReal';
import type { IAuthService } from './types';

// Factory pattern : choisit automatiquement entre mock et réel
export const createAuthService = (): IAuthService => {
  if (apiConfig.useMock) {
    console.log('[Auth] Using MOCK service');
    return new AuthServiceMock();
  } else {
    console.log('[Auth] Using REAL API service');
    return new AuthServiceReal(apiConfig.authServiceUrl);
  }
};

// Export singleton (comme l'ancien AuthService)
export const AuthService = createAuthService();

// Export des types pour utilisation externe
export type { IAuthService, PhoneNumber, VerificationCode, UserProfile, AuthResponse } from './types';

// Export par défaut pour compatibilité
export default AuthService;

