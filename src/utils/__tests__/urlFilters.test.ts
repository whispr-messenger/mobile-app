import { isHttpUrl, isReachableUrl } from "../urlFilters";

describe("isReachableUrl", () => {
  it("returns false for undefined", () => {
    expect(isReachableUrl(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isReachableUrl(null)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isReachableUrl("")).toBe(false);
  });

  it("returns false for non-string input", () => {
    expect(isReachableUrl(42 as unknown as string)).toBe(false);
  });

  it("returns true for a public https URL", () => {
    expect(isReachableUrl("https://cdn.example.com/avatar.png")).toBe(true);
  });

  it("rejects any URL containing the kubernetes cluster suffix", () => {
    expect(
      isReachableUrl("http://api.default.svc.cluster.local:8080/health"),
    ).toBe(false);
  });

  it("rejects URLs pointing at the internal minio hostname", () => {
    expect(isReachableUrl("http://minio.minio:9000/bucket/key")).toBe(false);
  });

  it("rejects raw http minio URLs", () => {
    expect(isReachableUrl("http://minio:9000/bucket")).toBe(false);
  });

  it("rejects raw http URLs pointing at an IP:port", () => {
    expect(isReachableUrl("http://192.168.1.10:9000/file")).toBe(false);
  });

  it("matches the minio regex case-insensitively", () => {
    expect(isReachableUrl("HTTP://MINIO:9000/x")).toBe(false);
  });

  it("accepts https URLs even if the host is an IP", () => {
    expect(isReachableUrl("https://10.0.0.1/x")).toBe(true);
  });

  it("accepts http URLs that do not match the blocked patterns", () => {
    expect(isReachableUrl("http://cdn.example.com/avatar.png")).toBe(true);
  });
});

describe("isHttpUrl", () => {
  it("accepts https URLs", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
  });

  it("accepts http URLs", () => {
    expect(isHttpUrl("http://example.com")).toBe(true);
  });

  it("rejects javascript: scheme", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects intent: scheme used by Android attacks", () => {
    expect(isHttpUrl("intent://example#Intent;scheme=http;end")).toBe(false);
  });

  it("rejects file: scheme", () => {
    expect(isHttpUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects data: scheme", () => {
    expect(isHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isHttpUrl("not a url")).toBe(false);
  });

  it("rejects null and undefined", () => {
    expect(isHttpUrl(null)).toBe(false);
    expect(isHttpUrl(undefined)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isHttpUrl("")).toBe(false);
  });
});
