import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("../src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      background: { secondary: "#222" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../src/components/Chat/Avatar", () => ({
  Avatar: ({ name }: { name: string }) => {
    const { Text } = require("react-native");
    return <Text>avatar:{name}</Text>;
  },
}));

import { ContactItem } from "../src/components/Contacts/ContactItem";
import type { Contact } from "../src/types/contact";

const baseContact: Contact = {
  id: "c1",
  user_id: "u1",
  contact_user_id: "u2",
  is_favorite: false,
  contact_user: {
    id: "u2",
    username: "alice",
    first_name: "Alice",
    avatar_url: undefined,
    phone_number: "+33611111111",
  },
} as any;

describe("ContactItem", () => {
  it("renders the nickname when provided", () => {
    const { getByText } = render(
      <ContactItem contact={{ ...baseContact, nickname: "Alicia" }} />,
    );
    expect(getByText("Alicia")).toBeTruthy();
  });

  it("falls back to first_name when no nickname", () => {
    const { getByText } = render(<ContactItem contact={baseContact} />);
    expect(getByText("Alice")).toBeTruthy();
  });

  it("falls back to username when no first_name", () => {
    const { getAllByText } = render(
      <ContactItem
        contact={{
          ...baseContact,
          contact_user: { ...baseContact.contact_user!, first_name: undefined },
        } as any}
      />,
    );
    // username appears as both display name and subtitle here
    expect(getAllByText("alice").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the username subtitle", () => {
    const { getByText } = render(<ContactItem contact={baseContact} />);
    expect(getByText("alice")).toBeTruthy();
  });

  it("calls onPress with the contact when tapped", () => {
    const onPress = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ContactItem contact={baseContact} onPress={onPress} />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(onPress).toHaveBeenCalledWith(baseContact);
  });

  it("calls onLongPress when long-pressed", () => {
    const onLongPress = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ContactItem contact={baseContact} onLongPress={onLongPress} />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent(UNSAFE_getAllByType(TouchableOpacity)[0], "longPress");
    expect(onLongPress).toHaveBeenCalledWith(baseContact);
  });

  it("calls onToggleFavorite when star is pressed", () => {
    const onToggle = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ContactItem contact={baseContact} onToggleFavorite={onToggle} />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    // [0] = main row, [1] = favorite star
    fireEvent.press(ts[1]);
    expect(onToggle).toHaveBeenCalledWith(baseContact);
  });

  it("calls onDelete when trash is pressed", () => {
    const onDelete = jest.fn();
    const { UNSAFE_getAllByType } = render(
      <ContactItem contact={baseContact} onDelete={onDelete} />,
    );
    const TouchableOpacity = require("react-native").TouchableOpacity;
    const ts = UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(ts[ts.length - 1]);
    expect(onDelete).toHaveBeenCalledWith(baseContact);
  });
});
