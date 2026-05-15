import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { Avatar } from "../Avatar";

jest.mock("../../../services/TokenService", () => ({
  TokenService: { getAccessToken: jest.fn().mockResolvedValue("tok") },
}));
jest.mock("../../../services/apiBase", () => ({
  getApiBaseUrl: () => "https://api.test",
}));

const mockFetchBytes = () => ({
  ok: true,
  status: 200,
  url: "",
  headers: { get: () => "application/octet-stream" },
  blob: async () =>
    new Blob([new Uint8Array([0xff, 0xd8])], { type: "image/jpeg" }),
});

beforeEach(() => {
  // Default: every fetch returns image bytes through the ?stream=1 proxy.
  // Tests that need a different behaviour override this.
  (global as unknown as { fetch: jest.Mock }).fetch = jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(mockFetchBytes() as unknown as Response),
    ) as unknown as typeof fetch;

  // useResolvedMediaUrl produces blob: URLs on web. Mock URL helpers.
  (global as any).URL.createObjectURL = jest.fn(() => "blob:fake-avatar");
  (global as any).URL.revokeObjectURL = jest.fn();

  // Force the web path so the hook uses createObjectURL (FileReader is not
  // reliably available under jest-expo's node environment).
  const Platform = require("react-native").Platform;
  Platform.OS = "web";
});

describe("Avatar", () => {
  it("renders an image when given a presigned https URL (no /media/v1 path)", () => {
    // Plain external URL — the hook leaves it untouched, so the image
    // renders synchronously and no initials should be visible.
    const url =
      "https://s3.amazonaws.com/bucket/avatar.jpg?X-Amz-Signature=abc123";
    const { queryByText } = render(<Avatar uri={url} name="John Doe" />);
    expect(queryByText("JD")).toBeNull();
  });

  it("renders initials when uri is undefined", () => {
    const { getByText } = render(<Avatar uri={undefined} name="John Doe" />);
    expect(getByText("JD")).toBeTruthy();
  });

  it("renders initials when uri is null", () => {
    const { getByText } = render(
      <Avatar uri={null as unknown as string} name="Alice" />,
    );
    expect(getByText("A")).toBeTruthy();
  });

  it("renders initials when uri is an empty string", () => {
    const { getByText } = render(<Avatar uri="" name="Bob Smith" />);
    expect(getByText("BS")).toBeTruthy();
  });

  it('renders "?" when neither name nor uri are provided', () => {
    const { getByText } = render(<Avatar />);
    expect(getByText("?")).toBeTruthy();
  });

  it("shows initials while a media-service URL is resolving and swaps to the image once resolved", async () => {
    // Bare UUID is normalised to /media/v1/<id>/blob — the hook must stream
    // it through ?stream=1 before <Image> renders. While loading, the
    // placeholder initials are visible.
    const { queryByText } = render(
      <Avatar uri="550e8400-e29b-41d4-a716-446655440000" name="Test User" />,
    );

    // Once the stream fetch resolves, the image takes over.
    await waitFor(() => {
      expect(queryByText("TU")).toBeNull();
    });
  });

  it("never hits /media/v1/<id>/blob without ?stream=1 (no 401 leak on web)", async () => {
    const fetchSpy = (global as any).fetch as jest.Mock;
    render(
      <Avatar uri="550e8400-e29b-41d4-a716-446655440000" name="Test User" />,
    );

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // No call to /blob without the stream=1 query — the bare URL would
    // trigger a 401 on web because <img> can't carry an Authorization header.
    const bareBlobCalls = fetchSpy.mock.calls.filter(
      ([u]: [string]) => u.includes("/blob") && !u.includes("stream=1"),
    );
    expect(bareBlobCalls).toHaveLength(0);

    // The actual fetch always carries the bearer token.
    const streamCall = fetchSpy.mock.calls.find(([u]: [string]) =>
      u.includes("stream=1"),
    );
    expect(streamCall).toBeDefined();
    expect(streamCall![1].headers.Authorization).toBe("Bearer tok");
  });

  it("falls back to initials when the resolved URL fetch errors out", async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      url: "",
      headers: { get: () => null },
    });

    const { findByText } = render(
      <Avatar uri="550e8400-e29b-41d4-a716-446655440000" name="Error Person" />,
    );
    // Hook surfaces error=true after retries → component shows initials.
    expect(await findByText("EP")).toBeTruthy();
  });

  it("normalises a relative /media/v1/public/<id> path through the resolver", async () => {
    const fetchSpy = (global as any).fetch as jest.Mock;
    render(
      <Avatar
        uri="/media/v1/public/550e8400-e29b-41d4-a716-446655440000"
        name="Test User"
      />,
    );
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const streamCall = fetchSpy.mock.calls.find(([u]: [string]) =>
      u.includes("stream=1"),
    );
    expect(streamCall![0]).toContain(
      "/media/v1/550e8400-e29b-41d4-a716-446655440000/blob",
    );
  });

  it("passes through a plain https URL unchanged (no resolver fetch)", () => {
    const fetchSpy = (global as any).fetch as jest.Mock;
    const url = "https://cdn.example.com/avatar.png";
    const { queryByText } = render(<Avatar uri={url} name="Test User" />);
    expect(queryByText("TU")).toBeNull();
    // No /media/v1 → no stream proxy fetch.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows online badge when showOnlineBadge and isOnline are true", () => {
    const { toJSON } = render(
      <Avatar
        uri={undefined}
        name="A"
        showOnlineBadge={true}
        isOnline={true}
      />,
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain("#21C004");
  });

  it("does not show online badge when showOnlineBadge is false", () => {
    const { toJSON } = render(
      <Avatar
        uri={undefined}
        name="A"
        showOnlineBadge={false}
        isOnline={true}
      />,
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).not.toContain("#21C004");
  });

  it("shows image again after URI changes from invalid to valid", () => {
    const { queryByText, getByText, rerender } = render(
      <Avatar uri="not-a-url" name="Test" />,
    );
    expect(getByText("T")).toBeTruthy();

    rerender(<Avatar uri="https://cdn.example.com/avatar.png" name="Test" />);
    expect(queryByText("T")).toBeNull();
  });

  it("respects custom size prop", () => {
    const { toJSON } = render(<Avatar uri={undefined} name="A" size={64} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"width":64');
    expect(tree).toContain('"height":64');
  });
});
