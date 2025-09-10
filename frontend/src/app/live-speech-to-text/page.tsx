import LiveSpeechToText from "../../components/live-speech-to-text";

export default function LiveSpeechToTextPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-cyan-100">
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-6">
            🎙️ Live Speech-to-Text
          </h1>
          <LiveSpeechToText />
        </div>
      </main>
    </div>
  );
}
