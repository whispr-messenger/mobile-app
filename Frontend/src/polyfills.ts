import { Buffer } from "buffer";

(globalThis as any).Buffer = (globalThis as any).Buffer ?? Buffer;
