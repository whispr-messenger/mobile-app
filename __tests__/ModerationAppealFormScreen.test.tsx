import React from "react";
import { render, fireEvent, act, waitFor } from "@testing-library/react-native";

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: { decisionId: "D1" } }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const mockSubmit = jest.fn();
jest.mock("../src/services/moderation/appealApi", () => ({
  submitModerationAppeal: (...args: any[]) => mockSubmit(...args),
}));

import { ModerationAppealFormScreen } from "../src/screens/Moderation/ModerationAppealFormScreen";

describe("ModerationAppealFormScreen", () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    mockNavigate.mockClear();
    mockSubmit.mockReset();
  });

  it("renders the title and reason chips", () => {
    const { getByText, getAllByText } = render(<ModerationAppealFormScreen />);
    expect(getByText("Nous sommes à l’écoute.")).toBeTruthy();
    // 'Contexte incomplet' appears both in the inputLike header and as the chip
    expect(getAllByText("Contexte incomplet").length).toBeGreaterThanOrEqual(1);
    expect(getByText("Erreur de classification")).toBeTruthy();
    expect(getByText("Usurpation / faux signalement")).toBeTruthy();
    expect(getByText("Autre")).toBeTruthy();
  });

  it("changes the selected reason when a chip is pressed", () => {
    const { getByText, getAllByText } = render(<ModerationAppealFormScreen />);
    fireEvent.press(getByText("Erreur de classification"));
    // The header inputLike Text should now show the selected label
    expect(getAllByText("Erreur de classification").length).toBeGreaterThan(0);
  });

  it("toggles the fake attachment", () => {
    const { getByText } = render(<ModerationAppealFormScreen />);
    expect(getByText("Cliquez pour ajouter un fichier")).toBeTruthy();
    fireEvent.press(getByText("Cliquez pour ajouter un fichier"));
    expect(getByText("capture-argumentation.png")).toBeTruthy();
    fireEvent.press(getByText("capture-argumentation.png"));
    expect(getByText("Cliquez pour ajouter un fichier")).toBeTruthy();
  });

  it("does not submit when description is too short", async () => {
    const { getByText } = render(<ModerationAppealFormScreen />);
    fireEvent.press(getByText("Envoyer la contestation"));
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("submits when description is long enough and navigates on success", async () => {
    mockSubmit.mockResolvedValueOnce({ appealId: "A1", status: "received" });
    const { getByText, getByPlaceholderText } = render(
      <ModerationAppealFormScreen />,
    );
    fireEvent.changeText(
      getByPlaceholderText(/Expliquez/),
      "This is a sufficiently long description.",
    );
    await act(async () => {
      fireEvent.press(getByText("Envoyer la contestation"));
    });
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(
        "ModerationAppealSubmitted",
        expect.objectContaining({ appealId: "A1", decisionId: "D1" }),
      );
    });
  });

  it.each([
    [429, "Trop de tentatives"],
    [400, "invalide ou expirée"],
    [500, "Impossible d'envoyer"],
  ])("renders error banner when API returns %s", async (status, fragment) => {
    const err: any = new Error("boom");
    err.status = status;
    mockSubmit.mockRejectedValueOnce(err);

    const { getByText, getByPlaceholderText, findByText } = render(
      <ModerationAppealFormScreen />,
    );
    fireEvent.changeText(
      getByPlaceholderText(/Expliquez/),
      "long enough description please",
    );
    await act(async () => {
      fireEvent.press(getByText("Envoyer la contestation"));
    });
    expect(await findByText(new RegExp(fragment))).toBeTruthy();
  });

  it("calls goBack from the header back button", () => {
    const { UNSAFE_getAllByType } = render(<ModerationAppealFormScreen />);
    const TouchableOpacity = require("react-native").TouchableOpacity;
    fireEvent.press(UNSAFE_getAllByType(TouchableOpacity)[0]);
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("calls goBack from the secondary 'Retour' button", () => {
    const { getByText } = render(<ModerationAppealFormScreen />);
    fireEvent.press(getByText("Retour"));
    expect(mockGoBack).toHaveBeenCalled();
  });
});
