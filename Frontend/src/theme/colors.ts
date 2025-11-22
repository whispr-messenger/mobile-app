/**
 * Whispr Design System - Colors
 * Extracted from Figma: https://www.figma.com/design/cHGa2fzfzSBLlSXw4YIBqU/Whispr
 */

export const colors = {
  // Primary Brand Colors
  primary: {
    main: '#FE7A5C',      // Orange/Coral principal
    light: '#FF8E8E',     // Orange clair
    dark: '#F96645',      // Orange foncé
  },

  // Secondary Brand Colors  
  secondary: {
    main: '#6774BD',      // Bleu principal
    light: '#9692AC',     // Bleu/Violet clair
    medium: '#39437C',    // Bleu moyen
    dark: '#212135',      // Bleu très foncé
    darker: '#111F4B',    // Bleu marine
  },

  // Background Colors
  background: {
    primary: '#FFFFFF',   // Fond blanc
    secondary: '#F6F6F6', // Gris très clair
    tertiary: '#ABABAB',  // Gris moyen
    dark: '#0A0E27',      // Noir très sombre (comme Telegram)
    darkCard: '#1A1F3A',  // Fond card mode sombre
    
    // Gradients
    gradient: {
      // EXACT Whispr/Telegram-like gradient: navy → violet → coral
      auth: ['#0B1124', '#3C2E7C', '#FE7A5C'],
      app: ['#0B1124', '#3C2E7C', '#FE7A5C'],
      unreadAction: ['#6774BD', '#FE7A5C'],
    }
  },

  // Text Colors
  text: {
    primary: '#000000',   // Noir principal
    secondary: '#545458', // Gris foncé
    tertiary: '#767680',  // Gris moyen
    disabled: '#8E8E93',  // Gris clair
    light: '#FFFFFF',     // Blanc
    placeholder: '#ABABAB', // Gris placeholder
  },

  // UI Colors
  ui: {
    border: '#8E8E93',    // Bordures
    divider: '#8F8C9F',   // Lignes de séparation
    success: '#21C004',   // Vert (succès)
    error: '#FF3B30',     // Rouge (erreur)
    warning: '#F04882',   // Pink (avertissement)
    info: '#6774BD',      // Bleu (info)
  },

  // Status Colors (Messages)
  status: {
    online: '#21C004',    // Vert - En ligne
    offline: '#8E8E93',   // Gris - Hors ligne
    delivered: '#6774BD', // Bleu - Livré
    read: '#6774BD',      // Bleu - Lu
    sending: '#ABABAB',   // Gris - Envoi en cours
  },

  // Additional Palette
  palette: {
    violet: '#727596',
    darkViolet: '#5F5367',
    gray: '#8E8E93',
    lightGray: '#FCFCFE',
    beige: '#8F8C9F',
  }
} as const;

export type Colors = typeof colors;

// Helper pour créer des couleurs avec opacité
export const withOpacity = (color: string, opacity: number): string => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

