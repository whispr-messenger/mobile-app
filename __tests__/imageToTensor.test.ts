/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: jest.fn(),
}));

jest.mock("jpeg-js", () => ({
  decode: jest.fn(),
}));

import * as ImageManipulator from "expo-image-manipulator";
import jpeg from "jpeg-js";
import { Platform } from "react-native";
import { imageUriToFloatTensor_0_255 } from "../src/services/moderation/image-to-tensor";

const mockedManip = ImageManipulator as unknown as {
  manipulateAsync: jest.Mock;
};
const mockedJpeg = jpeg as unknown as { decode: jest.Mock };

const JPEG_MAGIC_BYTES = "/9j/AAA="; // ff d8 ff 00 00

beforeEach(() => {
  mockedManip.manipulateAsync.mockReset();
  mockedJpeg.decode.mockReset();
  Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
});

describe("imageUriToFloatTensor_0_255 (native)", () => {
  it("decodes JPEG bytes and returns RGB Float32Array of width*height*3", async () => {
    // Probe call returns dims
    mockedManip.manipulateAsync
      .mockResolvedValueOnce({ width: 100, height: 100, base64: "" })
      .mockResolvedValueOnce({
        width: 2,
        height: 2,
        base64: JPEG_MAGIC_BYTES,
      });

    // Decoded RGBA: 4 pixels of (1,2,3,255), (4,5,6,255), (7,8,9,255), (10,11,12,255)
    const rgba = new Uint8Array([
      1, 2, 3, 255,
      4, 5, 6, 255,
      7, 8, 9, 255,
      10, 11, 12, 255,
    ]);
    mockedJpeg.decode.mockReturnValueOnce({ data: rgba });

    const out = await imageUriToFloatTensor_0_255({
      uri: "file:///x.jpg",
      width: 2,
      height: 2,
    });

    expect(out).toBeInstanceOf(Float32Array);
    expect(out.length).toBe(2 * 2 * 3);
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("center-crops portrait images before resize", async () => {
    mockedManip.manipulateAsync
      .mockResolvedValueOnce({ width: 100, height: 200, base64: "" })
      .mockResolvedValueOnce({ width: 1, height: 1, base64: JPEG_MAGIC_BYTES });
    mockedJpeg.decode.mockReturnValueOnce({
      data: new Uint8Array([10, 20, 30, 255]),
    });

    await imageUriToFloatTensor_0_255({
      uri: "f.jpg",
      width: 1,
      height: 1,
    });

    const secondCall = mockedManip.manipulateAsync.mock.calls[1];
    const actions = secondCall[1] as any[];
    // First action should be a center-crop
    expect(actions[0]).toEqual({
      crop: { originX: 0, originY: 50, width: 100, height: 100 },
    });
    expect(actions[1]).toEqual({ resize: { width: 1, height: 1 } });
  });

  it("does not crop when probe returns square dims", async () => {
    mockedManip.manipulateAsync
      .mockResolvedValueOnce({ width: 50, height: 50, base64: "" })
      .mockResolvedValueOnce({ width: 1, height: 1, base64: JPEG_MAGIC_BYTES });
    mockedJpeg.decode.mockReturnValueOnce({
      data: new Uint8Array([1, 2, 3, 255]),
    });

    await imageUriToFloatTensor_0_255({ uri: "x", width: 1, height: 1 });

    const secondCall = mockedManip.manipulateAsync.mock.calls[1];
    const actions = secondCall[1] as any[];
    expect(actions.length).toBe(1);
    expect(actions[0]).toEqual({ resize: { width: 1, height: 1 } });
  });

  it("throws when manipulateAsync returns no base64", async () => {
    mockedManip.manipulateAsync
      .mockResolvedValueOnce({ width: 2, height: 2, base64: "" })
      .mockResolvedValueOnce({ width: 1, height: 1, base64: undefined });

    await expect(
      imageUriToFloatTensor_0_255({ uri: "x", width: 1, height: 1 }),
    ).rejects.toThrow(/Failed to get base64/);
  });

  it("throws on PNG output from manipulator (native)", async () => {
    mockedManip.manipulateAsync
      .mockResolvedValueOnce({ width: 2, height: 2, base64: "" })
      // PNG magic: 89 50 4e 47
      .mockResolvedValueOnce({
        width: 1,
        height: 1,
        base64: "iVBORw==",
      });

    await expect(
      imageUriToFloatTensor_0_255({ uri: "x", width: 1, height: 1 }),
    ).rejects.toThrow(/Unexpected PNG/);
  });

  it("throws on unknown image format", async () => {
    mockedManip.manipulateAsync
      .mockResolvedValueOnce({ width: 2, height: 2, base64: "" })
      .mockResolvedValueOnce({
        width: 1,
        height: 1,
        // Random bytes that are neither JPEG nor PNG: e.g. "XYZ"
        base64: "WFla",
      });

    await expect(
      imageUriToFloatTensor_0_255({ uri: "x", width: 1, height: 1 }),
    ).rejects.toThrow(/Unknown image format/);
  });
});
