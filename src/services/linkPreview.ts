import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MessageLinkPreview } from "../types/messaging";
import { isReachableUrl } from "../utils";

const LINK_PREVIEW_KEY_PREFIX = "whispr.link-preview.v2.";
const SUCCESS_TTL_MS = 12 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_HTML_LENGTH = 250_000;

type CacheEntry = {
  preview: MessageLinkPreview | null;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<MessageLinkPreview | null>>();

const URL_REGEX = /(https?:\/\/[^\s<>"'`{}|\\^\[\]]+)/i;
const TRAILING_URL_PUNCTUATION = /[),.!?:;]+$/;

function cacheKey(url: string) {
  return `${LINK_PREVIEW_KEY_PREFIX}${encodeURIComponent(url)}`;
}

function trimTrailingPunctuation(url: string): string {
  let trimmed = url.trim();
  while (TRAILING_URL_PUNCTUATION.test(trimmed)) {
    const candidate = trimmed.replace(TRAILING_URL_PUNCTUATION, "");
    if (!candidate || candidate === trimmed) break;
    trimmed = candidate;
  }
  return trimmed;
}

function normalizeUrl(url: string): string | null {
  const trimmed = trimTrailingPunctuation(url);
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractFirstUrl(text?: string | null): string | null {
  if (!text) return null;
  const match = text.match(URL_REGEX);
  if (!match?.[1]) return null;
  return normalizeUrl(match[1]);
}

function decodeHtmlEntities(value: string): string {
  // decoder &amp; en dernier evite le double-unescape:
  // sinon "&amp;lt;" deviendrait "<" au lieu de "&lt;"
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(parseInt(code, 16)),
    )
    .replace(/&amp;/gi, "&");
}

function compactWhitespace(
  value: string | null | undefined,
): string | undefined {
  const normalized = decodeHtmlEntities(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || undefined;
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attrRegex =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;

  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(tag))) {
    const key = match[1].toLowerCase();
    const value = match[3] ?? match[4] ?? match[5] ?? "";
    attributes[key] = value;
  }

  return attributes;
}

function extractMetaContent(html: string, keys: string[]): string | undefined {
  const metaTags = html.match(/<meta\s+[^>]*>/gi) ?? [];
  const wanted = new Set(keys.map((key) => key.toLowerCase()));

  for (const tag of metaTags) {
    const attrs = parseAttributes(tag);
    const identity = (
      attrs.property ||
      attrs.name ||
      attrs.itemprop ||
      ""
    ).toLowerCase();
    const content = compactWhitespace(attrs.content);

    if (content && wanted.has(identity)) {
      return content;
    }
  }

  return undefined;
}

function extractTitleTag(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return compactWhitespace(match?.[1]);
}

function extractCanonicalUrl(
  html: string,
  baseUrl: string,
): string | undefined {
  const linkTags = html.match(/<link\s+[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    const attrs = parseAttributes(tag);
    const rel = (attrs.rel || "").toLowerCase();
    if (!rel.includes("canonical") || !attrs.href) continue;
    try {
      return new URL(attrs.href, baseUrl).toString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function toAbsoluteUrl(
  value: string | null | undefined,
  baseUrl: string,
): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function getDomainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function getYoutubeThumbnail(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    let videoId = "";

    if (host === "youtu.be") {
      videoId = parsed.pathname.replace(/^\/+/, "").split("/")[0] || "";
    } else if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v") || "";
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/")[2] || "";
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/")[2] || "";
      }
    }

    if (!videoId) return undefined;
    return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
  } catch {
    return undefined;
  }
}

function buildFallbackPreview(url: string): MessageLinkPreview {
  return {
    url,
    canonicalUrl: url,
    title: getDomainLabel(url),
    siteName: getDomainLabel(url),
    domain: getDomainLabel(url),
  };
}

function shouldRefreshPreview(preview: MessageLinkPreview | null): boolean {
  return !!preview && !preview.imageUrl;
}

function buildPreviewFromHtml(
  html: string,
  sourceUrl: string,
  finalUrl: string,
): MessageLinkPreview | null {
  const title =
    extractMetaContent(html, ["og:title", "twitter:title", "title"]) ||
    extractTitleTag(html);
  const description = extractMetaContent(html, [
    "og:description",
    "twitter:description",
    "description",
  ]);
  const siteName =
    extractMetaContent(html, ["og:site_name", "twitter:site"]) ||
    getDomainLabel(finalUrl);
  const canonicalUrl =
    extractMetaContent(html, ["og:url"]) ||
    extractCanonicalUrl(html, finalUrl) ||
    finalUrl;
  const imageCandidate = extractMetaContent(html, [
    "og:image",
    "og:image:url",
    "og:image:secure_url",
    "twitter:image",
    "twitter:image:src",
    "thumbnailurl",
    "thumbnail",
  ]);
  const imageUrl =
    toAbsoluteUrl(imageCandidate, finalUrl) ||
    getYoutubeThumbnail(canonicalUrl) ||
    getYoutubeThumbnail(finalUrl) ||
    getYoutubeThumbnail(sourceUrl);

  if (!title && !description && !imageUrl) {
    return buildFallbackPreview(canonicalUrl);
  }

  return {
    url: sourceUrl,
    canonicalUrl,
    title: title || getDomainLabel(canonicalUrl),
    description,
    imageUrl: isReachableUrl(imageUrl) ? imageUrl : undefined,
    siteName,
    domain: getDomainLabel(canonicalUrl),
  };
}

export function normalizeLinkPreview(
  raw: Partial<MessageLinkPreview> | null | undefined,
): MessageLinkPreview | null {
  if (!raw) return null;
  const url = normalizeUrl(raw.canonicalUrl || raw.url || "");
  if (!url) return null;

  const title = compactWhitespace(raw.title);
  const description = compactWhitespace(raw.description);
  const siteName = compactWhitespace(raw.siteName) || getDomainLabel(url);
  const imageUrl =
    (isReachableUrl(raw.imageUrl) ? raw.imageUrl : undefined) ||
    getYoutubeThumbnail(raw.canonicalUrl || url);

  if (!title && !description && !imageUrl) {
    return buildFallbackPreview(url);
  }

  return {
    url,
    canonicalUrl: normalizeUrl(raw.canonicalUrl || url) || url,
    title: title || getDomainLabel(url),
    description,
    imageUrl,
    siteName,
    domain: compactWhitespace(raw.domain) || getDomainLabel(url),
  };
}

async function readStoredCache(url: string): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(url));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed.expiresAt !== "number") return null;
    if (parsed.expiresAt <= Date.now()) {
      await AsyncStorage.removeItem(cacheKey(url)).catch(() => {});
      return null;
    }
    return {
      preview: normalizeLinkPreview(parsed.preview),
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

async function writeStoredCache(
  url: string,
  preview: MessageLinkPreview | null,
  ttlMs: number,
) {
  const entry: CacheEntry = {
    preview,
    expiresAt: Date.now() + ttlMs,
  };
  memoryCache.set(url, entry);
  try {
    await AsyncStorage.setItem(cacheKey(url), JSON.stringify(entry));
  } catch {
    // Best effort only — memory cache still protects the current session.
  }
}

async function fetchRemotePreview(
  url: string,
): Promise<MessageLinkPreview | null> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return null;
    }

    const finalUrl = normalizeUrl(response.url || url) || url;
    const contentType =
      response.headers.get("content-type")?.toLowerCase() || "";

    if (contentType.startsWith("image/")) {
      return {
        url,
        canonicalUrl: finalUrl,
        title: getDomainLabel(finalUrl),
        imageUrl: finalUrl,
        siteName: getDomainLabel(finalUrl),
        domain: getDomainLabel(finalUrl),
      };
    }

    const html = (await response.text()).slice(0, MAX_HTML_LENGTH);
    return buildPreviewFromHtml(html, url, finalUrl);
  } catch {
    return null;
  }
}

export async function getLinkPreview(
  candidateUrl: string,
): Promise<MessageLinkPreview | null> {
  const url = normalizeUrl(candidateUrl);
  if (!url) return null;
  let stalePreview: MessageLinkPreview | null = null;

  const memoryEntry = memoryCache.get(url);
  if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
    if (!shouldRefreshPreview(memoryEntry.preview)) {
      return memoryEntry.preview;
    }
    stalePreview = memoryEntry.preview;
  }

  const storedEntry = await readStoredCache(url);
  if (storedEntry) {
    memoryCache.set(url, storedEntry);
    if (!shouldRefreshPreview(storedEntry.preview)) {
      return storedEntry.preview;
    }
    stalePreview = storedEntry.preview;
  }

  const existing = inFlightRequests.get(url);
  if (existing) {
    return existing;
  }

  const request = fetchRemotePreview(url)
    .then(async (preview) => {
      const normalized = normalizeLinkPreview(preview) || stalePreview;
      await writeStoredCache(
        url,
        normalized,
        normalized ? SUCCESS_TTL_MS : FAILURE_TTL_MS,
      );
      return normalized;
    })
    .finally(() => {
      inFlightRequests.delete(url);
    });

  inFlightRequests.set(url, request);
  return request;
}
