import { Platform } from "react-native";
import { getLegalDocumentUrl } from "../legalDocumentUrl";

jest.mock("../../services/apiBase", () => ({
  getApiBaseUrl: () => "https://whispr-preprod.roadmvn.com",
}));

describe("getLegalDocumentUrl", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    (Platform as { OS: typeof Platform.OS }).OS = originalOS;
  });

  it("builds API-hosted URL on native", () => {
    (Platform as { OS: typeof Platform.OS }).OS = "ios";
    expect(getLegalDocumentUrl("privacy")).toBe(
      "https://whispr-preprod.roadmvn.com/legal/privacy.html",
    );
    expect(getLegalDocumentUrl("terms")).toBe(
      "https://whispr-preprod.roadmvn.com/legal/terms.html",
    );
  });
});
