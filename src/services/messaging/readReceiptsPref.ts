/**
 * readReceiptsPref - Cache local du toggle "Accusés de lecture"
 *
 * Le toggle vit dans AsyncStorage sous la clé @whispr_settings_messaging.
 * Pour eviter une lecture asynchrone a chaque envoi/reception WS, on garde
 * un mirror en memoire hydrate au boot via hydrateReadReceiptsPref().
 *
 * Symetrie WhatsApp punitive : si OFF -> on n envoie pas message_read ET
 * on ignore les message_read recus des autres.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@whispr_settings_messaging";

// par defaut on respecte l ancien comportement : accuses actives
let cached: boolean = true;
let hydrated = false;

/**
 * Lit la preference depuis AsyncStorage et met a jour le mirror memoire.
 * A appeler au boot (App.tsx) et avant tout consumer qui veut etre sur
 * d avoir la valeur courante.
 */
export async function hydrateReadReceiptsPref(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.readReceipts === "boolean") {
        cached = parsed.readReceipts;
      }
    }
  } catch {
    // si AsyncStorage casse, on garde la valeur par defaut (true)
  }
  hydrated = true;
  return cached;
}

/**
 * Lecture synchrone du mirror memoire. Si pas hydrate -> defaut true.
 */
export function getReadReceiptsEnabled(): boolean {
  return cached;
}

/**
 * Mise a jour synchrone du mirror (appelee depuis SettingsScreen quand le
 * user toggle, avant meme le persist async).
 */
export function setReadReceiptsEnabled(value: boolean): void {
  cached = value;
  hydrated = true;
}

/**
 * Helper test-only : reset l etat module pour repartir d un cache vierge.
 */
export function __resetReadReceiptsPrefForTests(): void {
  cached = true;
  hydrated = false;
}

/**
 * Indique si la preference a deja ete chargee. Utile pour les tests.
 */
export function isReadReceiptsPrefHydrated(): boolean {
  return hydrated;
}
