import { mapMediaUploadError } from "../mapMediaUploadError";

describe("mapMediaUploadError", () => {
  it("maps HTTP 429 to retryable French message", () => {
    const err = new Error("too many") as Error & { status?: number };
    err.status = 429;
    expect(mapMediaUploadError(err)).toEqual({
      userMessage: "Trop d'envois en cours — réessayez dans quelques secondes",
      retryable: true,
    });
  });

  it("maps network errors to retryable message", () => {
    expect(
      mapMediaUploadError(new Error("Network error during upload")),
    ).toEqual({
      userMessage: "Connexion interrompue — appuyez pour réessayer",
      retryable: true,
    });
  });
});
