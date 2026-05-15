import React from "react";
import { render } from "@testing-library/react-native";
import { ContactItem } from "./src/components/Contacts/ContactItem";
import type { Contact } from "./src/types/contact";

jest.mock("expo-blur", () => ({ BlurView: ({ children }: any) => children }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#555" },
    }),
  }),
}));
jest.mock("./src/theme/colors", () => ({
  colors: {
    primary: { main: "#6200ee" },
    ui: { error: "#f00" },
    text: { light: "#fff" },
  },
  withOpacity: (color: string) => color,
}));
jest.mock("./src/components/Chat/Avatar", () => ({
  Avatar: ({ name }: { name: string }) => {
    const { Text } = require("react-native");
    return <Text testID="avatar-name">{name}</Text>;
  },
}));
jest.mock("./src/components/Profile/ProfileTrigger", () => ({
  ProfileTrigger: ({ children }: any) => children,
}));

const baseContact: Contact = {
  id: "c1",
  user_id: "u0",
  contact_id: "u1",
  is_favorite: false,
  added_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("ContactItem - chaine de fallback displayName", () => {
  it("affiche le nickname quand present", () => {
    const contact: Contact = {
      ...baseContact,
      nickname: "Toto",
      contact_user: {
        id: "u1",
        username: "alice",
        first_name: "Alice",
        is_active: true,
      },
    };
    const { getAllByText } = render(<ContactItem contact={contact} />);
    expect(getAllByText("Toto").length).toBeGreaterThan(0);
  });

  it("affiche first_name quand nickname absent", () => {
    const contact: Contact = {
      ...baseContact,
      contact_user: {
        id: "u1",
        username: "alice",
        first_name: "Alice",
        is_active: true,
      },
    };
    const { getAllByText } = render(<ContactItem contact={contact} />);
    expect(getAllByText("Alice").length).toBeGreaterThan(0);
  });

  it("affiche @username quand first_name null", () => {
    const contact: Contact = {
      ...baseContact,
      contact_user: {
        id: "u1",
        username: "bob_whispr",
        first_name: undefined,
        is_active: true,
      },
    };
    const { getAllByText } = render(<ContactItem contact={contact} />);
    expect(getAllByText("bob_whispr").length).toBeGreaterThan(0);
  });

  it("affiche phone_number_masked quand first_name + username null", () => {
    const contact: Contact = {
      ...baseContact,
      contact_user: {
        id: "u1",
        username: "",
        first_name: undefined,
        phone_number_masked: "+33***1234",
        is_active: true,
      },
    };
    const { getAllByText } = render(<ContactItem contact={contact} />);
    expect(getAllByText("+33***1234").length).toBeGreaterThan(0);
  });

  it("affiche 'Contact' uniquement si tout null", () => {
    const contact: Contact = {
      ...baseContact,
      contact_user: {
        id: "u1",
        username: "",
        first_name: undefined,
        phone_number_masked: undefined,
        is_active: true,
      },
    };
    const { getAllByText } = render(<ContactItem contact={contact} />);
    expect(getAllByText("Contact").length).toBeGreaterThan(0);
  });

  it("passe le displayName resolu a Avatar (pas 'C' hardcode)", () => {
    const contact: Contact = {
      ...baseContact,
      contact_user: {
        id: "u1",
        username: "",
        first_name: undefined,
        phone_number_masked: "+33***1234",
        is_active: true,
      },
    };
    const { getByTestId } = render(<ContactItem contact={contact} />);
    // Avatar recoit le nom resolu, pas "Contact" ni "C"
    expect(getByTestId("avatar-name").props.children).toBe("+33***1234");
  });

  it("passe 'Contact' a Avatar quand tout null", () => {
    const contact: Contact = {
      ...baseContact,
      contact_user: {
        id: "u1",
        username: "",
        first_name: undefined,
        is_active: true,
      },
    };
    const { getByTestId } = render(<ContactItem contact={contact} />);
    expect(getByTestId("avatar-name").props.children).toBe("Contact");
  });

  it("affiche phone_number_masked en subtitle quand username vide", () => {
    const contact: Contact = {
      ...baseContact,
      contact_user: {
        id: "u1",
        username: "",
        first_name: "Alice",
        phone_number_masked: "+33***5678",
        is_active: true,
      },
    };
    const { getAllByText } = render(<ContactItem contact={contact} />);
    // phone_number_masked apparait en subtitle
    expect(getAllByText("+33***5678").length).toBeGreaterThan(0);
  });
});
