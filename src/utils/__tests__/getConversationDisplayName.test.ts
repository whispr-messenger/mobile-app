// Tests pour la fallback chain de getConversationDisplayName (WHISPR-1423).
// le but : eviter d afficher "Utilisateur" en clair quand on a encore un
// username ou un phone_number_masked a montrer.

import { getConversationDisplayName } from "./src/utils";

describe("getConversationDisplayName — direct conversation fallback chain", () => {
  it("retourne display_name quand present", () => {
    expect(
      getConversationDisplayName({
        type: "direct",
        display_name: "Alice Cooper",
        username: "alice",
        phone_number: "+33 6 12 34 56 78",
      }),
    ).toBe("Alice Cooper");
  });

  it("retourne @username quand display_name est vide", () => {
    expect(
      getConversationDisplayName({
        type: "direct",
        display_name: undefined,
        username: "ada",
      }),
    ).toBe("@ada");
  });

  it("retourne phone_number quand display_name et username sont vides", () => {
    expect(
      getConversationDisplayName({
        type: "direct",
        display_name: "",
        username: undefined,
        phone_number: "+33 6 ** ** 64 12",
      }),
    ).toBe("+33 6 ** ** 64 12");
  });

  it("fallback final reste 'Utilisateur' quand tout est vide", () => {
    expect(
      getConversationDisplayName({
        type: "direct",
        display_name: undefined,
        username: undefined,
        phone_number: undefined,
      }),
    ).toBe("Utilisateur");
  });

  it("ignore display_name qui ressemble a un UUID brut", () => {
    expect(
      getConversationDisplayName({
        type: "direct",
        display_name: "fab8817a-27a0-4537-89c1-be05f783150b",
        username: "ada",
      }),
    ).toBe("@ada");
  });
});
