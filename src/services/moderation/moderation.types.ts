export type GateResult = {
  allowed: boolean;
  reason: "BLOCK_TRAINED_CLASS" | "OTHER_CLASS" | "UNCERTAIN";
  bestIndex: number;
  bestProb: number;
  bestClass: string;
  probs: Record<string, number>;
};
