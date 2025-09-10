"use client";

import { useState } from "react";

export default function SpeechToTxtAgent() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/speech-to-text/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to transcribe audio");

      const data = await res.json();
      setTranscript(data.transcript || "⚠️ No transcript received.");
    } catch (err) {
      console.error(err);
      setTranscript("❌ Error processing audio.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white shadow-md rounded-lg p-6">
      <input type="file" accept="audio/*,video/*" onChange={handleFileChange} />
      <button
        onClick={handleUpload}
        disabled={loading}
        className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        {loading ? "Processing..." : "Transcribe"}
      </button>

      {transcript && (
        <div className="mt-6 p-4 border rounded-lg bg-gray-50 whitespace-pre-wrap">
          <h2 className="font-semibold mb-2">Transcript:</h2>
          <p>{transcript}</p>
        </div>
      )}
    </div>
  );
}
