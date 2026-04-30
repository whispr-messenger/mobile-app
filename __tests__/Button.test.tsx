import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ActivityIndicator, TouchableOpacity, Text } from "react-native";
import { Button } from "../src/components/Button/Button";

describe("Button", () => {
  it("renders the title", () => {
    const { getByText } = render(<Button title="Continuer" onPress={() => {}} />);
    expect(getByText("Continuer")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="OK" onPress={onPress} />);
    fireEvent.press(getByText("OK"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", () => {
    const onPress = jest.fn();
    const { UNSAFE_getByType } = render(
      <Button title="X" onPress={onPress} disabled />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    expect(touchable.props.disabled).toBe(true);
  });

  it("renders an ActivityIndicator when loading", () => {
    const { UNSAFE_queryByType, queryByText } = render(
      <Button title="X" onPress={() => {}} loading />,
    );
    expect(UNSAFE_queryByType(ActivityIndicator)).not.toBeNull();
    expect(queryByText("X")).toBeNull();
  });

  it.each(["primary", "secondary", "ghost", "danger"] as const)(
    "renders the %s variant",
    (variant) => {
      const { UNSAFE_getByType } = render(
        <Button title="V" onPress={() => {}} variant={variant} />,
      );
      const touchable = UNSAFE_getByType(TouchableOpacity);
      expect(touchable.props.style).toBeTruthy();
    },
  );

  it.each(["small", "medium", "large"] as const)(
    "renders the %s size",
    (size) => {
      const { UNSAFE_getByType } = render(
        <Button title="S" onPress={() => {}} size={size} />,
      );
      const touchable = UNSAFE_getByType(TouchableOpacity);
      const flat = Array.isArray(touchable.props.style)
        ? Object.assign({}, ...touchable.props.style)
        : touchable.props.style;
      expect(typeof flat.height).toBe("number");
    },
  );

  it("applies fullWidth", () => {
    const { UNSAFE_getByType } = render(
      <Button title="W" onPress={() => {}} fullWidth />,
    );
    const flat = Object.assign({}, ...UNSAFE_getByType(TouchableOpacity).props.style);
    expect(flat.width).toBe("100%");
  });

  it("renders disabled state with each variant without crashing", () => {
    (["primary", "secondary", "ghost", "danger"] as const).forEach((v) => {
      render(<Button title="x" onPress={() => {}} variant={v} disabled />);
    });
  });

  it("merges style and textStyle props", () => {
    const { UNSAFE_getByType } = render(
      <Button
        title="t"
        onPress={() => {}}
        style={{ marginTop: 5 }}
        textStyle={{ letterSpacing: 1 }}
      />,
    );
    const touchable = UNSAFE_getByType(TouchableOpacity);
    expect(JSON.stringify(touchable.props.style)).toContain("5");
    const text = UNSAFE_getByType(Text);
    expect(JSON.stringify(text.props.style)).toContain("1");
  });
});
