/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Companion to messagingApi.test.ts — covers two pure helpers exported by
 * the same module that the existing test file doesn't touch.
 */

jest.mock("../../TokenService", () =>
  require("../../../__test-utils__/mockFactories").makeTokenServiceMock(),
);
jest.mock("../../apiBase", () =>
  require("../../../__test-utils__/mockFactories").makeApiBaseMock(
    "https://api.test",
  ),
);

import { invalidateUserInfoCache, mapBackendAttachment } from "../api";

describe("mapBackendAttachment", () => {
  it("uses the explicit file_type when it is a known media kind", () => {
    const out = mapBackendAttachment({
      id: "a-1",
      message_id: "m-1",
      file_type: "image",
      file_url: "https://api.test/media/v1/abc-def/blob",
    });
    expect(out.media_type).toBe("image");
    expect(out.id).toBe("a-1");
  });

  it("infers media_type from mime when file_type is 'file'", () => {
    expect(
      mapBackendAttachment({ file_type: "file", mime_type: "video/mp4" })
        .media_type,
    ).toBe("video");
    expect(
      mapBackendAttachment({ file_type: "file", mime_type: "audio/aac" })
        .media_type,
    ).toBe("audio");
    expect(
      mapBackendAttachment({ file_type: "file", mime_type: "image/png" })
        .media_type,
    ).toBe("image");
  });

  it("defaults to 'file' when neither file_type nor mime is known", () => {
    expect(
      mapBackendAttachment({ file_type: "exotic", mime_type: "weird" })
        .media_type,
    ).toBe("file");
  });

  it("falls back to a fallback messageId when none is on the attachment", () => {
    expect(
      mapBackendAttachment({ file_type: "image" }, "fallback-msg").message_id,
    ).toBe("fallback-msg");
  });

  it("rebuilds blob and thumbnail URLs through the media-service proxy when a media_id is available", () => {
    const out = mapBackendAttachment({
      file_type: "image",
      media_id: "media-xyz",
    });
    expect(out.metadata.media_url).toBe(
      "https://api.test/media/v1/media-xyz/blob",
    );
    expect(out.metadata.thumbnail_url).toBe(
      "https://api.test/media/v1/media-xyz/thumbnail",
    );
  });
});

describe("invalidateUserInfoCache", () => {
  // The cache is module-private, so we just assert no-throw behaviour
  // across the two branches (with userId and without).
  it("is safe to call with a specific userId", () => {
    expect(() => invalidateUserInfoCache("u-1")).not.toThrow();
  });

  it("is safe to call without arguments (full clear)", () => {
    expect(() => invalidateUserInfoCache()).not.toThrow();
  });
});
