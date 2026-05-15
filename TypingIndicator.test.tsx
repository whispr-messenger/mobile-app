import React from "react";
import { render } from "@testing-library/react-native";
import { TypingIndicator } from "./src/components/Chat/TypingIndicator";

// Avatar fait du fetch / token. On le neutralise ici pour rester sur l'unite.
jest.mock("./src/components/Chat/Avatar", () => ({
  Avatar: () => null,
}));

jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      primary: "#fff",
      background: { primary: "#000", secondary: "#111" },
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#555" },
    }),
    getFontSize: () => 16,
    getLocalizedText: (k: string) => k,
  }),
}));

describe("TypingIndicator", () => {
  it("affiche le nom de l'utilisateur en train d'ecrire", () => {
    const { getByText } = render(<TypingIndicator userName="Alice" />);
    expect(getByText("Alice est en train d'écrire")).toBeTruthy();
  });

  it("affiche le nom via userNames (cas normal 1:1)", () => {
    const { getByText } = render(<TypingIndicator userNames={["Alice"]} />);
    expect(getByText("Alice est en train d'écrire")).toBeTruthy();
  });

  it("gere plusieurs utilisateurs", () => {
    const { getByText } = render(
      <TypingIndicator userNames={["Alice", "Bob"]} />,
    );
    expect(getByText("Alice et Bob sont en train d'écrire")).toBeTruthy();
  });

  it("affiche le fallback quand le nom n'est pas encore resolu", () => {
    // Simule le cas ou le nom arrive en asynchrone : userNames vide → "Quelqu'un"
    const { getByText } = render(<TypingIndicator userNames={[]} />);
    expect(getByText("Quelqu'un est en train d'écrire")).toBeTruthy();
  });

  it("prefere le nom du contact sur le fallback getUserInfo", () => {
    // Quand le nom vient directement de conversationMembers (synchrone),
    // le composant l'affiche immediatement sans attendre le reseau.
    const { getByText } = render(<TypingIndicator userNames={["Marie"]} />);
    expect(getByText("Marie est en train d'écrire")).toBeTruthy();
  });

  it("monte et demonte plusieurs fois sans warning console", () => {
    // Important : verifie que le cleanup useEffect (clearTimeout +
    // cancelAnimation) n'emet pas de warning Reanimated quand le composant
    // monte/demonte rapidement (ex: indicateur de frappe qui apparait/disparait
    // dans ConversationsListScreen + ChatScreen).
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    for (let i = 0; i < 5; i++) {
      const { unmount } = render(<TypingIndicator userName={`U${i}`} />);
      unmount();
    }

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
