/**
 * Verification script: tests that the TFJS model loads and produces
 * valid 8-class softmax output.
 *
 * Starts a local HTTP server to serve model files, then loads via TFJS.
 * Run: node scripts/verify-tfjs-model.mjs
 */
import * as tf from "@tensorflow/tfjs";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const CLASS_NAMES = [
  "Baked Potato", "Burger", "Crispy Chicken", "Donut",
  "Fries", "Hot Dog", "Pizza", "Sandwich",
];
const INPUT_SIZE = 224;

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(PUBLIC_DIR, req.url);
      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath);
      const mime = ext === ".json" ? "application/json" : "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      res.end(data);
    });
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function main() {
  console.log("=== TFJS Model Verification ===\n");

  // Start local server
  const { server, port } = await startServer();
  const modelUrl = `http://127.0.0.1:${port}/models/tfjs/model.json`;

  try {
    // 1. Load model
    console.log("1. Loading model from", modelUrl, "...");
    const model = await tf.loadGraphModel(modelUrl);
    console.log("   Model loaded successfully!");
    console.log("   Inputs:", JSON.stringify(model.inputs.map(i => ({ name: i.name, shape: i.shape, dtype: i.dtype }))));
    console.log("   Outputs:", JSON.stringify(model.outputs.map(o => ({ name: o.name, shape: o.shape, dtype: o.dtype }))));

    // 2. Test with zeros (black image)
    console.log("\n2. Testing with zero tensor (black image)...");
    const zeroInput = tf.zeros([1, INPUT_SIZE, INPUT_SIZE, 3]);
    const zeroOutput = model.predict(zeroInput);
    const zeroData = zeroOutput.dataSync();
    zeroInput.dispose();
    zeroOutput.dispose();

    console.log("   Output length:", zeroData.length, "(expected:", CLASS_NAMES.length, ")");
    if (zeroData.length !== CLASS_NAMES.length) {
      console.error("   FAIL: Output length mismatch!");
      process.exit(1);
    }

    const zeroSum = Array.from(zeroData).reduce((a, b) => a + b, 0);
    console.log("   Probabilities sum:", zeroSum.toFixed(4), "(expected ~1.0)");
    console.log("   Per-class:");
    for (let i = 0; i < CLASS_NAMES.length; i++) {
      console.log(`     ${CLASS_NAMES[i].padEnd(16)} ${(zeroData[i] * 100).toFixed(2)}%`);
    }

    // 3. Test with random tensor (simulated image)
    console.log("\n3. Testing with random tensor (simulated image 0-255)...");
    const randInput = tf.randomUniform([1, INPUT_SIZE, INPUT_SIZE, 3], 0, 255);
    const randOutput = model.predict(randInput);
    const randData = randOutput.dataSync();
    randInput.dispose();
    randOutput.dispose();

    const randSum = Array.from(randData).reduce((a, b) => a + b, 0);
    console.log("   Probabilities sum:", randSum.toFixed(4));
    let bestIdx = 0;
    for (let i = 1; i < randData.length; i++) {
      if (randData[i] > randData[bestIdx]) bestIdx = i;
    }
    console.log("   Best class:", CLASS_NAMES[bestIdx], `(${(randData[bestIdx] * 100).toFixed(2)}%)`);
    console.log("   Per-class:");
    for (let i = 0; i < CLASS_NAMES.length; i++) {
      console.log(`     ${CLASS_NAMES[i].padEnd(16)} ${(randData[i] * 100).toFixed(2)}%`);
    }

    // 4. Test with 255s (white image)
    console.log("\n4. Testing with 255 tensor (white image)...");
    const whiteInput = tf.fill([1, INPUT_SIZE, INPUT_SIZE, 3], 255);
    const whiteOutput = model.predict(whiteInput);
    const whiteData = whiteOutput.dataSync();
    whiteInput.dispose();
    whiteOutput.dispose();

    console.log("   Per-class:");
    for (let i = 0; i < CLASS_NAMES.length; i++) {
      console.log(`     ${CLASS_NAMES[i].padEnd(16)} ${(whiteData[i] * 100).toFixed(2)}%`);
    }

    // 5. Validate all outputs are valid probabilities
    console.log("\n5. Validation checks...");
    let allValid = true;

    for (const [name, data] of [["zero", zeroData], ["random", randData], ["white", whiteData]]) {
      const sum = Array.from(data).reduce((a, b) => a + b, 0);
      const allPositive = Array.from(data).every(v => v >= 0);
      const sumOk = Math.abs(sum - 1.0) < 0.01;

      if (!allPositive) { console.error(`   FAIL: ${name} has negative values`); allValid = false; }
      if (!sumOk) { console.error(`   FAIL: ${name} sum=${sum} not ~1.0`); allValid = false; }
    }

    if (allValid) {
      console.log("   ALL CHECKS PASSED!");
    } else {
      console.error("   SOME CHECKS FAILED!");
      process.exit(1);
    }

    console.log("\n=== Verification Complete ===");
  } finally {
    server.close();
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exit(1);
});
