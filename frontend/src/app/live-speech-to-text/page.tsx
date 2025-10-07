
"use client";
import LiveSpeechToText from "../../components/live-speech-to-text";
import { Radio, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LiveSpeechToTextPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F9FAFB' }}>
      {/* Header Section */}
      <div className="bg-white border-b sticky top-0 z-10" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)' }}>
        <div className="max-w-6xl mx-auto px-6 py-5 relative">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center relative" style={{ backgroundColor: '#1E3A8A', boxShadow: '0 4px 12px rgba(30, 58, 138, 0.3)' }}>
              <Radio className="w-7 h-7 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#EF4444', boxShadow: '0 0 12px rgba(239, 68, 68, 0.6)' }}></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#1E3A8A' }}>Live Speech to Text Agent</h1>
              <p className="text-sm" style={{ color: '#6B7280' }}>Real-time speech recognition with instant conversion</p>
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
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border p-8" style={{ borderColor: '#E5E7EB', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)' }}>
          {/* Live Speech-to-Text Component Container */}
          <div className="bg-white rounded-xl border p-6" style={{ borderColor: '#E5E7EB', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
            <LiveSpeechToText />
          </div>
        </div>
      </main>
    </div>
  );
}