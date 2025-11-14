// Upload a media file (image/video/doc) and return media metadata
// Expects: { mediaBaseUrl, accessToken, userId, uri, filename }
// Returns: { id, filename, mimeType, size, ... }
export async function uploadMedia({ mediaBaseUrl, accessToken, userId, uri, filename }) {
  if (!mediaBaseUrl) throw new Error('mediaBaseUrl is required');
  const url = `${mediaBaseUrl}/media/upload`;

  // Fetch blob from uri (works on web and native)
  const resBlob = await fetch(uri);
  const blob = await resBlob.blob();

  const form = new FormData();
  // Filename hint helps server-side handling and CDN
  form.append('file', blob, filename || 'background.jpg');
  if (userId) form.append('userId', userId);
  form.append('isTemporary', 'false');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: form,
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json();
}