import React from "react";
import { render } from "@testing-library/react-native";
import { Avatar } from "./src/components/Chat/Avatar";

describe("Avatar", () => {
  it("renders an image when given a presigned https URL", () => {
    const url =
      "https://s3.amazonaws.com/bucket/avatar.jpg?X-Amz-Signature=abc123";
    const { queryByText } = render(<Avatar uri={url} name="John Doe" />);
    expect(queryByText("JD")).toBeNull();
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
    expect(tree).not.toContain("#21C004");
  });

  it("shows image again after URI changes from invalid to valid", () => {
    const { queryByText, getByText, rerender } = render(
      <Avatar uri="not-a-url" name="Test" />,
    );
    expect(getByText("T")).toBeTruthy();

    rerender(
      <Avatar uri="https://cdn.example.com/avatar.png" name="Test" />,
    );
    expect(queryByText("T")).toBeNull();
  });

  it("respects custom size prop", () => {
    const { toJSON } = render(<Avatar uri={undefined} name="A" size={64} />);
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"width":64');
    expect(tree).toContain('"height":64');
  });
});
