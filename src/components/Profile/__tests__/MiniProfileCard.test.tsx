import React from "react";
import { render, waitFor, act, fireEvent } from "@testing-library/react-native";
import { MiniProfileCard } from "../MiniProfileCard";
import { clearCache } from "../../../services/profile/miniProfileCache";
import { clearRelationCache } from "../../../services/profile/miniRelationCache";

const mockGetUserProfile = jest.fn();
jest.mock("../../../services/UserService", () => ({
  UserService: {
    getInstance: () => ({
      getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
    }),
  },
}));

const mockGetBlockedUsers = jest.fn();
const mockGetContacts = jest.fn();
const mockBlockUser = jest.fn();
const mockUnblockUser = jest.fn();
jest.mock("../../../services/contacts/api", () => ({
  contactsAPI: {
    getBlockedUsers: () => mockGetBlockedUsers(),
    getContacts: () => mockGetContacts(),
    blockUser: (id: string) => mockBlockUser(id),
    unblockUser: (id: string) => mockUnblockUser(id),
  },
}));

const buildProfile = (overrides = {}) => ({
  id: "u1",
  firstName: "Alice",
  lastName: "Doe",
  username: "alice",
  phoneNumber: "",
  biography: "Bio courte",
  isOnline: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

beforeEach(() => {
  clearCache();
  clearRelationCache();
  mockGetUserProfile.mockReset();
  mockGetBlockedUsers.mockReset().mockResolvedValue({ blocked: [], total: 0 });
  mockGetContacts.mockReset().mockResolvedValue({ contacts: [], total: 0 });
  mockBlockUser.mockReset().mockResolvedValue(undefined);
  mockUnblockUser.mockReset().mockResolvedValue(undefined);
});

describe("MiniProfileCard", () => {
  it("renders the loading state initially", () => {
    mockGetUserProfile.mockReturnValue(new Promise(() => {})); // never resolves
    const { getByTestId } = render(
      <MiniProfileCard
        userId="u1"
        currentUserId="me"
        onClose={() => {}}
        onOpenFullProfile={() => {}}
        onOpenSelfProfile={() => {}}
        onMessage={() => {}}
      />,
    );
    expect(getByTestId("mini-profile-card-loading")).toBeTruthy();
  });

  it("renders the loaded state with profile data", async () => {
    mockGetUserProfile.mockResolvedValue({
      success: true,
      profile: buildProfile(),
    });
    const { getByText, getByTestId } = render(
      <MiniProfileCard
        userId="u1"
        currentUserId="me"
        onClose={() => {}}
        onOpenFullProfile={() => {}}
        onOpenSelfProfile={() => {}}
        onMessage={() => {}}
      />,
    );
    await waitFor(() => {
      expect(getByTestId("mini-profile-card-loaded")).toBeTruthy();
    });
    expect(getByText("Alice Doe")).toBeTruthy();
    expect(getByText("@alice")).toBeTruthy();
    expect(getByText("Bio courte")).toBeTruthy();
  });

  it("renders the error state with retry button on network failure", async () => {
    mockGetUserProfile.mockRejectedValue(new Error("network down"));
    const { getByTestId, getByText } = render(
      <MiniProfileCard
        userId="u1"
        currentUserId="me"
        onClose={() => {}}
        onOpenFullProfile={() => {}}
        onOpenSelfProfile={() => {}}
        onMessage={() => {}}
      />,
    );
    await waitFor(() => {
      expect(getByTestId("mini-profile-card-error")).toBeTruthy();
    });
    expect(getByText("Reessayer")).toBeTruthy();
  });

  it("renders the blocked badge when the user is in the blocked list", async () => {
    mockGetUserProfile.mockResolvedValue({
      success: true,
      profile: buildProfile(),
    });
    mockGetBlockedUsers.mockResolvedValue({
      blocked: [
        {
          id: "b1",
          user_id: "me",
          blocked_user_id: "u1",
          blocked_at: "",
        },
      ],
      total: 1,
    });
    const { getByTestId } = render(
      <MiniProfileCard
        userId="u1"
        currentUserId="me"
        onClose={() => {}}
        onOpenFullProfile={() => {}}
        onOpenSelfProfile={() => {}}
        onMessage={() => {}}
      />,
    );
    await waitFor(() => {
      expect(getByTestId("mini-profile-card-blocked")).toBeTruthy();
    });
  });

  it("renders the notFound state on a 404 response", async () => {
    mockGetUserProfile.mockResolvedValue({
      success: false,
      message: "Erreur 404",
    });
    const { getByTestId, getByText } = render(
      <MiniProfileCard
        userId="u1"
        currentUserId="me"
        onClose={() => {}}
        onOpenFullProfile={() => {}}
        onOpenSelfProfile={() => {}}
        onMessage={() => {}}
      />,
    );
    await waitFor(() => {
      expect(getByTestId("mini-profile-card-notfound")).toBeTruthy();
    });
    expect(getByText("Compte supprime")).toBeTruthy();
  });

  it("triggers onMessage when the user taps Message", async () => {
    mockGetUserProfile.mockResolvedValue({
      success: true,
      profile: buildProfile(),
    });
    const onMessage = jest.fn();
    const { getByText } = render(
      <MiniProfileCard
        userId="u1"
        currentUserId="me"
        onClose={() => {}}
        onOpenFullProfile={() => {}}
        onOpenSelfProfile={() => {}}
        onMessage={onMessage}
      />,
    );
    await waitFor(() => getByText("Message"));
    await act(async () => {
      fireEvent.press(getByText("Message"));
    });
    expect(onMessage).toHaveBeenCalled();
  });

  it("renders the stale banner when refresh fails but cache exists", async () => {
    const realNow = Date.now;
    Date.now = jest.fn(() => 1_000_000_000_000);

    // 1er fetch reussi -> remplit le cache
    mockGetUserProfile.mockResolvedValueOnce({
      success: true,
      profile: buildProfile(),
    });
    const first = render(
      <MiniProfileCard
        userId="u1"
        currentUserId="me"
        onClose={() => {}}
        onOpenFullProfile={() => {}}
        onOpenSelfProfile={() => {}}
        onMessage={() => {}}
      />,
    );
    await waitFor(() => first.getByTestId("mini-profile-card-loaded"));
    first.unmount();

    // avance le temps de 6 minutes : le cache devient stale
    Date.now = jest.fn(() => 1_000_000_000_000 + 6 * 60 * 1000);

    // 2eme rendu : cache hit stale + refresh echoue -> banner stale visible
    mockGetUserProfile.mockRejectedValueOnce(new Error("network down"));
    const view = render(
      <MiniProfileCard
        userId="u1"
        currentUserId="me"
        onClose={() => {}}
        onOpenFullProfile={() => {}}
        onOpenSelfProfile={() => {}}
        onMessage={() => {}}
      />,
    );
    await waitFor(() => view.getByTestId("mini-profile-card-stale"));
    expect(view.getByText("Donnees possiblement obsoletes")).toBeTruthy();
    expect(view.getByText("Reessayer")).toBeTruthy();
    Date.now = realNow;
  });

  it("hides the last seen line when backend returns no value", async () => {
    mockGetUserProfile.mockResolvedValue({
      success: true,
      profile: buildProfile({ isOnline: false, lastSeen: undefined }),
    });
    const { queryByText, getByTestId } = render(
      <MiniProfileCard
        userId="u1"
        currentUserId="me"
        onClose={() => {}}
        onOpenFullProfile={() => {}}
        onOpenSelfProfile={() => {}}
        onMessage={() => {}}
      />,
    );
    await waitFor(() => getByTestId("mini-profile-card-loaded"));
    expect(queryByText("en ligne")).toBeNull();
    expect(queryByText(/vu /)).toBeNull();
  });

  it("does not warn when unmounted before fetch resolves", async () => {
    let resolveProfile: (v: unknown) => void = () => {};
    mockGetUserProfile.mockReturnValue(
      new Promise((res) => {
        resolveProfile = res;
      }),
    );
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(
      <MiniProfileCard
        userId="u1"
        currentUserId="me"
        onClose={() => {}}
        onOpenFullProfile={() => {}}
        onOpenSelfProfile={() => {}}
        onMessage={() => {}}
      />,
    );
    unmount();
    await act(async () => {
      resolveProfile({ success: true, profile: buildProfile() });
      await Promise.resolve();
    });
    const calls = errorSpy.mock.calls.map((c) => String(c[0]));
    expect(
      calls.some((m) => m.includes("unmounted") || m.includes("memory leak")),
    ).toBe(false);
    errorSpy.mockRestore();
  });
});
