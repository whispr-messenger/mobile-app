/**
 * Tests for BlockedImageAppealModal component
 */

import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

const mockCreateBlockedImageAppeal = jest.fn();

jest.mock("./src/store/moderationStore", () => ({
  useModerationStore: () => ({
    createBlockedImageAppeal: mockCreateBlockedImageAppeal,
  }),
}));

jest.mock("./src/theme/colors", () => ({
  colors: {
    primary: { main: "#6200ee" },
  },
}));

import { BlockedImageAppealModal } from "./src/components/Chat/BlockedImageAppealModal";

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  imageUri: "file:///photos/test.jpg",
  blockReason: "nudity",
  scores: { nudity: 0.9 },
  messageTempId: "temp-123",
  conversationId: "conv-1",
  recipientId: "user-2",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BlockedImageAppealModal", () => {
  it("renders title and subtitle when visible", () => {
    const { getByText } = render(<BlockedImageAppealModal {...baseProps} />);

    expect(getByText("Contester le blocage")).toBeTruthy();
    expect(getByText(/Explique pourquoi ton image est conforme/)).toBeTruthy();
  });

  it("renders block reason when provided", () => {
    const { getByText } = render(<BlockedImageAppealModal {...baseProps} />);

    expect(getByText("Raison du blocage")).toBeTruthy();
    expect(getByText("nudity")).toBeTruthy();
  });

  it("submit button has disabled style when reason is too short", () => {
    const { getByText } = render(<BlockedImageAppealModal {...baseProps} />);

    // The submit button's TouchableOpacity has disabled={!canSubmit}
    // We verify by attempting to press and confirming no call was made
    fireEvent.press(getByText("Envoyer la contestation"));
    expect(mockCreateBlockedImageAppeal).not.toHaveBeenCalled();
  });

  it("submit fires when reason is long enough", async () => {
    mockCreateBlockedImageAppeal.mockResolvedValue(undefined);
    const { getByText, getByPlaceholderText } = render(
      <BlockedImageAppealModal {...baseProps} />,
    );

    const input = getByPlaceholderText("Explique pourquoi ton image est OK");
    fireEvent.changeText(
      input,
      "This is a valid reason that is long enough to pass validation",
    );
    fireEvent.press(getByText("Envoyer la contestation"));

    await waitFor(() => {
      expect(mockCreateBlockedImageAppeal).toHaveBeenCalled();
    });
  });

  it("calls createBlockedImageAppeal with correct params on submit", async () => {
    mockCreateBlockedImageAppeal.mockResolvedValue(undefined);

    const { getByText, getByPlaceholderText } = render(
      <BlockedImageAppealModal {...baseProps} />,
    );

    const input = getByPlaceholderText("Explique pourquoi ton image est OK");
    fireEvent.changeText(
      input,
      "This is a valid reason that is long enough to pass validation",
    );

    fireEvent.press(getByText("Envoyer la contestation"));

    await waitFor(() => {
      expect(mockCreateBlockedImageAppeal).toHaveBeenCalledWith({
        imageUri: "file:///photos/test.jpg",
        reason: "This is a valid reason that is long enough to pass validation",
        conversationId: "conv-1",
        recipientId: "user-2",
        messageTempId: "temp-123",
        blockReason: "nudity",
        scores: { nudity: 0.9 },
      });
    });
  });

  it("calls onClose after successful submission", async () => {
    mockCreateBlockedImageAppeal.mockResolvedValue(undefined);

    const { getByText, getByPlaceholderText } = render(
      <BlockedImageAppealModal {...baseProps} />,
    );

    fireEvent.changeText(
      getByPlaceholderText("Explique pourquoi ton image est OK"),
      "This is a valid reason that is long enough to pass validation",
    );
    fireEvent.press(getByText("Envoyer la contestation"));

    await waitFor(() => {
      expect(baseProps.onClose).toHaveBeenCalled();
    });
  });

  it("calls onClose when cancel button is pressed", () => {
    const { getByText } = render(<BlockedImageAppealModal {...baseProps} />);

    fireEvent.press(getByText("Annuler"));

    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it("displays character counter", () => {
    const { getByText, getByPlaceholderText } = render(
      <BlockedImageAppealModal {...baseProps} />,
    );

    expect(getByText("0/500 (min 20)")).toBeTruthy();

    fireEvent.changeText(
      getByPlaceholderText("Explique pourquoi ton image est OK"),
      "Hello world",
    );

    expect(getByText("11/500 (min 20)")).toBeTruthy();
  });
});
