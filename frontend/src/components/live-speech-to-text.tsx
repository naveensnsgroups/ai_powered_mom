
"use client";

import React, { useState, useRef } from "react";

export default function LiveSpeechToText() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const formData = new FormData();
          formData.append("files", event.data, "chunk.webm");

          try {
            const response = await fetch(
              "http://localhost:8000/live-speech-to-text/live-chunks", // ✅ aligned with backend
              { method: "POST", body: formData }
            );

            if (response.ok) {
              const data = await response.json();
              if (data.transcript) {
                setTranscript((prev) => prev + " " + data.transcript);
              }
            } else {
              console.error("Server error:", await response.text());
            }
          } catch (err) {
            console.error("Error sending chunk:", err);
          }
        }
      };

      mediaRecorder.start(2000); // send every 2s
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <div className="flex flex-col items-center p-6 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">🎙️ Live Speech-to-Text</h1>

      <div className="flex space-x-4 mb-6">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="px-6 py-3 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700"
          >
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-6 py-3 bg-red-600 text-white rounded-lg shadow-lg hover:bg-red-700"
          >
            Stop Recording
          </button>
        )}
      </div>

      <div className="w-full max-w-2xl bg-white rounded-lg shadow-md p-4 overflow-y-auto h-64 border border-gray-200">
        <h2 className="text-lg font-semibold mb-2">Transcript:</h2>
        <p className="whitespace-pre-wrap text-gray-700">{transcript}</p>
      </div>
    </div>
  );
}
