from gliner2 import AutoExtractor

MODEL_ID = "fastino/gliner2.5-multi-v1"

print("Loading model...")

model = AutoExtractor.from_pretrained(MODEL_ID)

print("Model loaded successfully!")