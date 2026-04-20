const mockRun = jest.fn();
const mockLoadTensorflowModel = jest.fn().mockResolvedValue({ run: mockRun });

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

jest.mock("react-native-fast-tflite", () => ({
  loadTensorflowModel: (...args: any[]) => mockLoadTensorflowModel(...args),
}), { virtual: true });

const mockImageUriToFloatTensor = jest.fn();
jest.mock("./src/services/moderation/image-to-tensor", () => ({
  imageUriToFloatTensor_0_255: (...args: any[]) =>
    mockImageUriToFloatTensor(...args),
}));

jest.mock("./assets/models/whispr.tflite", () => 1, { virtual: true });

// TODO(WHISPR-967-followup): The native tflite.service.ts was removed and only
// tflite.service.web.ts remains. This test suite targets the obsolete native
// implementation and must be rewritten against the current moderation stack.
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const tfliteService: any = {};

describe.skip("TfliteModerationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (tfliteService as any).model = null;
    (tfliteService as any).loading = null;
    (tfliteService as any).warmedUp = false;
    mockLoadTensorflowModel.mockResolvedValue({ run: mockRun });
  });

  describe("init()", () => {
    it("loads the TFLite model on first call", async () => {
      const model = await tfliteService.init();
      expect(mockLoadTensorflowModel).toHaveBeenCalledTimes(1);
      expect(model).toEqual({ run: mockRun });
    });

    it("returns the cached model on subsequent calls", async () => {
      await tfliteService.init();
      await tfliteService.init();
      expect(mockLoadTensorflowModel).toHaveBeenCalledTimes(1);
    });
  });

  describe("gate()", () => {
    it("returns allowed: false when a class is detected above threshold", async () => {
      const probs = new Float32Array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.99]);
      mockRun.mockResolvedValue([probs]);
      mockImageUriToFloatTensor.mockResolvedValue(
        new Float32Array(224 * 224 * 3),
      );

      const result = await tfliteService.gate({
        uri: "file://test.jpg",
        threshold: 0.99,
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("BLOCK_TRAINED_CLASS");
      expect(result.bestClass).toBe("Pizza");
      expect(result.bestProb).toBeCloseTo(0.99);
    });

    it("returns allowed: true when no class exceeds the threshold", async () => {
      const probs = new Float32Array([0.2, 0.1, 0.15, 0.1, 0.2, 0.15, 0.1]);
      mockRun.mockResolvedValue([probs]);
      mockImageUriToFloatTensor.mockResolvedValue(
        new Float32Array(224 * 224 * 3),
      );

      const result = await tfliteService.gate({
        uri: "file://test.jpg",
        threshold: 0.99,
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe("UNCERTAIN");
    });

    it("throws if model output length mismatches CLASS_NAMES", async () => {
      const probs = new Float32Array([0.5, 0.5]); // only 2 instead of 7
      mockRun.mockResolvedValue([probs]);
      mockImageUriToFloatTensor.mockResolvedValue(
        new Float32Array(224 * 224 * 3),
      );

      await expect(
        tfliteService.gate({ uri: "file://test.jpg" }),
      ).rejects.toThrow("Output length mismatch");
    });
  });

  describe("isAllowed()", () => {
    it("returns true when the gate allows the image", async () => {
      const probs = new Float32Array([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.4]);
      mockRun.mockResolvedValue([probs]);
      mockImageUriToFloatTensor.mockResolvedValue(
        new Float32Array(224 * 224 * 3),
      );

      const allowed = await tfliteService.isAllowed({
        uri: "file://test.jpg",
        threshold: 0.99,
      });
      expect(allowed).toBe(true);
    });

    it("returns false when the gate blocks the image", async () => {
      const probs = new Float32Array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.99]);
      mockRun.mockResolvedValue([probs]);
      mockImageUriToFloatTensor.mockResolvedValue(
        new Float32Array(224 * 224 * 3),
      );

      const allowed = await tfliteService.isAllowed({
        uri: "file://test.jpg",
        threshold: 0.99,
      });
      expect(allowed).toBe(false);
    });
  });
});
