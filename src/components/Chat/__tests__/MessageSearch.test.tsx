/**
 * Tests for MessageSearch — search bar modal with prev/next navigation.
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

jest.mock("../../../context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: {
        primary: "#fff",
        secondary: "#aaa",
        tertiary: "#666",
      },
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

import { MessageSearch } from "../MessageSearch";

function collectTouchables(root: {
  props?: { onPress?: () => void };
  children?: unknown;
}): Array<{ props: { onPress?: () => void } }> {
  const out: Array<{ props: { onPress?: () => void } }> = [];
  const visit = (node: {
    props?: { onPress?: () => void };
    children?: unknown;
  }) => {
    if (node && node.props && typeof node.props.onPress === "function") {
      out.push(node as { props: { onPress?: () => void } });
    }
    const c = node?.children;
    if (Array.isArray(c)) {
      for (const x of c) {
        if (x && typeof x === "object") visit(x as Parameters<typeof visit>[0]);
      }
    } else if (c && typeof c === "object") {
      visit(c as Parameters<typeof visit>[0]);
    }
  };
  visit(root);
  return out;
}

describe("MessageSearch", () => {
  it("returns null when visible=false", () => {
    const { toJSON } = render(
      <MessageSearch
        visible={false}
        onClose={jest.fn()}
        onSearch={jest.fn()}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders the search modal when visible", () => {
    const { getByPlaceholderText } = render(
      <MessageSearch
        visible
        onClose={jest.fn()}
        onSearch={jest.fn()}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    expect(getByPlaceholderText("Rechercher dans les messages")).toBeTruthy();
  });

  it("invokes onSearch on each keystroke", () => {
    const onSearch = jest.fn();
    const { getByPlaceholderText } = render(
      <MessageSearch
        visible
        onClose={jest.fn()}
        onSearch={onSearch}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    fireEvent.changeText(
      getByPlaceholderText("Rechercher dans les messages"),
      "hello",
    );
    expect(onSearch).toHaveBeenCalledWith("hello");
  });

  it("clear button resets the query and calls onSearch('')", () => {
    const onSearch = jest.fn();
    const { getByPlaceholderText, root } = render(
      <MessageSearch
        visible
        onClose={jest.fn()}
        onSearch={onSearch}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    const input = getByPlaceholderText("Rechercher dans les messages");
    fireEvent.changeText(input, "hello");
    onSearch.mockClear();

    // Fire onPress on every touchable; the clear button is the one whose
    // onPress sets the query back to "".
    const touchables = collectTouchables(root);
    for (const t of touchables) {
      t.props.onPress?.();
    }
    expect(onSearch).toHaveBeenCalledWith("");
  });

  it("shows 'Aucun résultat trouvé' when query is set but resultsCount is 0", () => {
    const { getByPlaceholderText, getByText } = render(
      <MessageSearch
        visible
        onClose={jest.fn()}
        onSearch={jest.fn()}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    fireEvent.changeText(
      getByPlaceholderText("Rechercher dans les messages"),
      "x",
    );
    expect(getByText("Aucun résultat trouvé")).toBeTruthy();
  });

  it("shows '1 / N' counter and renders prev/next nav when results exist", () => {
    const { getByText } = render(
      <MessageSearch
        visible
        onClose={jest.fn()}
        onSearch={jest.fn()}
        resultsCount={3}
        currentIndex={0}
        onPrevious={jest.fn()}
        onNext={jest.fn()}
      />,
    );
    expect(getByText("1 / 3")).toBeTruthy();
  });

  it("invokes onNext / onPrevious when nav buttons are pressed", () => {
    const onNext = jest.fn();
    const onPrevious = jest.fn();
    const { root } = render(
      <MessageSearch
        visible
        onClose={jest.fn()}
        onSearch={jest.fn()}
        resultsCount={3}
        currentIndex={1}
        onPrevious={onPrevious}
        onNext={onNext}
      />,
    );
    for (const t of collectTouchables(root)) {
      t.props.onPress?.();
    }
    expect(onPrevious).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
  });

  it("invokes onClose when the close button is pressed", () => {
    const onClose = jest.fn();
    const { root } = render(
      <MessageSearch
        visible
        onClose={onClose}
        onSearch={jest.fn()}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    for (const t of collectTouchables(root)) {
      t.props.onPress?.();
    }
    expect(onClose).toHaveBeenCalled();
  });

  it("resets the query when visible flips back from false to true", () => {
    const onSearch = jest.fn();
    const { rerender, getByPlaceholderText } = render(
      <MessageSearch
        visible
        onClose={jest.fn()}
        onSearch={onSearch}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    fireEvent.changeText(
      getByPlaceholderText("Rechercher dans les messages"),
      "hello",
    );
    // Close, then reopen.
    rerender(
      <MessageSearch
        visible={false}
        onClose={jest.fn()}
        onSearch={onSearch}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    rerender(
      <MessageSearch
        visible
        onClose={jest.fn()}
        onSearch={onSearch}
        resultsCount={0}
        currentIndex={0}
      />,
    );
    const input = getByPlaceholderText("Rechercher dans les messages");
    expect(input.props.value).toBe("");
  });
});
