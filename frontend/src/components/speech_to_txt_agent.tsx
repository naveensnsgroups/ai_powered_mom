
"use client";

import { useState, FormEvent } from "react";
import { toast } from "react-toastify";

// Define types to match backend response
interface ActionItem {
  task: string;
  assigned_to: string;
  deadline: string;
}

interface Decision {
  decision: string;
  participant: string;
}

interface MoMType {
  title: string;
  summary: { overview: string; detailed: string } | string;
  overview: string;
  attendees: string[];
  tasks: ActionItem[];
  action_items: string[];
  decisions: Decision[];
  risks: string[];
  data_points: string[];
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
      console.log("API Response:", JSON.stringify(response, null, 2));

      setTranscript(response.transcript || "⚠️ No transcript received.");
      setEditedTranscript(response.transcript || "");

      // Normalize MoM data
      const normalizedMom: MoMType = {
        title: response.mom?.title || "No title provided",
        summary: typeof response.mom?.summary === "string"
          ? { overview: response.mom.summary, detailed: "" }
          : response.mom?.summary || { overview: "No overview provided", detailed: "No detailed summary provided" },
        overview: response.mom?.overview || "No overview provided",
        attendees: Array.isArray(response.mom?.attendees) ? response.mom.attendees : [],
        tasks: Array.isArray(response.mom?.tasks) ? response.mom.tasks : [],
        action_items: Array.isArray(response.mom?.action_items) ? response.mom.action_items : [],
        decisions: Array.isArray(response.mom?.decisions) ? response.mom.decisions : [],
        risks: Array.isArray(response.mom?.risks) ? response.mom.risks : [],
        data_points: Array.isArray(response.mom?.data_points) ? response.mom.data_points : [],
      };

      // Check if MoM is mostly empty
      const isMomEmpty = !response.mom?.title ||
        (typeof response.mom?.summary === "string" ? !response.mom.summary : !response.mom?.summary?.overview) &&
        !response.mom?.overview &&
        response.mom?.attendees?.length === 0 &&
        response.mom?.tasks?.length === 0 &&
        response.mom?.action_items?.length === 0 &&
        response.mom?.decisions?.length === 0 &&
        response.mom?.risks?.length === 0 &&
        response.mom?.data_points?.length === 0;

      if (isMomEmpty) {
        toast.warn("Received empty or default MoM data from backend. Please check the server logs.");
      }

