from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
from ember import PEFeatureExtractor
from huggingface_hub import hf_hub_download  # ✅ Import Hugging Face downloader

app = FastAPI()

# Allow frontend (localhost:5173) to call backend (localhost:8080)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",        # ✅ local development
        "https://xtra-secure.netlify.app"  # ✅ deployed frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ✅ Download models from Hugging Face instead of local files
phishing_model_path = hf_hub_download("Anindya-Dev/xtra-secure-models", "model.pkl")
malware_model_path = hf_hub_download("Anindya-Dev/xtra-secure-models", "malware_model_cpu.pkl")

phishing_model = joblib.load(phishing_model_path)
malware_model = joblib.load(malware_model_path)

# Initialize EMBER extractor once
extractor = PEFeatureExtractor(feature_version=2)

# Root route (so / doesn’t return 404)
@app.get("/")
async def root():
    return {
        "message": "🚀 XTRA Secure API is live!",
        "docs": "/docs",
        "endpoints": [
            "/predict_email_text",
            "/predict_email_file",
            "/predict_malware"
        ]
    }

# Request body for email text
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

    if not content.startswith(b"MZ"):
        return {
            "verdict": "Unsupported file type",
            "confidence": 0.0,
            "note": "This model only analyzes Windows executables (.exe, .dll, .sys)."
        }

    try:
        features = extractor.feature_vector(content)
        features = np.array(features).reshape(1, -1)

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
