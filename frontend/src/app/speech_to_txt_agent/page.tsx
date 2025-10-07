"use client";

import SpeechToTxtAgent from "../../components/speech_to_txt_agent";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SpeechToTxtPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F9FAFB' }}>
      {/* Header Section */}
      <div className="bg-white border-b sticky top-0 z-10" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
        <div className="max-w-6xl mx-auto px-6 py-5 relative">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1E3A8A', boxShadow: '0 4px 12px rgba(30, 58, 138, 0.3)' }}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#1E3A8A' }}>Speech to Text Agent</h1>
              <p className="text-sm" style={{ color: '#6B7280' }}>Convert your voice into text with AI precision</p>
            </div>
          </div>

          {/* Back Button */}
          <button
            onClick={() => router.push("/")}
            className="absolute top-1/2 right-6 -translate-y-1/2 flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:scale-105"
            style={{
              backgroundColor: '#1E3A8A',
              color: 'white',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1e40af';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(30, 58, 138, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1E3A8A';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-5">

        {/* Speech-to-Text Component Container */}
        <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
          <SpeechToTxtAgent />
        </div>

      </main>
    </div>
  );
}