import React from "react";
import { render } from "@testing-library/react-native";

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
  }),
}));

jest.mock("../src/components/Chat/Avatar", () => ({
  Avatar: () => null,
}));

import { TypingIndicator } from "../src/components/Chat/TypingIndicator";

describe("TypingIndicator", () => {
  it("renders generic message when no name is provided", () => {
    const { getByText } = render(<TypingIndicator />);
    expect(getByText("Quelqu'un est en train d'écrire")).toBeTruthy();
  });

  it("uses userName when provided", () => {
    const { getByText } = render(<TypingIndicator userName="Alice" />);
    expect(getByText("Alice est en train d'écrire")).toBeTruthy();
  });

  it("renders one userNames entry as singular", () => {
    const { getByText } = render(<TypingIndicator userNames={["Bob"]} />);
    expect(getByText("Bob est en train d'écrire")).toBeTruthy();
  });

  it("renders two userNames joined with 'et'", () => {
    const { getByText } = render(
      <TypingIndicator userNames={["Bob", "Alice"]} />,
    );
    expect(getByText("Bob et Alice sont en train d'écrire")).toBeTruthy();
  });

  it("collapses 3+ userNames to count", () => {
    const { getByText } = render(
      <TypingIndicator userNames={["A", "B", "C"]} />,
    );
    expect(getByText("3 personnes sont en train d'écrire")).toBeTruthy();
  });
});
