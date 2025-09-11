from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import os
import requests
from ember import PEFeatureExtractor  # ✅ EMBER feature extractor

app = FastAPI()

# Allow frontend (localhost:5173) to call backend (localhost:8080)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # ✅ only your frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------- Utility: download if not exists --------
def download_model(url, filename):
    if not os.path.exists(filename):
        print(f"Downloading {filename}...")
        r = requests.get(url)
        r.raise_for_status()
        with open(filename, "wb") as f:
            f.write(r.content)

# -------- Download models from GitHub Release (or any host) --------
download_model(
    "https://github.com/Hussain00Ansari/XTRA_SECURE/releases/download/v1.0/model.pkl",
    "model.pkl"
)
download_model(
    "https://github.com/Hussain00Ansari/XTRA_SECURE/releases/download/v1.0/malware_model_cpu.pkl",
    "malware_model_cpu.pkl"
)

# -------- Load models --------
phishing_model = joblib.load("model.pkl")
malware_model = joblib.load("malware_model_cpu.pkl")

# -------- Initialize EMBER extractor once --------
extractor = PEFeatureExtractor(feature_version=2)

# -------- Request body for email text --------
class EmailRequest(BaseModel):
    text: str

@app.post("/predict_email_text")
async def predict_email_text(request: EmailRequest):
    text = request.text
    pred = phishing_model.predict([text])[0]

    try:
        prob = phishing_model.predict_proba([text])[0].max()
    except Exception:
        prob = 1.0 if pred == 1 else 0.0

    return {
        "verdict": "Phishing" if pred == 1 else "Safe",
        "score": round(prob * 100, 2)
    }

@app.post("/predict_email_file")
async def predict_email_file(file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")
    pred = phishing_model.predict([text])[0]

    try:
        prob = phishing_model.predict_proba([text])[0].max()
    except Exception:
        prob = 1.0 if pred == 1 else 0.0

    return {
        "verdict": "Phishing" if pred == 1 else "Safe",
        "score": round(prob * 100, 2)
    }

@app.post("/predict_malware")
async def predict_malware(file: UploadFile = File(...)):
    content = await file.read()

    # ✅ 1. Must be a PE file
    if not content.startswith(b"MZ"):
        return {
            "verdict": "Unsupported file type",
            "confidence": 0.0,
            "note": "This model only analyzes Windows executables (.exe, .dll, .sys)."
        }

    try:
        # ✅ 2. Extract features
        features = extractor.feature_vector(content)
        features = np.array(features).reshape(1, -1)

        # ✅ 3. Predict
        pred = malware_model.predict(features)[0]
        prob = malware_model.predict_proba(features)[0].max()

        return {
            "verdict": "Malicious" if pred == 1 else "Benign",
            "confidence": round(prob * 100, 2),
        }

    except Exception as e:
        return {
            "verdict": "Error",
            "confidence": 0.0,
            "note": f"Feature extraction failed: {str(e)}"
        }
