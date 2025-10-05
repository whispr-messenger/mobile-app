/**
 * CountryService - Gestion des pays et codes téléphoniques
 * Gère les données fictives pour les tests et prépare l'intégration API
 */

import { countries, Country, searchCountries } from '../data/countries';

export interface CountryResponse {
  success: boolean;
  data?: Country[];
  error?: string;
}

export class CountryService {
  private static instance: CountryService;

  private constructor() {}

  public static getInstance(): CountryService {
    if (!CountryService.instance) {
      CountryService.instance = new CountryService();
    }
    return CountryService.instance;
  }

  /**
   * Récupère tous les pays (données fictives pour l'instant)
   * TODO: Remplacer par un appel API réel
   */
  async getAllCountries(): Promise<CountryResponse> {
    try {
      // Simulation d'un délai réseau
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return {
        success: true,
        data: countries
      };
    } catch (error) {
      console.error('❌ Erreur récupération pays:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération des pays'
      };
    }
  }

  /**
   * Recherche des pays par nom, code ou drapeau
   * TODO: Remplacer par un appel API réel
   */
  async searchCountries(query: string): Promise<CountryResponse> {
    try {
      // Simulation d'un délai réseau
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const results = searchCountries(query);
      
      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('❌ Erreur recherche pays:', error);
      return {
        success: false,
        error: 'Erreur lors de la recherche'
      };
    }
  }

  /**
   * Récupère les pays par région
   * TODO: Remplacer par un appel API réel
   */
  async getCountriesByRegion(region: string): Promise<CountryResponse> {
    try {
      // Simulation d'un délai réseau
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const results = countries.filter(country => country.region === region);
      
      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('❌ Erreur récupération pays par région:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération des pays'
      };
    }
  }

  /**
   * Valide un code de pays
   */
  validateCountryCode(code: string): { isValid: boolean; country?: Country } {
    const country = countries.find(c => c.code === code);
    return {
      isValid: !!country,
      country
    };
  }

  /**
   * Récupère les pays populaires (pour affichage par défaut)
   * TODO: Remplacer par des données réelles basées sur l'usage
   */
  async getPopularCountries(): Promise<CountryResponse> {
    try {
      // Pays populaires basés sur l'usage typique
      const popularCountryIds = ['fr', 'us', 'gb', 'de', 'it', 'es', 'ca', 'au', 'jp', 'cn'];
      const popularCountries = countries.filter(country => 
        popularCountryIds.includes(country.id)
      );
      
      return {
        success: true,
        data: popularCountries
      };
    } catch (error) {
      console.error('❌ Erreur récupération pays populaires:', error);
      return {
        success: false,
        error: 'Erreur lors de la récupération des pays populaires'
      };
    }
  }

  /**
   * TODO: Méthodes pour l'intégration API réelle
   * 
   * async getAllCountriesFromAPI(): Promise<CountryResponse> {
   *   try {
   *     const response = await fetch('/api/countries');
   *     const data = await response.json();
   *     return { success: true, data };
   *   } catch (error) {
   *     return { success: false, error: 'Erreur API' };
   *   }
   * }
   * 
   * async searchCountriesFromAPI(query: string): Promise<CountryResponse> {
   *   try {
   *     const response = await fetch(`/api/countries/search?q=${encodeURIComponent(query)}`);
   *     const data = await response.json();
   *     return { success: true, data };
   *   } catch (error) {
   *     return { success: false, error: 'Erreur API' };
   *   }
   * }
   */
}

export default CountryService;


