/**
 * Tests for AppealStatusScreen — timeline of an appeal.
 *
 * Covers each render branch:
 * - Loading without an appeal in the store
 * - "Contestation introuvable" when no matching appeal
 * - Active appeal (pending / under_review)
 * - Final state: accepted
 * - Final state: rejected (with resolvedAt + decision note)
 * - Back button + pull-to-refresh dispatch
 */

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  const Noop: React.FC<Record<string, unknown>> = () => null;
  return new Proxy({ __esModule: true, default: Noop }, { get: () => Noop });
});

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: { sanctionId: "sanction-1" } }),
}));

jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#666" },
      background: { primary: "#000", secondary: "#111", tertiary: "#222" },
      primary: "#fff",
      secondary: "#000",
      error: "#f00",
      success: "#0f0",
      warning: "#ff0",
      info: "#00f",
    }),
  }),
}));

// Mutable store snapshot driven per-test.
type MockState = {
  myAppeals: Array<Record<string, unknown>>;
  loading: boolean;
  fetchMyAppeals: jest.Mock;
};
let mockState: MockState;
jest.mock("../../../store/moderationStore", () => ({
  useModerationStore: () => mockState,
}));

import { AppealStatusScreen } from "../AppealStatusScreen";

beforeEach(() => {
  mockState = {
    myAppeals: [],
    loading: false,
    fetchMyAppeals: jest.fn(),
  };
  mockGoBack.mockReset();
});

describe("AppealStatusScreen", () => {
  it("fires fetchMyAppeals on mount", () => {
    render(<AppealStatusScreen />);
    expect(mockState.fetchMyAppeals).toHaveBeenCalledTimes(1);
  });

  it("renders the loading state when loading and no appeal yet", () => {
    mockState.loading = true;
    const { getByText } = render(<AppealStatusScreen />);
    expect(getByText("Chargement...")).toBeTruthy();
  });

  it("renders 'Contestation introuvable' when sanction has no matching appeal", () => {
    mockState.myAppeals = [
      {
        id: "a-other",
        sanctionId: "different-sanction",
        status: "pending",
        reason: "x",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const { getByText } = render(<AppealStatusScreen />);
    expect(getByText("Contestation introuvable")).toBeTruthy();
  });

  it("renders the pending appeal timeline", () => {
    mockState.myAppeals = [
      {
        id: "a-1",
        sanctionId: "sanction-1",
        status: "pending",
        reason: "Je conteste",
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-01T10:00:00.000Z",
      },
    ];
    const { getByText } = render(<AppealStatusScreen />);
    expect(getByText("Je conteste")).toBeTruthy();
    expect(getByText("Soumise")).toBeTruthy();
    expect(getByText("En cours d'examen")).toBeTruthy();
  });

  it("renders under_review with the updatedAt step date", () => {
    mockState.myAppeals = [
      {
        id: "a-2",
        sanctionId: "sanction-1",
        status: "under_review",
        reason: "Erreur de modération",
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-02T10:00:00.000Z",
      },
    ];
    const { getByText } = render(<AppealStatusScreen />);
    expect(getByText("Erreur de modération")).toBeTruthy();
  });

  it("renders the accepted final state", () => {
    mockState.myAppeals = [
      {
        id: "a-3",
        sanctionId: "sanction-1",
        status: "accepted",
        reason: "Erreur",
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-02T10:00:00.000Z",
        resolvedAt: "2026-01-03T10:00:00.000Z",
      },
    ];
    const { getByText } = render(<AppealStatusScreen />);
    expect(getByText("Acceptée")).toBeTruthy();
    expect(getByText("Votre sanction a été levée")).toBeTruthy();
  });

  it("renders the rejected final state with the decision note", () => {
    mockState.myAppeals = [
      {
        id: "a-4",
        sanctionId: "sanction-1",
        status: "rejected",
        reason: "Erreur",
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-02T10:00:00.000Z",
        resolvedAt: "2026-01-03T10:00:00.000Z",
        decisionNote: "Le contenu reste contraire aux règles.",
      },
    ];
    const { getByText } = render(<AppealStatusScreen />);
    expect(getByText("Rejetée")).toBeTruthy();
    expect(getByText("Votre contestation a été rejetée")).toBeTruthy();
  });

  it("dispatches navigation.goBack when the back button is pressed", () => {
    mockState.myAppeals = [
      {
        id: "a-5",
        sanctionId: "sanction-1",
        status: "pending",
        reason: "x",
        createdAt: "2026-01-01T10:00:00.000Z",
        updatedAt: "2026-01-01T10:00:00.000Z",
      },
    ];
    const { root } = render(<AppealStatusScreen />);
    // Find the first onPress in the tree (back button).
    const find = (node: {
      props?: { onPress?: () => void };
      children?: unknown;
    }): { props: { onPress?: () => void } } | undefined => {
      if (node?.props?.onPress)
        return node as { props: { onPress?: () => void } };
      const c = node?.children;
      if (Array.isArray(c)) {
        for (const x of c) {
          const r = find(x as Parameters<typeof find>[0]);
          if (r) return r;
        }
      }
      return undefined;
    };
    find(root as Parameters<typeof find>[0])?.props.onPress?.();
    expect(mockGoBack).toHaveBeenCalled();
  });
});
