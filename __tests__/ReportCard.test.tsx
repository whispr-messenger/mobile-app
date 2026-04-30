import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../src/components/Moderation/ReportStatusBadge", () => ({
  ReportStatusBadge: ({ status }: { status: string }) => {
    const { Text } = require("react-native");
    return <Text>status:{status}</Text>;
  },
}));

import { ReportCard } from "../src/components/Moderation/ReportCard";

const baseReport = {
  id: "r1",
  reported_user_id: "abcdef0123456789",
  reporter_id: "9876543210fedcba",
  category: "offensive" as const,
  status: "pending" as const,
  created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
};

describe("ReportCard", () => {
  it.each([
    ["offensive", "Contenu offensant"],
    ["spam", "Spam"],
    ["nudity", "Nudité"],
    ["violence", "Violence"],
    ["harassment", "Harcèlement"],
    ["other", "Autre"],
  ])("maps category %s to label %s", (category, label) => {
    const { getByText } = render(
      <ReportCard
        report={{ ...baseReport, category: category as any } as any}
        onPress={() => {}}
      />,
    );
    expect(getByText(label)).toBeTruthy();
  });

  it("renders timeAgo in minutes", () => {
    const { getByText } = render(
      <ReportCard report={baseReport as any} onPress={() => {}} />,
    );
    expect(getByText("10m")).toBeTruthy();
  });

  it("renders timeAgo in hours", () => {
    const r = {
      ...baseReport,
      created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    };
    const { getByText } = render(
      <ReportCard report={r as any} onPress={() => {}} />,
    );
    expect(getByText("4h")).toBeTruthy();
  });

  it("renders timeAgo in days", () => {
    const r = {
      ...baseReport,
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const { getByText } = render(
      <ReportCard report={r as any} onPress={() => {}} />,
    );
    expect(getByText("5j")).toBeTruthy();
  });

  it("calls onPress when tapped", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ReportCard report={baseReport as any} onPress={onPress} />,
    );
    fireEvent.press(getByText("Contenu offensant"));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders the status badge", () => {
    const { getByText } = render(
      <ReportCard report={baseReport as any} onPress={() => {}} />,
    );
    expect(getByText("status:pending")).toBeTruthy();
  });
});
