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
