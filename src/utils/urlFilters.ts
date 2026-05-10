/**
 * Checks whether a URL is reachable from the client device.
 * Rejects internal Kubernetes cluster hostnames and raw MinIO/IP HTTP URLs
 * that would fail to resolve or trigger Mixed Content errors on HTTPS pages.
 */
export const isReachableUrl = (url?: string | null): boolean => {
  if (typeof url !== "string" || url.length === 0) return false;
  if (url.includes(".svc.cluster.local")) return false;
  if (url.includes("minio.minio")) return false;
  if (/^http:\/\/(minio|[\d.]+:)/i.test(url)) return false;
  return true;
};

/**
 * Verifie qu'une URL utilise un schema http(s) avant de la passer a
 * Linking.openURL. Empeche un backend compromis ou un payload malveillant
 * d'injecter `javascript:`, `intent:`, `file:` ou tout autre schema qui
 * ouvrirait un vecteur d'execution arbitraire cote client.
 */
export const isHttpUrl = (url?: string | null): boolean => {
  if (typeof url !== "string" || url.length === 0) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};
