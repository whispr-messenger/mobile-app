export type GateResult = {
  allowed: boolean;
  reason: "BLOCK_TRAINED_CLASS" | "UNCERTAIN";
  bestIndex: number;
  bestProb: number;
  bestClass: string;
  probs: Record<string, number>;
};

class TfliteModerationService {
  async init(): Promise<never> {
    throw new Error("TFLite not available on web");
  }

  async warmup(): Promise<void> {
    // no-op on web
  }

  async isAllowed(_params: {
    uri: string;
    threshold?: number;
  }): Promise<boolean> {
    return true;
  }

  async gate(_params: {
    uri: string;
    threshold?: number;
  }): Promise<GateResult> {
    return {
      allowed: true,
      reason: "UNCERTAIN",
      bestIndex: 0,
      bestProb: 0,
      bestClass: "",
      probs: {},
    };
  }
}

export const tfliteService = new TfliteModerationService();
