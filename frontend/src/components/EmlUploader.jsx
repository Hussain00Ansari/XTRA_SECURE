// frontend/src/components/EmlUploader.jsx
import React, { useState } from "react";
import { checkPhishingFile } from "../api";

export default function EmlUploader() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onFileChange = (e) => {
    setFile(e.target.files[0]);
    setResult(null);
    setError(null);
  };

  const onScan = async () => {
    if (!file) return setError("Please select an .eml file first.");
    try {
      setLoading(true);
      setError(null);
      const data = await checkPhishingFile(file); // calls backend
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data || err.message || "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white rounded shadow-md">
      <h3 className="text-lg font-semibold mb-2">Upload .eml (Phishing check)</h3>
      <input accept=".eml,.txt" type="file" onChange={onFileChange} />
      <div className="mt-3">
        <button
          onClick={onScan}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
        >
          {loading ? "Scanning..." : "Scan Email"}
        </button>
      </div>

      {error && <p className="mt-3 text-red-600">Error: {String(error)}</p>}

      {result && (
        <div className="mt-4 p-3 border rounded">
          <p className="font-medium">Phishing Result:</p>
          <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
