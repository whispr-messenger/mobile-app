import Constants from "expo-constants";

/** Production (releases EAS avec `extra.apiBaseUrl` non défini). */
const PROD_API_URL = "https://whispr-api.roadmvn.com";

/**
 * Même défaut que `app.json` / `app.config.js` quand aucune variable d'env
 * ne surcharge — évite de pointer la prod en dev si `expoConfig.extra` est vide.
 */
const APP_CONFIG_DEFAULT_API = "https://preprod-whispr-api.roadmvn.com";

function pickBaseUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  return t.length > 0 ? t : undefined;
}

/**
 * Récupère `apiBaseUrl` depuis toutes les sources Expo (dev client, bare, web).
 * `expoConfig.extra` est parfois absent alors que `manifest(2).extra` contient encore la valeur.
 */
function resolveApiBaseUrlFromConstants(): string | undefined {
  const expoExtra = Constants.expoConfig?.extra as
    | { apiBaseUrl?: string }
    | undefined;
  const fromExpo = pickBaseUrl(expoExtra?.apiBaseUrl);
  if (fromExpo) return fromExpo;

  const m1 = Constants.manifest as { extra?: { apiBaseUrl?: string } } | null;
  const fromM1 = pickBaseUrl(m1?.extra?.apiBaseUrl);
  if (fromM1) return fromM1;

  const m2 = Constants.manifest2?.extra as { apiBaseUrl?: string } | undefined;
  const fromM2 = pickBaseUrl(m2?.apiBaseUrl);
  if (fromM2) return fromM2;

  return undefined;
}

export const getApiBaseUrl = (): string => {
  return (
    resolveApiBaseUrlFromConstants() ??
    (__DEV__ ? APP_CONFIG_DEFAULT_API : PROD_API_URL)
  );
};

export const getWsBaseUrl = (): string => {
  const apiBaseUrl = getApiBaseUrl();
  const wsScheme = apiBaseUrl.startsWith("https://") ? "wss" : "ws";
  return apiBaseUrl.replace(/^https?/, wsScheme);
};
