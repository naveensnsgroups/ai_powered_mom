
"use client";

import { useState, FormEvent } from "react";
import { toast } from "react-toastify";

// Define types to match backend response
interface MoMType {
  summary: {
    overview: string;
    detailed: string;
  };
  action_items: Array<{
    task: string;
    assigned_to: string;
    deadline: string;
  }>;
  decisions: Array<{
    decision: string;
    participant: string;
  }>;
}

interface ApiResponse {
  transcript: string;
  mom: MoMType;
  export_file: string | null;
}

// Constants for file validation
const ALLOWED_FILE_TYPES = ["audio/mpeg", "audio/wav", "audio/mp3", "video/mp4"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function SpeechToTxtAgent() {
  const [file, setFile] = useState<File | null>(null);
  const [exportFormat, setExportFormat] = useState<"none" | "pdf" | "docx">("none");
  const [transcript, setTranscript] = useState<string>("");
  const [editedTranscript, setEditedTranscript] = useState<string>("");
  const [mom, setMom] = useState<MoMType | null>(null);
  const [editedMom, setEditedMom] = useState<MoMType | null>(null);
  const [exportFilePath, setExportFilePath] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [downloadLoading, setDownloadLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!ALLOWED_FILE_TYPES.includes(selectedFile.type)) {
        setError("Invalid file type. Please upload MP3, WAV, or MP4 files.");
        toast.error("Invalid file type. Please upload MP3, WAV, or MP4 files.");
        setFile(null);
        return;
      }
      if (selectedFile.size > MAX_FILE_SIZE) {
        setError("File size exceeds 50MB limit.");
        toast.error("File size exceeds 50MB limit.");
        setFile(null);
        return;
      }
      setError(null);
      setFile(selectedFile);
      toast.success("File selected: " + selectedFile.name);
    }
  };

  // Handle drag-and-drop
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
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!ALLOWED_FILE_TYPES.includes(droppedFile.type)) {
        setError("Invalid file type. Please upload MP3, WAV, or MP4 files.");
        toast.error("Invalid file type. Please upload MP3, WAV, or MP4 files.");
        setFile(null);
        return;
      }
      if (droppedFile.size > MAX_FILE_SIZE) {
        setError("File size exceeds 50MB limit.");
        toast.error("File size exceeds 50MB limit.");
        setFile(null);
        return;
      }
      setError(null);
      setFile(droppedFile);
      toast.success("File dropped: " + droppedFile.name);
    }
  };

  // Handle form submission
  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file to upload.");
      toast.error("Please select a file to upload.");
      return;
    }

    setLoading(true);
    setError(null);
    setTranscript("");
    setEditedTranscript("");
    setMom(null);
    setEditedMom(null);
    setExportFilePath(null);
    toast.info("Processing audio file...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("export_format", exportFormat);

      const res = await fetch("http://localhost:8000/speech-to-text/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        const errorMsg = errorData.detail || "Failed to transcribe audio";
        throw new Error(errorMsg);
      }

      const response: ApiResponse = await res.json();
      setTranscript(response.transcript || "⚠️ No transcript received.");
      setEditedTranscript(response.transcript || "");
      setMom(
        response.mom || {
          summary: { overview: "", detailed: "" },
          action_items: [],
          decisions: [],
        }
      );
      setEditedMom(
        response.mom
          ? { ...response.mom }
          : { summary: { overview: "", detailed: "" }, action_items: [], decisions: [] }
      );
      setExportFilePath(response.export_file);
      toast.success("Transcription and MoM generated successfully!");
    } catch (err: any) {
      const errorMsg = err.message || "Error processing audio. Please try again.";
      setError(errorMsg);
      toast.error(errorMsg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle file download and cleanup
  const handleDownload = async (filePath: string, format: string, isEdited: boolean = false) => {
    if (!filePath) {
      toast.error("No file available to download.");
      return;
    }

    setDownloadLoading(true);
    setError(null);
    toast.info(`Downloading MoM as ${format.toUpperCase()}...`);

    try {
      const response = await fetch(
        `http://localhost:8000/download?file_path=${encodeURIComponent(filePath)}`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.detail || "Failed to download file";
        throw new Error(errorMsg);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `MoM-${new Date().toISOString().split("T")[0]}${isEdited ? "-edited" : ""}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(`MoM downloaded as ${format.toUpperCase()}`);

      // Cleanup the exported file
      try {
        const cleanupResponse = await fetch("http://localhost:8000/speech-to-text/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: filePath }),
        });
        if (!cleanupResponse.ok) {
          const cleanupError = await cleanupResponse.json();
          console.warn(`Cleanup failed: ${cleanupError.detail}`);
          toast.warn("File downloaded, but cleanup failed.");
        } else {
          if (!isEdited) setExportFilePath(null); // Clear only for original export
          toast.success("Downloaded file cleaned up successfully.");
        }
      } catch (cleanupErr) {
        console.warn(`Cleanup request failed: ${cleanupErr}`);
        toast.warn("File downloaded, but cleanup request failed.");
      }
    } catch (err: any) {
      const errorMsg = err.message || "Error downloading file. Please try again.";
      setError(errorMsg);
      toast.error(errorMsg);
      console.error(err);
    } finally {
      setDownloadLoading(false);
    }
  };

  // Handle edit mode toggle
  const handleEditToggle = () => {
    if (isEditing) {
      setEditedTranscript(transcript);
      setEditedMom(mom ? { ...mom } : null);
      toast.info("Editing cancelled, changes discarded.");
    }
    setIsEditing(!isEditing);
  };

  // Handle save changes
  const handleSave = () => {
    setTranscript(editedTranscript);
    setMom(editedMom ? { ...editedMom } : null);
    setIsEditing(false);
    toast.success("Changes saved successfully!");
  };

  // Handle re-export of edited MoM
  const handleReExport = async () => {
    if (!editedMom || !exportFormat || exportFormat === "none") {
      toast.error("No MoM or valid export format selected for re-export.");
      return;
    }

    setDownloadLoading(true);
    setError(null);
    toast.info(`Exporting edited MoM as ${exportFormat.toUpperCase()}...`);

    try {
      const response = await fetch("http://localhost:8000/speech-to-text/export-edited", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mom: editedMom, export_format: exportFormat }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.detail || "Failed to export edited MoM";
        throw new Error(errorMsg);
      }

      const { export_file } = await response.json();
      await handleDownload(export_file, exportFormat, true);
    } catch (err: any) {
      const errorMsg = err.message || "Error exporting edited MoM. Please try again.";
      setError(errorMsg);
      toast.error(errorMsg);
      console.error(err);
    } finally {
      setDownloadLoading(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* File Upload Section */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
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
                ? "border-blue-400 bg-blue-50"
                : "border-slate-300 hover:border-slate-400 bg-slate-50/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            role="region"
            aria-label="File upload area"
          >
            <input
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={loading || downloadLoading}
              aria-label="Select audio or video file"
            />
            {!file ? (
              <div className="space-y-3">
                <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-slate-700 font-medium">Drop your audio/video file here</p>
                  <p className="text-sm text-slate-500">Supports MP3, WAV, MP4 (max 50MB)</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-800">{file.name}</p>
                  <p className="text-sm text-slate-600">{formatFileSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="text-sm text-red-600 hover:text-red-800 font-medium disabled:text-slate-400 disabled:cursor-not-allowed"
                  disabled={loading || downloadLoading}
                >
                  Remove file
                </button>
              </div>
            )}
          </div>

          {/* Export Format Selection */}
          <div className="mt-4">
            <label htmlFor="exportFormat" className="block text-sm font-medium text-slate-700 mb-1">
              Export Format
            </label>
            <select
              id="exportFormat"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as "none" | "pdf" | "docx")}
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
              disabled={loading || downloadLoading}
              aria-label="Select export format"
            >
              <option value="none">None</option>
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
            </select>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || loading || downloadLoading}
            className="w-full mt-4 py-3 px-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
            aria-label="Transcribe and generate MoM"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                <span>Transcribe & Generate MoM</span>
              </>
            )}
          </button>
        </div>

        {/* Transcript Section */}
        {transcript && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Transcript</h3>
              <button
                onClick={handleEditToggle}
                className="py-1 px-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                disabled={loading || downloadLoading}
                aria-label={isEditing ? "Cancel Editing" : "Edit Transcript"}
              >
                {isEditing ? "Cancel" : "Edit"}
              </button>
            </div>
            <div className="p-6 prose max-w-none">
              {isEditing ? (
                <textarea
                  value={editedTranscript}
                  onChange={(e) => setEditedTranscript(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={10}
                  aria-label="Edit transcript"
                />
              ) : (
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{transcript}</p>
              )}
            </div>
          </div>
        )}

        {/* MoM Section */}
        {mom && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-3 border-b border-green-200 flex items-center justify-between">
              <h3 className="font-semibold text-green-800">Minutes of Meeting (MoM)</h3>
              <div className="flex space-x-2">
                <button
                  onClick={handleEditToggle}
                  className="py-1 px-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                  disabled={loading || downloadLoading}
                  aria-label={isEditing ? "Cancel Editing" : "Edit MoM"}
                >
                  {isEditing ? "Cancel" : "Edit"}
                </button>
                {isEditing && (
                  <button
                    onClick={handleSave}
                    className="py-1 px-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed"
                    disabled={loading || downloadLoading}
                    aria-label="Save MoM Changes"
                  >
                    Save
                  </button>
                )}
                {exportFilePath && exportFormat !== "none" && !isEditing && (
                  <button
                    onClick={() => handleDownload(exportFilePath, exportFormat)}
                    disabled={downloadLoading}
                    className="py-1 px-3 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                    aria-label={`Download MoM as ${exportFormat.toUpperCase()}`}
                  >
                    {downloadLoading ? (
                      <>
                        <svg
                          className="animate-spin w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Downloading...</span>
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        <span>Export MoM as {exportFormat.toUpperCase()}</span>
                      </>
                    )}
                  </button>
                )}
                {!isEditing && mom && exportFormat !== "none" && (
                  <button
                    onClick={handleReExport}
                    className="py-1 px-3 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
                    disabled={loading || downloadLoading}
                    aria-label={`Re-export Edited MoM as ${exportFormat.toUpperCase()}`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    <span>Re-export Edited MoM</span>
                  </button>
                )}
              </div>
            </div>
            <div className="p-6 space-y-6">
              {mom.summary?.overview && (
                <div>
                  <h4 className="font-semibold text-slate-800">Summary</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                    <p className="text-slate-700 font-medium">Overview:</p>
                    {isEditing ? (
                      <textarea
                        value={editedMom?.summary.overview || ""}
                        onChange={(e) =>
                          setEditedMom({
                            ...editedMom!,
                            summary: { ...editedMom!.summary, overview: e.target.value },
                          })
                        }
                        className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        rows={4}
                        aria-label="Edit summary overview"
                      />
                    ) : (
                      <p className="text-slate-700 whitespace-pre-wrap">{mom.summary.overview}</p>
                    )}
                    {mom.summary.detailed && (
                      <>
                        <p className="text-slate-700 font-medium mt-2">Detailed:</p>
                        {isEditing ? (
                          <textarea
                            value={editedMom?.summary.detailed || ""}
                            onChange={(e) =>
                              setEditedMom({
                                ...editedMom!,
                                summary: { ...editedMom!.summary, detailed: e.target.value },
                              })
                            }
                            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            rows={6}
                            aria-label="Edit summary detailed"
                          />
                        ) : (
                          <p className="text-slate-700 whitespace-pre-wrap">{mom.summary.detailed}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              {mom.action_items?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-800">Action Items</h4>
                  <ul className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-4">
                    {mom.action_items.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="text-slate-700 flex-1">
                          {isEditing ? (
                            <>
                              <p>
                                <span className="font-medium">Task:</span>
                                <input
                                  type="text"
                                  value={editedMom?.action_items[idx]?.task || ""}
                                  onChange={(e) => {
                                    const newActionItems = [...(editedMom?.action_items || [])];
                                    newActionItems[idx] = { ...newActionItems[idx], task: e.target.value };
                                    setEditedMom({ ...editedMom!, action_items: newActionItems });
                                  }}
                                  className="w-full p-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  aria-label={`Edit action item ${idx + 1} task`}
                                />
                              </p>
                              <p>
                                <span className="font-medium">Assigned to:</span>
                                <input
                                  type="text"
                                  value={editedMom?.action_items[idx]?.assigned_to || ""}
                                  onChange={(e) => {
                                    const newActionItems = [...(editedMom?.action_items || [])];
                                    newActionItems[idx] = { ...newActionItems[idx], assigned_to: e.target.value };
                                    setEditedMom({ ...editedMom!, action_items: newActionItems });
                                  }}
                                  className="w-full p-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  aria-label={`Edit action item ${idx + 1} assigned to`}
                                />
                              </p>
                              <p>
                                <span className="font-medium">Deadline:</span>
                                <input
                                  type="text"
                                  value={editedMom?.action_items[idx]?.deadline || ""}
                                  onChange={(e) => {
                                    const newActionItems = [...(editedMom?.action_items || [])];
                                    newActionItems[idx] = { ...newActionItems[idx], deadline: e.target.value };
                                    setEditedMom({ ...editedMom!, action_items: newActionItems });
                                  }}
                                  className="w-full p-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  aria-label={`Edit action item ${idx + 1} deadline`}
                                />
                              </p>
                            </>
                          ) : (
                            <>
                              <p>
                                <span className="font-medium">Task:</span> {item.task}
                              </p>
                              <p>
                                <span className="font-medium">Assigned to:</span> {item.assigned_to}
                              </p>
                              <p>
                                <span className="font-medium">Deadline:</span> {item.deadline}
                              </p>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {mom.decisions?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-800">Decisions</h4>
                  <ul className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4">
                    {mom.decisions.map((item, idx) => (
                      <li key={idx} className="flex items-start space-x-3">
                        <svg
                          className="flex-shrink-0 w-5 h-5 text-purple-600 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <div className="text-slate-700 flex-1">
                          {isEditing ? (
                            <>
                              <p>
                                <span className="font-medium">Decision:</span>
                                <input
                                  type="text"
                                  value={editedMom?.decisions[idx]?.decision || ""}
                                  onChange={(e) => {
                                    const newDecisions = [...(editedMom?.decisions || [])];
                                    newDecisions[idx] = { ...newDecisions[idx], decision: e.target.value };
                                    setEditedMom({ ...editedMom!, decisions: newDecisions });
                                  }}
                                  className="w-full p-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  aria-label={`Edit decision ${idx + 1} decision`}
                                />
                              </p>
                              <p>
                                <span className="font-medium">Participant:</span>
                                <input
                                  type="text"
                                  value={editedMom?.decisions[idx]?.participant || ""}
                                  onChange={(e) => {
                                    const newDecisions = [...(editedMom?.decisions || [])];
                                    newDecisions[idx] = { ...newDecisions[idx], participant: e.target.value };
                                    setEditedMom({ ...editedMom!, decisions: newDecisions });
                                  }}
                                  className="w-full p-1 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  aria-label={`Edit decision ${idx + 1} participant`}
                                />
                              </p>
                            </>
                          ) : (
                            <>
                              <p>
                                <span className="font-medium">Decision:</span> {item.decision}
                              </p>
                              <p>
                                <span className="font-medium">Participant:</span> {item.participant}
                              </p>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}