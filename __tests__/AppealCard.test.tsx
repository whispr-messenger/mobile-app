import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../src/components/Moderation/SanctionBadge", () => ({
  SanctionBadge: ({ type }: { type: string }) => {
    const { Text } = require("react-native");
    return <Text>sanction:{type}</Text>;
  },
}));

import { AppealCard } from "../src/components/Moderation/AppealCard";

const baseAppeal = {
  id: "a1",
  userId: "12345678abcdef",
  type: "sanction" as const,
  createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
};

describe("AppealCard", () => {
  it("renders user id prefix and timeAgo in minutes", () => {
    const { getByText } = render(
      <AppealCard appeal={baseAppeal as any} onPress={() => {}} />,
    );
    expect(getByText("12345678...")).toBeTruthy();
    expect(getByText("5m")).toBeTruthy();
  });

  it("formats timeAgo in hours", () => {
    const appeal = {
      ...baseAppeal,
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    };
    const { getByText } = render(
      <AppealCard appeal={appeal as any} onPress={() => {}} />,
    );
    expect(getByText("3h")).toBeTruthy();
  });

  it("formats timeAgo in days", () => {
    const appeal = {
      ...baseAppeal,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const { getByText } = render(
      <AppealCard appeal={appeal as any} onPress={() => {}} />,
    );
    expect(getByText("2j")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <AppealCard appeal={baseAppeal as any} onPress={onPress} />,
    );
    fireEvent.press(getByText("12345678..."));
    expect(onPress).toHaveBeenCalled();
  });

  it("shows the SanctionBadge for non-image appeals", () => {
    const { getByText } = render(
      <AppealCard
        appeal={baseAppeal as any}
        sanctionType="temp_ban"
        onPress={() => {}}
      />,
    );
    expect(getByText("sanction:temp_ban")).toBeTruthy();
    expect(getByText("Sanction")).toBeTruthy();
  });

  it("shows Image badge and no SanctionBadge for blocked_image appeals", () => {
    const { getByText, queryByText } = render(
      <AppealCard
        appeal={{ ...baseAppeal, type: "blocked_image" } as any}
        onPress={() => {}}
      />,
    );
    expect(getByText("Image")).toBeTruthy();
    expect(queryByText(/^sanction:/)).toBeNull();
  });
});
