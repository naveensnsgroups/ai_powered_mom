
"use client";

import { useRouter } from "next/navigation";
import { Mic, Radio, ArrowRight, Sparkles } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-6 py-12" style={{ backgroundColor: '#F9FAFB' }}>
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(30, 58, 138, 0.1) 0%, transparent 70%)' }}></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(30, 58, 138, 0.08) 0%, transparent 70%)' }}></div>
      </div>

      {/* Header */}
      <div className="text-center mb-16 relative z-10">
        <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full border-2" style={{ backgroundColor: 'white', borderColor: '#1E3A8A', color: '#1E3A8A' }}>
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-semibold">AI Agents</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-4" style={{ color: '#1E3A8A', lineHeight: '1.2' }}>
          AI Speech Tools
        </h1>
        <p className="text-lg md:text-xl max-w-2xl mx-auto" style={{ color: '#6B7280' }}>
          Transform your voice into text
        </p>
      </div>

      {/* Buttons Container */}
      <div className="flex flex-col md:flex-row gap-6 w-full max-w-6xl relative z-10">

        {/* Speech to Text Button */}
        <button
          onClick={() => router.push("/speech_to_txt_agent")}
          className="group flex-1 rounded-2xl p-8 md:p-10 text-left transition-all duration-300 bg-white border-2 relative overflow-hidden"
          style={{
            borderColor: '#E5E7EB',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#1E3A8A';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(30, 58, 138, 0.12)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {/* Gradient Overlay on Hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)' }}></div>

          <div className="relative">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: '#1E3A8A', boxShadow: '0 4px 12px rgba(30, 58, 138, 0.3)' }}>
                  <Mic className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: '#1E3A8A' }}>Speech to Text</h3>
                  <span className="text-sm font-medium px-3 py-1 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1E3A8A' }}>Audio Upload</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-1" style={{ backgroundColor: '#EFF6FF' }}>
                <ArrowRight className="w-5 h-5" style={{ color: '#1E3A8A' }} />
              </div>
            </div>
            <p className="text-base leading-relaxed" style={{ color: '#6B7280' }}>
              Upload and convert your audio files to accurate text transcriptions with advanced AI processing
            </p>
          </div>
        </button>

        {/* Live Speech to Text Button */}
        <button
          onClick={() => router.push("/live-speech-to-text")}
          className="group flex-1 rounded-2xl p-8 md:p-10 text-left transition-all duration-300 bg-white border-2 relative overflow-hidden"
          style={{
            borderColor: '#E5E7EB',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.05)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#1E3A8A';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(30, 58, 138, 0.12)';
            e.currentTarget.style.transform = 'translateY(-4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.05)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {/* Gradient Overlay on Hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)' }}></div>

          <div className="relative">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: '#1E3A8A', boxShadow: '0 4px 12px rgba(30, 58, 138, 0.3)' }}>
                  <Radio className="w-8 h-8 text-white" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: '#EF4444', boxShadow: '0 0 12px rgba(239, 68, 68, 0.6)' }}></div>
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: '#1E3A8A' }}>Live Speech to Text</h3>
                  <span className="text-sm font-medium px-3 py-1 rounded-full inline-flex items-center gap-1" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#EF4444' }}></span>
                    Real-time
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:translate-x-1" style={{ backgroundColor: '#EFF6FF' }}>
                <ArrowRight className="w-5 h-5" style={{ color: '#1E3A8A' }} />
              </div>
            </div>
            <p className="text-base leading-relaxed" style={{ color: '#6B7280' }}>
              Real time speech recognition with instant text conversion as you speak
            </p>
          </div>
        </button>

      </div>
    </main>
  );
}