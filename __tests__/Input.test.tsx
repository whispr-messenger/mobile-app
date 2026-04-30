import React from "react";
import { Text } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: { secondary: "#222" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
  }),
}));

import { Input } from "../src/components/Input/Input";

describe("Input", () => {
  it("renders a label when provided", () => {
    const { getByText } = render(<Input label="Email" />);
    expect(getByText("Email")).toBeTruthy();
  });

  it("does not render label when omitted", () => {
    const { queryByText } = render(<Input placeholder="hi" />);
    expect(queryByText("Email")).toBeNull();
  });

  it("renders helperText when no error", () => {
    const { getByText } = render(<Input helperText="optional" />);
    expect(getByText("optional")).toBeTruthy();
  });

  it("renders error text and hides helper text when both provided", () => {
    const { getByText, queryByText } = render(
      <Input helperText="optional" error="required" />,
    );
    expect(getByText("required")).toBeTruthy();
    expect(queryByText("optional")).toBeNull();
  });

  it("accepts value and emits onChangeText", () => {
    const onChangeText = jest.fn();
    const { getByDisplayValue } = render(
      <Input value="abc" onChangeText={onChangeText} />,
    );
    const input = getByDisplayValue("abc");
    fireEvent.changeText(input, "abcd");
    expect(onChangeText).toHaveBeenCalledWith("abcd");
  });

  it("toggles focused styling on focus and blur", () => {
    const { getByDisplayValue } = render(<Input value="x" onChangeText={() => {}} />);
    const input = getByDisplayValue("x");
    fireEvent(input, "focus");
    fireEvent(input, "blur");
  });

  it("renders left and right icons", () => {
    const { getByText } = render(
      <Input
        leftIcon={<Text>L</Text>}
        rightIcon={<Text>R</Text>}
      />,
    );
    expect(getByText("L")).toBeTruthy();
    expect(getByText("R")).toBeTruthy();
  });
});
