"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Rectangle() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const router = useRouter();

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      setError("Hanya menerima file .pdf!");
      setFile(null);
      return;
    }

    setError(null);
    setFile(selectedFile);
  };

  const handleInputChange = (e) => {
    handleFileSelect(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Pilih atau drop file CV dulu, ya!");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/analyze`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Gagal menganalisis file (${response.status})`);
      }

      const data = await response.json();

      // Simpan hasil ke sessionStorage supaya bisa dibaca di halaman /result
      sessionStorage.setItem("cv_analysis_result", JSON.stringify(data));

      // Redirect ke halaman hasil
      router.push("/result");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div
      className="upload"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        borderColor: isDragging ? "#028a57" : undefined,
      }}
    >
      <input
        type="file"
        accept=".pdf"
        ref={fileInputRef}
        onChange={handleInputChange}
        style={{ display: "none" }}
      />

      {!file ? (
        <p className="upload-text" onClick={() => fileInputRef.current.click()}>
          Drop CV kamu disini (khusus CV Bahasa Indonesia)!
          <br />
          Hanya menerima file .pdf!
        </p>
      ) : (
        <p className="upload-text">{file.name}</p>
      )}

      {error && <p style={{ color: "red", fontSize: "14px" }}>{error}</p>}

      <button
        className="upload-button"
        onClick={file ? handleUpload : () => fileInputRef.current.click()}
        disabled={loading}
      >
        {loading ? "Menganalisis..." : file ? "Analisis Sekarang" : "Unggah File"}
      </button>
    </div>
  );
}