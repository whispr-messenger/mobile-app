import { loadTensorflowModel } from "react-native-fast-tflite";
import { imageUriToFloatTensor_0_255 } from "./image-to-tensor";

type TFLiteModel = Awaited<ReturnType<typeof loadTensorflowModel>>;

export type GateResult = {
    allowed: boolean;
    reason: "BLOCK_TRAINED_CLASS" | "UNCERTAIN";
    bestIndex: number;
    bestProb: number;
    bestClass: string;
    probs: Record<string, number>;
};

class TfliteModerationService {
    private model: TFLiteModel | null = null;
    private loading: Promise<TFLiteModel> | null = null;
    private warmedUp = false;

    private INPUT_W = 224;
    private INPUT_H = 224;

    private MODEL = require("../../../assets/models/whispr.tflite");

    private CLASS_NAMES = [
        "Baked Potato",
        "Burger",
        "Crispy Chicken",
        "Donut",
        "Fries",
        "Hot Dog",
        "Pizza",
    ];

    async init(): Promise<TFLiteModel> {
        if (this.model) return this.model;
        if (this.loading) return this.loading;

        this.loading = (async () => {
            const m = await loadTensorflowModel(this.MODEL);
            this.model = m;
            return m;
        })();

        return this.loading;
    }

    async warmup(): Promise<void> {
        if (this.warmedUp) return;
        const m = await this.init();
        const input = new Float32Array(this.INPUT_W * this.INPUT_H * 3);
        await m.run([input]);
        this.warmedUp = true;
    }

    async isAllowed(params: { uri: string; threshold?: number }): Promise<boolean> {
        const r = await this.gate(params);
        return r.allowed;
    }

    async gate(params: { uri: string; threshold?: number }): Promise<GateResult> {
        const { uri, threshold = 0.99 } = params;

        const m = await this.init();
        if (!this.warmedUp) await this.warmup().catch(() => {});

        const input = await imageUriToFloatTensor_0_255({
            uri,
            width: this.INPUT_W,
            height: this.INPUT_H,
        });

        const outputs: any = await m.run([input]);
        const out0 = firstFloatArray(outputs);

        if (out0.length !== this.CLASS_NAMES.length) {
            throw new Error(
                `Output length mismatch: got ${out0.length}, expected ${this.CLASS_NAMES.length}.`
            );
        }

        // out0 直接是 softmax 概率（你的训练末层就是 softmax）
        let bestIndex = 0;
        let bestProb = out0[0];
        for (let i = 1; i < out0.length; i++) {
            if (out0[i] > bestProb) {
                bestProb = out0[i];
                bestIndex = i;
            }
        }

        const bestClass = this.CLASS_NAMES[bestIndex];

        const probs: Record<string, number> = {};
        for (let i = 0; i < this.CLASS_NAMES.length; i++) {
            probs[this.CLASS_NAMES[i]] = Number(out0[i]);
        }

        if (bestProb >= threshold) {
            return {
                allowed: false,
                reason: "BLOCK_TRAINED_CLASS",
                bestIndex,
                bestProb: Number(bestProb),
                bestClass,
                probs,
            };
        }

        return {
            allowed: true,
            reason: "UNCERTAIN",
            bestIndex,
            bestProb: Number(bestProb),
            bestClass,
            probs,
        };
    }
}

export const tfliteService = new TfliteModerationService();

function firstFloatArray(outputs: any): Float32Array {
    const first = Array.isArray(outputs) ? outputs[0] : outputs;

    if (first instanceof Float32Array) return first;

    if (first && typeof first === "object") {
        const v = Object.values(first).find((x) => x instanceof Float32Array);
        if (v) return v as Float32Array;
    }

    if (Array.isArray(first)) return Float32Array.from(first);

    throw new Error("Cannot parse model outputs into Float32Array.");
}
