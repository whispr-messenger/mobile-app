import json
import numpy as np
import os
import struct

INPUT_DIR = "assets/models/tfjs"
OUTPUT_DIR = "assets/models/tfjs_q"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Load model.json
with open(os.path.join(INPUT_DIR, "model.json"), "r") as f:
    model_json = json.load(f)

# Load all weight shards into one buffer
shard_paths = model_json["weightsManifest"][0]["paths"]
all_bytes = bytearray()
for p in shard_paths:
    with open(os.path.join(INPUT_DIR, p), "rb") as f:
        all_bytes.extend(f.read())

print(f"Original weight size: {len(all_bytes)} bytes ({len(all_bytes)/1024/1024:.1f} MB)")

# Parse weights and quantize float32 -> uint8
weights = model_json["weightsManifest"][0]["weights"]
offset = 0
new_weights = []
new_data = bytearray()

for w in weights:
    name = w["name"]
    dtype = w["dtype"]
    shape = w["shape"]
    num_elements = 1
    for s in shape:
        num_elements *= s

    if dtype == "float32":
        byte_len = num_elements * 4
        raw = all_bytes[offset:offset + byte_len]
        arr = np.frombuffer(bytes(raw), dtype=np.float32)

        # Quantize: map [min, max] -> [0, 255]
        arr_min = float(arr.min())
        arr_max = float(arr.max())

        if arr_max - arr_min < 1e-10:
            quantized = np.zeros(num_elements, dtype=np.uint8)
            arr_min = 0.0
            arr_max = 0.0
        else:
            scale = 255.0 / (arr_max - arr_min)
            quantized = np.round((arr - arr_min) * scale).clip(0, 255).astype(np.uint8)

        # Write quantized data
        new_data.extend(quantized.tobytes())

        new_weights.append({
            "name": name,
            "shape": shape,
            "dtype": "float32",
            "quantization": {
                "dtype": "uint8",
                "min": arr_min,
                "max": arr_max,
            }
        })
        offset += byte_len
    elif dtype == "int32":
        byte_len = num_elements * 4
        raw = all_bytes[offset:offset + byte_len]
        new_data.extend(raw)
        new_weights.append(w.copy())
        offset += byte_len
    else:
        raise ValueError(f"Unknown dtype: {dtype}")

print(f"Quantized weight size: {len(new_data)} bytes ({len(new_data)/1024/1024:.1f} MB)")

# Write single shard
shard_name = "group1-shard1of1.bin"
with open(os.path.join(OUTPUT_DIR, shard_name), "wb") as f:
    f.write(bytes(new_data))

# Write new model.json
new_model_json = model_json.copy()
new_model_json["weightsManifest"] = [{
    "paths": [shard_name],
    "weights": new_weights,
}]

with open(os.path.join(OUTPUT_DIR, "model.json"), "w") as f:
    json.dump(new_model_json, f)

print(f"Done! Quantized model saved to {OUTPUT_DIR}/")
