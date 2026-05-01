import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLinkPreview, normalizeLinkPreview } from "./linkPreview";

describe("linkPreview service", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    jest.resetAllMocks();
    await AsyncStorage.clear();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("hydrates a YouTube thumbnail when the preview payload has no image", () => {
    const preview = normalizeLinkPreview({
      url: "https://youtu.be/eOtnJbuOEoo?si=boJwV3bN-aw1CG3z",
      title: "Video test",
      siteName: "YouTube",
    });

    expect(preview).toMatchObject({
      canonicalUrl: "https://youtu.be/eOtnJbuOEoo?si=boJwV3bN-aw1CG3z",
      imageUrl: "https://i.ytimg.com/vi/eOtnJbuOEoo/hqdefault.jpg",
      siteName: "YouTube",
      title: "Video test",
    });
  });

  it("extracts the preview image from the fetched HTML metadata", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      url: "https://example.test/article",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type"
            ? "text/html; charset=utf-8"
            : null,
      },
      text: async () => `
        <html>
          <head>
            <meta property="og:title" content="Example article" />
            <meta property="og:description" content="Preview description" />
            <meta property="og:image:secure_url" content="https://cdn.example.test/cover.jpg" />
            <meta property="og:site_name" content="Example" />
          </head>
        </html>
      `,
    });
    global.fetch = mockFetch as typeof fetch;

    const preview = await getLinkPreview("https://example.test/article");

    expect(preview).toMatchObject({
      canonicalUrl: "https://example.test/article",
      imageUrl: "https://cdn.example.test/cover.jpg",
      siteName: "Example",
      title: "Example article",
      description: "Preview description",
    });
  });

  it("refreshes a cached preview that was stored without an image", async () => {
    await AsyncStorage.setItem(
      "whispr.link-preview.v2.https%3A%2F%2Fexample.test%2Fstale",
      JSON.stringify({
        preview: {
          url: "https://example.test/stale",
          canonicalUrl: "https://example.test/stale",
          title: "Stale preview",
          siteName: "Example",
          domain: "example.test",
        },
        expiresAt: Date.now() + 60_000,
      }),
    );

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      url: "https://example.test/stale",
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-type"
            ? "text/html; charset=utf-8"
            : null,
      },
      text: async () => `
        <html>
          <head>
            <meta property="og:title" content="Fresh preview" />
            <meta property="og:image" content="https://cdn.example.test/fresh.jpg" />
          </head>
        </html>
      `,
    });
    global.fetch = mockFetch as typeof fetch;

    const preview = await getLinkPreview("https://example.test/stale");

    expect(preview).toMatchObject({
      title: "Fresh preview",
      imageUrl: "https://cdn.example.test/fresh.jpg",
    });
  });
});
