
import os
import whisper
from langchain_google_genai import ChatGoogleGenerativeAI
from typing import Dict, Any
from pydub import AudioSegment
import tempfile
from dotenv import load_dotenv
import json
import re

# ------------------ LOAD ENV VARIABLES ------------------ #
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in environment variables")

# ------------------ LOAD WHISPER ------------------ #
whisper_model = whisper.load_model("base")  # tiny, base, small, medium, large

# ------------------ HELPER FUNCTIONS ------------------ #
def save_temp_file(file_bytes: bytes, suffix: str = ".wav") -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        return tmp.name

def validate_audio(file_bytes: bytes, min_size: int = 2000) -> bool:
    return len(file_bytes) >= min_size

def convert_to_wav(file_path: str) -> str:
    if file_path.endswith(".wav"):
        return file_path
    audio = AudioSegment.from_file(file_path)
    wav_path = file_path.rsplit(".", 1)[0] + ".wav"
    audio.export(wav_path, format="wav")
    return wav_path

# ------------------ LLM ------------------ #
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.2,
    verbose=True,
    api_key=GEMINI_API_KEY
)

# ------------------ TOOLS ------------------ #
def transcribe_audio(file_path: str) -> Dict[str, str]:
    result = whisper_model.transcribe(file_path)
    return {"transcript": result.get("text", "")}

def generate_mom(transcript: str) -> Dict[str, Any]:
    prompt = f"""
You are an AI assistant that converts meeting transcripts into structured JSON Minutes of Meeting.

Requirements:
1. Summary: brief key points
2. Action items: list of tasks with person and deadline
3. Decisions: list of decisions made

Return only valid JSON in this format:
{{
  "summary": "text",
  "action_items": ["task1", "task2"],
  "decisions": ["decision1", "decision2"]
}}

Transcript:
{transcript}
"""
    response = llm.invoke([{"role": "user", "content": prompt}])
    text = response.content

    # Extract JSON from LLM response
    try:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass

    # fallback if parsing fails
    return {"summary": text, "action_items": [], "decisions": []}

# ------------------ RUN AGENT ------------------ #
def run_agent(file_path: str) -> Dict[str, Any]:
    transcription = transcribe_audio(file_path)["transcript"]
    mom = generate_mom(transcription)
    return {"transcript": transcription, "mom": mom}