      console.log("Normalized MoM:", JSON.stringify(normalizedMom, null, 2));
      setMom(normalizedMom);
      setEditedMom({ ...normalizedMom });
      setExportFilePath(response.export_file);
      toast.success("Transcription and MoM generated successfully!");
    } catch (err: any) {
      const errorMsg = err.message || "Error processing audio. Please try again.";
      setError(errorMsg);
      toast.error(errorMsg);
      console.error("Upload error:", err);
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
          if (!isEdited) setExportFilePath(null);
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
      console.error("Download error:", err);
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

  // Handle adding a new task
  const handleAddTask = () => {
    if (!editedMom) return;
    const newTask: ActionItem = { task: "", assigned_to: "", deadline: "" };
    setEditedMom({ ...editedMom, tasks: [...editedMom.tasks, newTask] });
  };

  // Handle removing a task
  const handleRemoveTask = (index: number) => {
    if (!editedMom) return;
    const newTasks = editedMom.tasks.filter((_, i) => i !== index);
    setEditedMom({ ...editedMom, tasks: newTasks });
  };

  // Handle adding a new decision
  const handleAddDecision = () => {
    if (!editedMom) return;
    const newDecision: Decision = { decision: "", participant: "" };
    setEditedMom({ ...editedMom, decisions: [...editedMom.decisions, newDecision] });
  };

  // Handle removing a decision
  const handleRemoveDecision = (index: number) => {
    if (!editedMom) return;
    const newDecisions = editedMom.decisions.filter((_, i) => i !== index);
    setEditedMom({ ...editedMom, decisions: newDecisions });
  };

  // Handle re-export of edited MoM
  const handleReExport = async (format: "pdf" | "docx") => {
    if (!editedMom) {
      toast.error("No MoM data available for export.");
      return;
    }

    setDownloadLoading(true);
    setError(null);
    toast.info(`Exporting edited MoM as ${format.toUpperCase()}...`);

    try {
      const response = await fetch("http://localhost:8000/speech-to-text/export-edited", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mom: editedMom, export_format: format }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.detail || "Failed to export edited MoM";
        throw new Error(errorMsg);
      }

      const { export_file } = await response.json();
      await handleDownload(export_file, format, true);
    } catch (err: any) {
      const errorMsg = err.message || "Error exporting edited MoM. Please try again.";
      setError(errorMsg);
      toast.error(errorMsg);
      console.error("Export error:", err);
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
    <div className="w-full space-y-6">
      {/* File Upload Section */}
      <div className="bg-white border rounded-xl p-6" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#1E3A8A' }}>
            <svg
              className="w-6 h-6 text-white"
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
            <h3 className="font-semibold" style={{ color: '#1E3A8A' }}>Upload Audio File</h3>
            <p className="text-sm" style={{ color: '#6B7280' }}>Drag and drop or click to browse</p>
          </div>
        </div>

        <div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200`}
          style={{
            borderColor: dragActive ? '#1E3A8A' : '#D1D5DB',
            backgroundColor: dragActive ? '#EFF6FF' : '#F9FAFB'
          }}
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
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                <svg
                  className="w-8 h-8"
                  style={{ color: '#1E3A8A' }}
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
                <p className="font-medium" style={{ color: '#374151' }}>Drop your audio file here</p>
                <p className="text-sm" style={{ color: '#6B7280' }}>Supports MP3, WAV, MP4 (max 50MB)</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: '#D1FAE5' }}>
                <svg
                  className="w-8 h-8"
                  style={{ color: '#059669' }}
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
                <p className="font-medium" style={{ color: '#1F2937' }}>{file.name}</p>
                <p className="text-sm" style={{ color: '#6B7280' }}>{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-sm font-medium disabled:cursor-not-allowed"
                style={{ color: '#DC2626' }}
                disabled={loading || downloadLoading}
              >
                Remove file
              </button>
            </div>
          )}
        </div>

        {/* Export Format Selection */}
        {/* <div className="mt-4">
          <label htmlFor="exportFormat" className="block text-sm font-medium mb-1" style={{ color: '#374151' }}>
            Export Format
          </label>
          <select
            id="exportFormat"
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as "none" | "pdf" | "docx")}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:outline-none disabled:bg-gray-100"
            style={{ borderColor: '#D1D5DB', color: '#374151' }}
            disabled={loading || downloadLoading}
            aria-label="Select export format"
          >
            <option value="none">None</option>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
          </select>
        </div> */}

        {/* Error Message */}
        {error && (
          <div className="mt-4 p-3 rounded-lg text-sm border" style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', color: '#991B1B' }}>
            {error}
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || loading || downloadLoading}
          className="w-full mt-4 py-3 px-6 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center space-x-2"
          style={{
            backgroundColor: !file || loading || downloadLoading ? '#9CA3AF' : '#1E3A8A',
            cursor: !file || loading || downloadLoading ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={(e) => {
            if (!(!file || loading || downloadLoading)) {
              e.currentTarget.style.backgroundColor = '#1e40af';
            }
          }}
          onMouseLeave={(e) => {
            if (!(!file || loading || downloadLoading)) {
              e.currentTarget.style.backgroundColor = '#1E3A8A';
            }
          }}
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
        <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
          <div className="px-6 py-3 border-b flex items-center justify-between" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
            <h3 className="font-semibold" style={{ color: '#1E3A8A' }}>Transcript</h3>
            <button
              onClick={handleEditToggle}
              className="py-1 px-3 text-white text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
              style={{ backgroundColor: loading || downloadLoading ? '#9CA3AF' : '#1E3A8A' }}
              disabled={loading || downloadLoading}
              aria-label={isEditing ? "Cancel Editing" : "Edit Transcript"}
              onMouseEnter={(e) => {
                if (!(loading || downloadLoading)) {
                  e.currentTarget.style.backgroundColor = '#1e40af';
                }
              }}
              onMouseLeave={(e) => {
                if (!(loading || downloadLoading)) {
                  e.currentTarget.style.backgroundColor = '#1E3A8A';
                }
              }}
            >
              {isEditing ? "Cancel" : "Edit"}
            </button>
          </div>
          <div className="p-6">
            {isEditing ? (
              <textarea
                value={editedTranscript}
                onChange={(e) => setEditedTranscript(e.target.value)}
                className="w-full p-2 border rounded-lg focus:ring-2 focus:outline-none"
                style={{ borderColor: '#D1D5DB' }}
                rows={10}
                aria-label="Edit transcript"
              />
            ) : (
              <p className="leading-relaxed whitespace-pre-wrap" style={{ color: '#374151' }}>{transcript}</p>
            )}
          </div>
        </div>
      )}

      {/* MoM Section */}
      {mom && (
        <div className="bg-white border rounded-xl overflow-hidden" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
          <div className="px-6 py-3 border-b flex items-center justify-between" style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}>
            <h3 className="font-semibold" style={{ color: '#1E3A8A' }}>Minutes of Meeting (MoM)</h3>
            <div className="flex space-x-2">
              <button
                onClick={handleEditToggle}
                className="py-1 px-3 text-white text-sm font-medium rounded-lg transition-colors"
                style={{ backgroundColor: downloadLoading ? '#9CA3AF' : '#1E3A8A' }}
                disabled={downloadLoading}
                onMouseEnter={(e) => {
                  if (!downloadLoading) {
                    e.currentTarget.style.backgroundColor = '#1e40af';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!downloadLoading) {
                    e.currentTarget.style.backgroundColor = '#1E3A8A';
                  }
                }}
              >
                {isEditing ? "Cancel" : "Edit"}
              </button>
              {isEditing && (
                <button
                  onClick={handleSave}
                  className="py-1 px-3 text-white text-sm font-medium rounded-lg transition-colors"
                  style={{ backgroundColor: downloadLoading ? '#9CA3AF' : '#059669' }}
                  disabled={downloadLoading}
                  onMouseEnter={(e) => {
                    if (!downloadLoading) {
                      e.currentTarget.style.backgroundColor = '#047857';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!downloadLoading) {
                      e.currentTarget.style.backgroundColor = '#059669';
                    }
                  }}
                >
                  Save
                </button>
              )}
              {exportFilePath && !isEditing && (
                <button
                  onClick={() => handleDownload(exportFilePath, exportFormat)}
                  className="py-1 px-3 text-white text-sm font-medium rounded-lg transition-colors"
                  style={{ backgroundColor: downloadLoading ? '#9CA3AF' : '#1E3A8A' }}
                  disabled={downloadLoading}
                  onMouseEnter={(e) => {
                    if (!downloadLoading) {
                      e.currentTarget.style.backgroundColor = '#1e40af';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!downloadLoading) {
                      e.currentTarget.style.backgroundColor = '#1E3A8A';
                    }
                  }}
                >
                  Download {exportFormat.toUpperCase()}
                </button>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={() => handleReExport("pdf")}
                    className="py-1 px-3 text-white text-sm font-medium rounded-lg transition-colors"
                    style={{ backgroundColor: downloadLoading ? '#9CA3AF' : '#1E3A8A' }}
                    disabled={downloadLoading}
                    onMouseEnter={(e) => {
                      if (!downloadLoading) {
                        e.currentTarget.style.backgroundColor = '#1e40af';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!downloadLoading) {
                        e.currentTarget.style.backgroundColor = '#1E3A8A';
                      }
                    }}
                  >
                    Export as PDF
                  </button>
                  <button
                    onClick={() => handleReExport("docx")}
                    className="py-1 px-3 text-white text-sm font-medium rounded-lg transition-colors"
                    style={{ backgroundColor: downloadLoading ? '#9CA3AF' : '#1E3A8A' }}
                    disabled={downloadLoading}
                    onMouseEnter={(e) => {
                      if (!downloadLoading) {
                        e.currentTarget.style.backgroundColor = '#1e40af';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!downloadLoading) {
                        e.currentTarget.style.backgroundColor = '#1E3A8A';
                      }
                    }}
                  >
                    Export as DOCX
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <h4 className="font-semibold mb-2" style={{ color: '#1E3A8A' }}>Title</h4>
              {isEditing ? (
                <input
                  type="text"
                  value={editedMom?.title || ""}
                  onChange={(e) =>
                    setEditedMom({ ...editedMom!, title: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:outline-none"
                  style={{ borderColor: '#D1D5DB' }}
                />
              ) : (
                <p style={{ color: '#374151' }}>{mom.title}</p>
              )}
            </div>

            {/* Summary */}
            <div>
              <h4 className="font-semibold mb-2" style={{ color: '#1E3A8A' }}>Summary</h4>
              {isEditing ? (
                <>
                  <label className="block font-medium text-sm mb-1" style={{ color: '#374151' }}>Overview</label>
                  <textarea
                    value={typeof editedMom?.summary === "string" ? editedMom.summary : editedMom?.summary?.overview || ""}
                    onChange={(e) =>
                      setEditedMom({
                        ...editedMom!,
                        summary: typeof editedMom?.summary === "string"
                          ? e.target.value
                          : { ...editedMom!.summary, overview: e.target.value },
                      })
                    }
                    rows={3}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:outline-none"
                    style={{ borderColor: '#D1D5DB' }}
                  />
                  <label className="block font-medium text-sm mt-2 mb-1" style={{ color: '#374151' }}>Detailed</label>
                  <textarea
                    value={typeof editedMom?.summary === "string" ? "" : editedMom?.summary?.detailed || ""}
                    onChange={(e) =>
                      setEditedMom({
                        ...editedMom!,
                        summary: typeof editedMom?.summary === "string"
                          ? { overview: editedMom.summary, detailed: e.target.value }
                          : { ...editedMom!.summary, detailed: e.target.value },
                      })
                    }
                    rows={3}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:outline-none"
                    style={{ borderColor: '#D1D5DB' }}
                  />
                </>
              ) : (
                <div className="whitespace-pre-wrap" style={{ color: '#374151' }}>
                  <p><strong>Overview:</strong> {typeof mom.summary === "string" ? mom.summary : mom.summary?.overview || "No overview provided"}</p>
                  <p><strong>Detailed:</strong> {typeof mom.summary === "string" ? "No detailed summary provided" : mom.summary?.detailed || "No detailed summary provided"}</p>
                </div>
              )}
            </div>

            {/* Overview */}
            <div>
              <h4 className="font-semibold mb-2" style={{ color: '#1E3A8A' }}>Overview</h4>
              {isEditing ? (
                <textarea
                  value={editedMom?.overview || ""}
                  onChange={(e) =>
                    setEditedMom({ ...editedMom!, overview: e.target.value })
                  }
                  rows={4}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:outline-none"
                  style={{ borderColor: '#D1D5DB' }}
                />
              ) : (
                <p className="whitespace-pre-wrap" style={{ color: '#374151' }}>{mom.overview || "No overview provided"}</p>
              )}
            </div>

            {/* Attendees */}
            <div>
              <h4 className="font-semibold mb-2" style={{ color: '#1E3A8A' }}>Attendees</h4>
              {isEditing ? (
                <textarea
                  value={editedMom?.attendees.join("\n") || ""}
                  onChange={(e) =>
                    setEditedMom({
                      ...editedMom!,
                      attendees: e.target.value.split("\n").filter(Boolean),
                    })
                  }
                  rows={Math.max(editedMom?.attendees.length || 3, 3)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:outline-none"
                  style={{ borderColor: '#D1D5DB' }}
                />
              ) : (
                <ul className="list-disc pl-5" style={{ color: '#374151' }}>
                  {mom.attendees.length > 0 ? (
                    mom.attendees.map((att, idx) => (
                      <li key={idx}>{att}</li>
                    ))
                  ) : (
                    <li>No attendees listed</li>
                  )}
                </ul>
              )}
            </div>

            {/* Tasks */}
            <div>
              <h4 className="font-semibold mb-2" style={{ color: '#1E3A8A' }}>Tasks</h4>
              {isEditing && (
                <button
                  onClick={handleAddTask}
                  className="mb-2 py-1 px-3 text-white text-sm font-medium rounded-lg transition-colors"
                  style={{ backgroundColor: '#059669' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#047857'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                >
                  Add Task
                </button>
              )}
              <ul className="list-decimal pl-5 space-y-2" style={{ color: '#374151' }}>
                {mom.tasks.length > 0 ? (
                  mom.tasks.map((task, idx) => (
                    <li key={idx}>
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={editedMom?.tasks[idx]?.task || ""}
                            onChange={(e) => {
                              const newTasks = [...(editedMom?.tasks || [])];
                              newTasks[idx] = { ...newTasks[idx], task: e.target.value };
                              setEditedMom({ ...editedMom!, tasks: newTasks });
                            }}
                            className="w-full p-1 border rounded-lg focus:ring-2 focus:outline-none"
                            style={{ borderColor: '#D1D5DB' }}
                            placeholder="Task"
                          />
                          <input
                            type="text"
                            value={editedMom?.tasks[idx]?.assigned_to || ""}
                            onChange={(e) => {
                              const newTasks = [...(editedMom?.tasks || [])];
                              newTasks[idx] = { ...newTasks[idx], assigned_to: e.target.value };
                              setEditedMom({ ...editedMom!, tasks: newTasks });
                            }}
                            className="w-full p-1 border rounded-lg focus:ring-2 focus:outline-none"
                            style={{ borderColor: '#D1D5DB' }}
                            placeholder="Assigned to"
                          />
                          <input
                            type="text"
                            value={editedMom?.tasks[idx]?.deadline || ""}
                            onChange={(e) => {
                              const newTasks = [...(editedMom?.tasks || [])];
                              newTasks[idx] = { ...newTasks[idx], deadline: e.target.value };
                              setEditedMom({ ...editedMom!, tasks: newTasks });
                            }}
                            className="w-full p-1 border rounded-lg focus:ring-2 focus:outline-none"
                            style={{ borderColor: '#D1D5DB' }}
                            placeholder="Deadline (YYYY-MM-DD)"
                          />
                          <button
                            onClick={() => handleRemoveTask(idx)}
                            className="py-1 px-2 text-white text-sm font-medium rounded-lg transition-colors"
                            style={{ backgroundColor: '#DC2626' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <p>
                          <strong>{task.task}</strong> - {task.assigned_to} (Deadline: {task.deadline})
                        </p>
                      )}
                    </li>
                  ))
                ) : (
                  <li>No tasks assigned</li>
                )}
              </ul>
            </div>

            {/* Action Items */}
            <div>
              <h4 className="font-semibold mb-2" style={{ color: '#1E3A8A' }}>Action Items</h4>
              {isEditing ? (
                <textarea
                  value={editedMom?.action_items.join("\n") || ""}
                  onChange={(e) =>
                    setEditedMom({
                      ...editedMom!,
                      action_items: e.target.value.split("\n").filter(Boolean),
                    })
                  }
                  rows={Math.max(editedMom?.action_items.length || 3, 3)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:outline-none"
                  style={{ borderColor: '#D1D5DB' }}
                />
              ) : (
                <ul className="list-disc pl-5" style={{ color: '#374151' }}>
                  {mom.action_items.length > 0 ? (
                    mom.action_items.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))
                  ) : (
                    <li>No action items listed</li>
                  )}
                </ul>
              )}
            </div>

            {/* Decisions */}
            <div>
              <h4 className="font-semibold mb-2" style={{ color: '#1E3A8A' }}>Decisions</h4>
              {isEditing && (
                <button
                  onClick={handleAddDecision}
                  className="mb-2 py-1 px-3 text-white text-sm font-medium rounded-lg transition-colors"
                  style={{ backgroundColor: '#059669' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#047857'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                >
                  Add Decision
                </button>
              )}
              <ul className="list-disc pl-5" style={{ color: '#374151' }}>
                {mom.decisions.length > 0 ? (
                  mom.decisions.map((decision, idx) => (
                    <li key={idx}>
                      {isEditing ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={editedMom?.decisions[idx]?.decision || ""}
                            onChange={(e) => {
                              const newDecisions = [...(editedMom?.decisions || [])];
                              newDecisions[idx] = { ...newDecisions[idx], decision: e.target.value };
                              setEditedMom({ ...editedMom!, decisions: newDecisions });
                            }}
                            className="w-full p-1 border rounded-lg focus:ring-2 focus:outline-none"
                            style={{ borderColor: '#D1D5DB' }}
                            placeholder="Decision"
                          />
                          <input
                            type="text"
                            value={editedMom?.decisions[idx]?.participant || ""}
                            onChange={(e) => {
                              const newDecisions = [...(editedMom?.decisions || [])];
                              newDecisions[idx] = { ...newDecisions[idx], participant: e.target.value };
                              setEditedMom({ ...editedMom!, decisions: newDecisions });
                            }}
                            className="w-full p-1 border rounded-lg focus:ring-2 focus:outline-none"
                            style={{ borderColor: '#D1D5DB' }}
                            placeholder="Participant"
                          />
                          <button
                            onClick={() => handleRemoveDecision(idx)}
                            className="py-1 px-2 text-white text-sm font-medium rounded-lg transition-colors"
                            style={{ backgroundColor: '#DC2626' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <p>
                          {decision.decision} - {decision.participant}
                        </p>
                      )}
                    </li>
                  ))
                ) : (
                  <li>No decisions recorded</li>
                )}
              </ul>
            </div>

            {/* Risks */}
            <div>
              <h4 className="font-semibold mb-2" style={{ color: '#1E3A8A' }}>Risks</h4>
              {isEditing ? (
                <textarea
                  value={editedMom?.risks.join("\n") || ""}
                  onChange={(e) =>
                    setEditedMom({
                      ...editedMom!,
                      risks: e.target.value.split("\n").filter(Boolean),
                    })
                  }
                  rows={Math.max(editedMom?.risks.length || 3, 3)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:outline-none"
                  style={{ borderColor: '#D1D5DB' }}
                />
              ) : (
                <ul className="list-disc pl-5" style={{ color: '#DC2626' }}>
                  {mom.risks.length > 0 ? (
                    mom.risks.map((risk, idx) => (
                      <li key={idx}>{risk}</li>
                    ))
                  ) : (
                    <li>No risks identified</li>
                  )}
                </ul>
              )}
            </div>

            {/* Data Points */}
            <div>
              <h4 className="font-semibold mb-2" style={{ color: '#1E3A8A' }}>Data Points</h4>
              {isEditing ? (
                <textarea
                  value={editedMom?.data_points.join("\n") || ""}
                  onChange={(e) =>
                    setEditedMom({
                      ...editedMom!,
                      data_points: e.target.value.split("\n").filter(Boolean),
                    })
                  }
                  rows={Math.max(editedMom?.data_points.length || 3, 3)}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:outline-none"
                  style={{ borderColor: '#D1D5DB' }}
                />
              ) : (
                <ul className="list-disc pl-5" style={{ color: '#374151' }}>
                  {mom.data_points.length > 0 ? (
                    mom.data_points.map((dp, idx) => (
                      <li key={idx}>{dp}</li>
                    ))
                  ) : (
                    <li>No data points provided</li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}