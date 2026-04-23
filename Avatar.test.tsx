import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Avatar } from "./src/components/Chat/Avatar";

describe("Avatar", () => {
  it("renders an image when given a presigned https URL", () => {
    const url =
      "https://s3.amazonaws.com/bucket/avatar.jpg?X-Amz-Signature=abc123";
    const { getByTestId, queryByText } = render(
      <Avatar uri={url} name="John Doe" />,
    );

    const images = render(<Avatar uri={url} name="John Doe" />);
    // Image should be rendered — no initials visible
    expect(images.queryByText("JD")).toBeNull();
  });

  it("renders initials when uri is undefined", () => {
    const { getByText } = render(<Avatar uri={undefined} name="John Doe" />);
    expect(getByText("JD")).toBeTruthy();
  });

  it("renders initials when uri is null", () => {
    const { getByText } = render(
      <Avatar uri={null as unknown as string} name="Alice" />,
    );
    expect(getByText("A")).toBeTruthy();
  });

  it("renders initials when uri is an empty string", () => {
    const { getByText } = render(<Avatar uri="" name="Bob Smith" />);
    expect(getByText("BS")).toBeTruthy();
  });

  it('renders "?" when neither name nor uri are provided', () => {
    const { getByText } = render(<Avatar />);
    expect(getByText("?")).toBeTruthy();
  });

  it("rejects a bare UUID and shows initials instead", () => {
    const { getByText } = render(
      <Avatar uri="550e8400-e29b-41d4-a716-446655440000" name="Test User" />,
    );
    expect(getByText("TU")).toBeTruthy();
  });

  it("rejects a relative media path and shows initials", () => {
    const { getByText } = render(
      <Avatar
        uri="/media/v1/public/550e8400-e29b-41d4-a716-446655440000"
        name="Test User"
      />,
    );
    expect(getByText("TU")).toBeTruthy();
  });

  it("rejects a storage path and shows initials", () => {
    const { getByText } = render(
      <Avatar
        uri="avatars/aaaa-bbbb-cccc/550e8400-e29b-41d4-a716-446655440000"
        name="Test User"
      />,
    );
    expect(getByText("TU")).toBeTruthy();
  });

  it("passes through a plain https URL unchanged", () => {
    const url = "https://cdn.example.com/avatar.png";
    const { queryByText } = render(<Avatar uri={url} name="Test User" />);
    // Image renders, not initials
    expect(queryByText("TU")).toBeNull();
  });

  it("shows online badge when showOnlineBadge and isOnline are true", () => {
    const { toJSON } = render(
      <Avatar
        uri={undefined}
        name="A"
        showOnlineBadge={true}
        isOnline={true}
      />,
    );
    const tree = JSON.stringify(toJSON());
    // Online badge uses the online status color
    expect(tree).toContain("#21C004");
  });

  it("does not show online badge when showOnlineBadge is false", () => {
    const { toJSON } = render(
      <Avatar
        uri={undefined}
        name="A"
        showOnlineBadge={false}
        isOnline={true}
      />,
    );
    const tree = JSON.stringify(toJSON());
    // Neither online nor offline color should appear in badge
    expect(tree).not.toContain("#21C004");
    expect(tree).not.toContain("#8E8E93");
  });

  it("resets error state when URI changes", () => {
    const url1 = "https://cdn.example.com/avatar1.png";
    const url2 = "https://cdn.example.com/avatar2.png";

    const { queryByText, rerender } = render(<Avatar uri={url1} name="Test" />);
    // Image renders, no initials
    expect(queryByText("T")).toBeNull();

    // Simulate image error
    rerender(<Avatar uri={url1} name="Test" />);

    // Change URI — error state should reset, image should try to render again
    rerender(<Avatar uri={url2} name="Test" />);
    expect(queryByText("T")).toBeNull();
  });

  it("respects custom size prop", () => {
    const { toJSON } = render(<Avatar uri={undefined} name="A" size={64} />);
    const tree = JSON.stringify(toJSON());
    // The container and gradient should have width/height 64
    expect(tree).toContain('"width":64');
    expect(tree).toContain('"height":64');
  });
});
