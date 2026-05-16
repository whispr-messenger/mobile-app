import React from "react";
import { Text } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { ProfileTrigger } from "../ProfileTrigger";
import { useMiniProfileCardStore } from "../../../store/miniProfileCardStore";

beforeEach(() => {
  useMiniProfileCardStore.getState().close();
  const Platform = require("react-native").Platform;
  Platform.OS = "ios";
});

describe("ProfileTrigger", () => {
  it("opens the mini-card on long press (touch)", () => {
    const { getByText } = render(
      <ProfileTrigger userId="u1">
        <Text>avatar</Text>
      </ProfileTrigger>,
    );
    fireEvent(getByText("avatar"), "longPress");
    const s = useMiniProfileCardStore.getState();
    expect(s.isOpen).toBe(true);
    expect(s.userId).toBe("u1");
  });

  it("ignores a short press on touch (no card opened)", () => {
    const { getByText } = render(
      <ProfileTrigger userId="u1">
        <Text>avatar</Text>
      </ProfileTrigger>,
    );
    fireEvent.press(getByText("avatar"));
    expect(useMiniProfileCardStore.getState().isOpen).toBe(false);
  });
});
