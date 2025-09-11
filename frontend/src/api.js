import axios from "axios";

// ✅ Use deployed backend on Render
const API_BASE = "https://xtra-secure-24.onrender.com";

// 📌 For text-based email input
export async function checkPhishingText(text) {
  const resp = await axios.post(
    `${API_BASE}/predict_email_text`,
    { text },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 60000,
    }
  );
  return resp.data;
}

// 📌 For file-based email upload
export async function checkPhishingFile(file) {
  const fd = new FormData();
  fd.append("file", file);

  const resp = await axios.post(`${API_BASE}/predict_email_file`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
  });
  return resp.data;
}

// 📌 For malware file upload
export async function checkMalwareFile(file) {
  const fd = new FormData();
  fd.append("file", file);

  const resp = await axios.post(`${API_BASE}/predict_malware`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
  });
  return resp.data;
}
