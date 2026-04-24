jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(),
}));

import * as Clipboard from "expo-clipboard";
import { copyToClipboard } from "./src/utils/clipboard";

const mockedSetString = Clipboard.setStringAsync as jest.MockedFunction<
  typeof Clipboard.setStringAsync
>;

describe("copyToClipboard", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    mockedSetString.mockReset();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns true when the native clipboard call succeeds", async () => {
    mockedSetString.mockResolvedValueOnce(true);

    await expect(copyToClipboard("hello")).resolves.toBe(true);
    expect(mockedSetString).toHaveBeenCalledWith("hello");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns false and logs a warning when the native call rejects", async () => {
    const err = new Error("boom");
    mockedSetString.mockRejectedValueOnce(err);

    await expect(copyToClipboard("oops")).resolves.toBe(false);
    expect(warnSpy).toHaveBeenCalledWith("[Clipboard] copy failed:", err);
  });

  it("forwards an empty string to the native API", async () => {
    mockedSetString.mockResolvedValueOnce(true);

    await expect(copyToClipboard("")).resolves.toBe(true);
    expect(mockedSetString).toHaveBeenCalledWith("");
  });
});
