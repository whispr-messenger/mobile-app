---
license: apache-2.0
language: en
library_name: keras
tags:
  - image-classification
  - food-classification
  - efficientnet
  - tensorflow
  - tflite
  - tfjs
  - transfer-learning
datasets:
  - custom
pipeline_tag: image-classification
model-index:
  - name: efficientnet-food-classifier
    results:
      - task:
          type: image-classification
        metrics:
          - name: Accuracy
            type: accuracy
            value: 0.9328
          - name: F1 (weighted)
            type: f1
            value: 0.9331
          - name: Precision (weighted)
            type: precision
            value: 0.9345
          - name: Recall (weighted)
            type: recall
            value: 0.9328
---

# EfficientNet Food Classifier

A fine-tuned EfficientNet-B0 model for classifying food images into 8 categories. Trained using a two-stage transfer learning approach with ImageNet pre-trained weights.

## Model Description

- **Architecture:** EfficientNet-B0 + custom classification head
- **Task:** Image Classification (8 food categories)
- **Framework:** TensorFlow / Keras
- **Input:** 224×224 RGB images
- **Pre-training:** ImageNet

### Classes

| ID | Label |
|----|-------|
| 0 | Baked Potato |
| 1 | Burger |
| 2 | Crispy Chicken |
| 3 | Donut |
| 4 | Fries |
| 5 | Hot Dog |
| 6 | Pizza |
| 7 | Sandwich |

## Training

### Two-Stage Transfer Learning

1. **Stage 1 — Feature extraction:** Backbone frozen, only classification head trained (LR: 1e-3)
2. **Stage 2 — Fine-tuning:** Backbone unfrozen (BatchNorm frozen), full model trained (LR: 2e-5)

### Training Configuration

| Parameter | Value |
|-----------|-------|
| Base Model | EfficientNet-B0 (ImageNet) |
| Image Size | 224 × 224 |
| Batch Size | 8 |
| Stage 1 Epochs | 12 (EarlyStopping patience=3) |
| Stage 2 Epochs | 6 |
| Optimizer | Adam |
| Loss | Sparse Categorical Crossentropy |
| Dropout | 0.2 |
| Data Augmentation | RandomFlip, RandomRotation(0.05), RandomZoom(0.1), RandomContrast(0.1) |

### Dataset

| Split | Images |
|-------|--------|
| Train | 3,797 |
| Validation | 813 |
| Test | 814 |
| **Total** | **5,424** |

- Stratified 70/15/15 split with leak-free guarantee (SHA256 dedup)
- Images sourced via DuckDuckGo image search, manually cleaned

## Evaluation

### Overall Metrics (Test Set)

| Metric | Score |
|--------|-------|
| **Accuracy** | **0.9328** |
| Precision (weighted) | 0.9345 |
| Recall (weighted) | 0.9328 |
| F1 (weighted) | 0.9331 |
| F1 (macro) | 0.9301 |

### Per-Class Performance

| Class | Precision | Recall | F1-score | Support |
|-------|-----------|--------|----------|---------|
| Baked Potato | 0.907 | 0.898 | 0.903 | 98 |
| Burger | 0.934 | 0.904 | 0.919 | 94 |
| Crispy Chicken | 0.860 | 0.968 | 0.911 | 95 |
| Donut | 0.986 | 0.958 | 0.971 | 142 |
| Fries | 0.926 | 0.917 | 0.921 | 96 |
| Hot Dog | 0.957 | 0.957 | 0.957 | 94 |
| Pizza | 0.971 | 0.918 | 0.944 | 73 |
| Sandwich | 0.906 | 0.923 | 0.914 | 52 |

## Available Formats

| Format | File | Size | Use Case |
|--------|------|------|----------|
| Keras | `BestModelEfficientNetLite.keras` | 16 MB | Python / TensorFlow |
| TFLite | `tflite/model.tflite` | 4.4 MB | Mobile / Edge (dynamic range quantized) |
| TFLite float16 | `tflite/model_float16.tflite` | 7.8 MB | Mobile / Edge (float16 quantized) |
| TFJS | `tfjs/model.json` | 15 MB | Browser / Node.js |

## Usage

### Python (Keras)

```python
import tensorflow as tf
import numpy as np
from PIL import Image

# Load model
model = tf.keras.models.load_model(
    "BestModelEfficientNetLite.keras",
    custom_objects={"preprocess_input": tf.keras.applications.efficientnet.preprocess_input},
)

# Predict
img = Image.open("food.jpg").resize((224, 224))
x = np.expand_dims(np.array(img), axis=0).astype("float32")
probs = model.predict(x)[0]

classes = ["Baked Potato", "Burger", "Crispy Chicken", "Donut", "Fries", "Hot Dog", "Pizza", "Sandwich"]
print(f"Predicted: {classes[np.argmax(probs)]} ({probs.max():.1%})")
```

### TFLite (Python)

```python
import numpy as np
from PIL import Image
import tflite_runtime.interpreter as tflite

interpreter = tflite.Interpreter(model_path="tflite/model.tflite")
interpreter.allocate_tensors()

img = np.array(Image.open("food.jpg").resize((224, 224)), dtype=np.float32)
img = np.expand_dims(img, axis=0)

interpreter.set_tensor(interpreter.get_input_details()[0]['index'], img)
interpreter.invoke()
output = interpreter.get_tensor(interpreter.get_output_details()[0]['index'])
```

### TFJS (JavaScript)

```javascript
import * as tf from '@tensorflow/tfjs';

const model = await tf.loadGraphModel('tfjs/model.json');
const img = tf.browser.fromPixels(imageElement).resizeBilinear([224, 224]).expandDims(0).toFloat();
const predictions = model.predict(img);
const classIndex = predictions.argMax(-1).dataSync()[0];
```

## Limitations

- Trained on web-scraped images; may not generalize well to all food photography styles
- Limited to 8 food categories
- Best performance on clearly visible, single-item food images

## License

Apache 2.0
