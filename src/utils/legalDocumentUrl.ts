import { Platform } from "react-native";
import { getApiBaseUrl } from "../services/apiBase";

export type LegalDocumentSlug = "privacy" | "terms";

/**
 * URL of the static legal pages shipped in `public/legal/`.
 * - Web (PWA / Metro): same origin as the bundle.
 * - Native: served from the API host when static assets are deployed with the app.
 */
export function getLegalDocumentUrl(slug: LegalDocumentSlug): string {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/+$/, "");
    return `${origin}/legal/${slug}.html`;
  }
  const base = getApiBaseUrl().replace(/\/+$/, "");
  return `${base}/legal/${slug}.html`;
}
