/**
 * Constantes partagées de la pilule flottante (WHISPR-1194). Vit dans un
 * fichier sans dépendance pour pouvoir être consommé depuis les écrans sans
 * traîner le module BottomTabBar entier (et son `navigationRef`) dans les
 * suites de tests.
 */

export const FLOATING_TAB_BAR_PILL_HEIGHT = 64;
export const FLOATING_TAB_BAR_HORIZONTAL_MARGIN = 16;
export const FLOATING_TAB_BAR_BOTTOM_OFFSET = 12;
export const FLOATING_TAB_BAR_BORDER_RADIUS = 32;

/**
 * Espace vertical à réserver en bas du contenu scrollable des écrans hébergeant
 * la pilule (Contacts / Calls / Discussions / Réglages) pour qu'aucun élément
 * ne se retrouve coincé sous la barre flottante. À combiner avec
 * `useSafeAreaInsets().bottom` côté consommateur.
 */
export const FLOATING_TAB_BAR_RESERVED_SPACE =
  FLOATING_TAB_BAR_PILL_HEIGHT + FLOATING_TAB_BAR_BOTTOM_OFFSET + 8;
