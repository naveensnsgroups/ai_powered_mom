"use client";

import { useRouter } from "next/navigation";
import { Mic, Radio, Zap, Clock, Globe, ArrowRight } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white px-6">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-6xl font-extrabold mb-4 bg-gradient-to-r from-blue-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
          AI Speech Tools
        </h1>
        <p className="text-slate-400 text-xl max-w-2xl">
          Convert speech to text with advanced AI technology
        </p>
      </div>

      {/* Buttons Container */}
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl">
        
        {/* Speech to Text Button */}
        <button
          onClick={() => router.push("/speech_to_txt_agent")}
          className="group flex-1 bg-gradient-to-br from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 rounded-2xl p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/25 border border-blue-500/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mr-4">
                <Mic className="w-6 h-6 text-blue-300" />
              </div>
              <h3 className="text-2xl font-bold">Speech to Text</h3>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-300 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-blue-100 leading-relaxed">
            Upload and convert your audio files to accurate text transcriptions
          </p>
        </button>

        {/* Live Speech to Text Button */}
        <button
          onClick={() => router.push("/live-speech-to-text")}
          className="group flex-1 bg-gradient-to-br from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 rounded-2xl p-8 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-emerald-500/25 border border-emerald-500/20"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mr-4 relative">
                <Radio className="w-6 h-6 text-emerald-300" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              </div>
              <h3 className="text-2xl font-bold">Live Speech to Text</h3>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-300 group-hover:translate-x-1 transition-transform" />
          </div>
          <p className="text-emerald-100 leading-relaxed">
            Real-time speech recognition with instant text conversion
          </p>
        </button>

      </div>

      {/* Footer */}
      <div className="mt-16 text-center">
        <div className="flex items-center justify-center gap-8 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>High Accuracy</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Fast Processing</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-green-400" />
            <span>Multi-language</span>
          </div>
        </div>
      </div>
    </main>
  );
}