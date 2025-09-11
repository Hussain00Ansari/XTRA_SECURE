# 🛡️ XTRA Secure  
### AI-Phishing Email & Malware Detector

XTRA Secure is a full-stack application that detects **phishing emails** and scans **attachments for malware** using Machine Learning models.  
It integrates two `.pkl` models into a single FastAPI backend and provides a modern frontend built with React + TailwindCSS.  

---

## 🚀 Features  
- 📧 Detects **phishing emails** (`.eml` / `.txt`)  
- 🦠 Scans **attachments for malware**  
- ⚡ Single FastAPI backend serving both models  
- 🎨 React + Tailwind frontend (Vite-powered)  
- ☁️ Deployment ready (**Netlify + Render**)  

---

## 🌐 Live Demo  

- **Frontend (Netlify):** [https://xtra-secure-frontend.netlify.app](https://xtra-secure-frontend.netlify.app)  
- **Backend API (Render):** [https://xtra-secure-backend.onrender.com](https://xtra-secure-backend.onrender.com)   

---

## 🗂️ Project Structure  
```
XTRA_SECURE/
│
├── frontend/ # React frontend
│ ├── public/
│ ├── src/
│ └── package.json
│
├── backend/ # FastAPI backend
│ ├── main.py # FastAPI entry point
│ ├── model.pkl # Phishing detection model
│ ├── malware_model_cpu.pkl # Malware detection model
│ ├── requirements.txt
│ └── pycache/
│
└── README.md
```

---

## ☁️ Deployment  

### 🔹 Frontend (Netlify)
1. Push `frontend/` to GitHub.  
2. Go to [Netlify](https://www.netlify.com/) → **New Site** → Import from GitHub.  
3. Configure build settings:  
   - **Build Command:** `npm run build`  
   - **Publish Directory:** `dist`  
4. Deploy 🎉  

---

### 🔹 Backend (Render)
1. Push `backend/` to GitHub.  
2. Go to [Render](https://render.com/) → **New Web Service** → Connect your repo.  
3. Configure service:  
   - **Start Command:**  
     ```
     uvicorn main:app --host 0.0.0.0 --port 8000
     ```
4. Deploy 🚀  

---
