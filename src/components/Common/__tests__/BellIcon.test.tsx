import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { BellIcon } from "../BellIcon";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../../theme/colors", () => ({
  colors: {
    text: { light: "#fff" },
    ui: { error: "#f00" },
  },
}));

describe("BellIcon", () => {
  it("renders without badge when unreadCount is 0", () => {
    const { queryByText } = render(
      <BellIcon unreadCount={0} onPress={jest.fn()} />,
    );
    expect(queryByText("0")).toBeNull();
  });

  it("shows badge with count when unreadCount > 0", () => {
    const { getByText } = render(
      <BellIcon unreadCount={3} onPress={jest.fn()} />,
    );
    expect(getByText("3")).toBeTruthy();
  });

  it("caps badge at 9+ when unreadCount > 9", () => {
    const { getByText } = render(
      <BellIcon unreadCount={42} onPress={jest.fn()} />,
    );
    expect(getByText("9+")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <BellIcon unreadCount={1} onPress={onPress} />,
    );
    fireEvent.press(getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
