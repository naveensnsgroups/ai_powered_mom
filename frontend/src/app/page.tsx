import SpeechToTxtAgent from "../../src/app/speech_to_txt_agent/speech_to_txt_agent";

export default function SpeechToTxtPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-6">Speech-to-Text Agent</h1>
      <SpeechToTxtAgent />
    </main>
  );
}
