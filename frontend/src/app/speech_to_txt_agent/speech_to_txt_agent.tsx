
"use client";

import { useState } from "react";

type MoMType = {
  summary?: string;
  action_items?: string[];
  decisions?: string[];
};

export default function SpeechToTxtAgent() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [mom, setMom] = useState<MoMType>({});
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        "http://localhost:8000/speech-to-text/transcribe",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) throw new Error("Failed to transcribe audio");

      const response = await res.json();

      // Updated: directly use response keys
      setTranscript(response.transcript || "⚠️ No transcript received.");
      setMom(response.mom || { summary: "", action_items: [], decisions: [] });

    } catch (err) {
      console.error(err);
      setTranscript("❌ Error processing audio.");
      setMom({ summary: "", action_items: [], decisions: [] });
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full space-y-6">
      {/* File Upload Section */}
      <div className="space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Upload Audio/Video File</h3>
            <p className="text-sm text-slate-600">Drag and drop or click to browse</p>
          </div>
        </div>

        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
            dragActive 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="audio/*,video/*"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          
          {!file ? (
            <div className="space-y-3">
              <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <p className="text-slate-700 font-medium">Drop your audio/video file here</p>
                <p className="text-sm text-slate-500">Supports MP3, WAV, MP4, and more formats</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-800">{file.name}</p>
                <p className="text-sm text-slate-600">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Remove file
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Transcribe & Generate MoM</span>
            </>
          )}
        </button>
      </div>

      {/* Transcript Section */}
      {transcript && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center space-x-2">
            <h3 className="font-semibold text-slate-800">Transcript</h3>
          </div>
          <div className="p-6 prose max-w-none">
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{transcript}</p>
          </div>
        </div>
      )}

      {/* MoM Section */}
      {(mom.summary || (mom.action_items && mom.action_items.length > 0) || (mom.decisions && mom.decisions.length > 0)) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-3 border-b border-green-200 flex items-center space-x-2">
            <h3 className="font-semibold text-green-800">Minutes of Meeting (MoM)</h3>
          </div>
          
          <div className="p-6 space-y-6">
            {mom.summary && (
              <div>
                <h4 className="font-semibold text-slate-800">Summary</h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-slate-700 whitespace-pre-wrap">{mom.summary}</p>
                </div>
              </div>
            )}

            {mom.action_items && mom.action_items.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-800">Action Items</h4>
                <ul className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-2">
                  {mom.action_items.map((item, idx) => (
                    <li key={idx} className="flex items-start space-x-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center mt-0.5">{idx + 1}</span>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {mom.decisions && mom.decisions.length > 0 && (
              <div>
                <h4 className="font-semibold text-slate-800">Decisions</h4>
                <ul className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2">
                  {mom.decisions.map((item, idx) => (
                    <li key={idx} className="flex items-start space-x-3">
                      <svg className="flex-shrink-0 w-5 h-5 text-purple-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
