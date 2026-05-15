/**
 * Tests for DangerConfirmModal — typed-confirm pour actions destructives
 */

import React from "react";
import { render, fireEvent } from "@testing-library/react-native";

jest.mock("./src/theme/colors", () => ({
  colors: {
    background: { dark: "#000" },
    text: { light: "#fff" },
    ui: { error: "#FF3B30", warning: "#F04882" },
  },
  withOpacity: (c: string) => c,
}));

const mockGetLocalizedText = jest.fn((key: string) => {
  const dict: Record<string, string> = {
    "confirm.typeToConfirm": "Tape {{text}} pour confirmer",
    "confirm.actionIrreversible": "Cette action est irréversible.",
    "confirm.cancel": "Annuler",
  };
  return dict[key] ?? key;
});

jest.mock("./src/context/ThemeContext", () => ({
  useTheme: () => ({
    getThemeColors: () => ({
      text: { primary: "#fff", secondary: "#aaa", tertiary: "#888" },
    }),
    getLocalizedText: mockGetLocalizedText,
  }),
}));

import { DangerConfirmModal } from "./src/components/Common/DangerConfirmModal";

const baseProps = {
  visible: true,
  title: "Supprimer ?",
  description: "Action destructive.",
  expectedText: "SUPPRIMER",
  actionLabel: "Supprimer",
  onCancel: jest.fn(),
  onConfirm: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DangerConfirmModal", () => {
  it("rend le titre et la description", () => {
    const { getByText } = render(<DangerConfirmModal {...baseProps} />);
    expect(getByText("Supprimer ?")).toBeTruthy();
    expect(getByText("Action destructive.")).toBeTruthy();
  });

  it("interpole expectedText dans le label tape-pour-confirmer", () => {
    const { getByText } = render(<DangerConfirmModal {...baseProps} />);
    expect(getByText("Tape SUPPRIMER pour confirmer")).toBeTruthy();
  });

  it("desactive le bouton confirm si l'input est vide", () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <DangerConfirmModal {...baseProps} onConfirm={onConfirm} />,
    );
    fireEvent.press(getByTestId("danger-confirm-action"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("desactive le bouton confirm si le texte ne match qu'a moitie", () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <DangerConfirmModal {...baseProps} onConfirm={onConfirm} />,
    );
    fireEvent.changeText(getByTestId("danger-confirm-input"), "SUPP");
    fireEvent.press(getByTestId("danger-confirm-action"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("active le bouton confirm sur match exact (case-insensitive par defaut)", () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <DangerConfirmModal {...baseProps} onConfirm={onConfirm} />,
    );
    fireEvent.changeText(getByTestId("danger-confirm-input"), "supprimer");
    fireEvent.press(getByTestId("danger-confirm-action"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("respecte caseInsensitive=false : 'supprimer' ne match pas 'SUPPRIMER'", () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <DangerConfirmModal
        {...baseProps}
        caseInsensitive={false}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.changeText(getByTestId("danger-confirm-input"), "supprimer");
    fireEvent.press(getByTestId("danger-confirm-action"));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.changeText(getByTestId("danger-confirm-input"), "SUPPRIMER");
    fireEvent.press(getByTestId("danger-confirm-action"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("appelle onCancel au clic sur Annuler", () => {
    const onCancel = jest.fn();
    const { getByTestId } = render(
      <DangerConfirmModal {...baseProps} onCancel={onCancel} />,
    );
    fireEvent.press(getByTestId("danger-confirm-cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("submit via Enter dans l'input quand match", () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <DangerConfirmModal {...baseProps} onConfirm={onConfirm} />,
    );
    const input = getByTestId("danger-confirm-input");
    fireEvent.changeText(input, "SUPPRIMER");
    fireEvent(input, "submitEditing");
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("loading=true : input non editable, bouton confirm bloque, spinner visible", () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const { getByTestId, queryByText } = render(
      <DangerConfirmModal
        {...baseProps}
        loading
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    const input = getByTestId("danger-confirm-input");
    expect(input.props.editable).toBe(false);

    // bouton action ne declenche pas onConfirm meme avec match
    fireEvent.changeText(input, "SUPPRIMER");
    fireEvent.press(getByTestId("danger-confirm-action"));
    expect(onConfirm).not.toHaveBeenCalled();

    // bouton cancel bloque aussi pendant loading
    fireEvent.press(getByTestId("danger-confirm-cancel"));
    expect(onCancel).not.toHaveBeenCalled();

    // le label texte est remplace par un ActivityIndicator
    expect(queryByText("Supprimer")).toBeNull();
  });

  it("snapshot stable", () => {
    const tree = render(<DangerConfirmModal {...baseProps} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
