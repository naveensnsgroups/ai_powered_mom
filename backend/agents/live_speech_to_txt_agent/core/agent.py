

import os
import whisper
import numpy as np
import soundfile as sf
import noisereduce as nr
from typing import Dict, Any, List
from dotenv import load_dotenv
import json
import re
import tempfile

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain_core.runnables import RunnableSequence

# ------------------ LOAD ENV VARIABLES ------------------ #
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in environment variables")

# ------------------ LOAD WHISPER ------------------ #
# 👉 Upgrade to "medium" for better accuracy (tradeoff: slower)
whisper_model = whisper.load_model("medium")

# ------------------ LLM ------------------ #
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.2,
    verbose=True,
    api_key=GEMINI_API_KEY
)

# ------------------ PROMPT TEMPLATE ------------------ #
mom_prompt = PromptTemplate(
    input_variables=["transcript"],
    template="""
You are an AI assistant that converts meeting transcripts into structured JSON Minutes of Meeting.

Return JSON ONLY in this exact format:
{
  "summary": {
    "overview": "brief summary",
    "detailed": "detailed notes"
  },
  "action_items": [
    {
      "task": "task description",
      "assigned_to": "participant name",
      "deadline": "YYYY-MM-DD or N/A"
    }
  ],
  "decisions": [
    {
      "decision": "decision description",
      "participant": "person responsible"
    }
  ]
}

Transcript:
{transcript}
"""
)

# ------------------ Runnable Chain (no deprecation) ------------------ #
mom_chain = RunnableSequence(mom_prompt | llm)

# ------------------ OFFLINE TRANSCRIPTION ------------------ #
def transcribe_audio(file_path: str) -> Dict[str, str]:
    """Transcribe audio file using Whisper."""
    result = whisper_model.transcribe(file_path, condition_on_previous_text=False)
    raw_text = result.get("text", "").strip()
    return {"transcript": clean_transcript(raw_text)}

# ------------------ LIVE TRANSCRIPTION ------------------ #
def transcribe_chunk(audio_chunk: np.ndarray, sample_rate: int = 16000) -> str:
    """
    Transcribe a small audio chunk with noise reduction.
    """
    # Apply noise reduction
    reduced = nr.reduce_noise(y=audio_chunk, sr=sample_rate)

    # Save to temporary WAV
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
        sf.write(tmp_wav.name, reduced, sample_rate)
        temp_path = tmp_wav.name

    try:
        # Whisper transcription
        result = whisper_model.transcribe(temp_path, condition_on_previous_text=False)
        raw_text = result.get("text", "").strip()
        return raw_text
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

# ------------------ TRANSCRIPT CLEANUP ------------------ #
def clean_transcript(raw_text: str) -> str:
    """
    Use Gemini to fix grammar & punctuation.
    """
    if not raw_text:
        return ""
    try:
        prompt = f"""
        Fix grammar, punctuation, and unclear words.
        Keep the meaning faithful.

        Transcript:
        {raw_text}
        """
        return llm.predict(prompt).strip()
    except Exception:
        return raw_text  # fallback

# ------------------ MOM GENERATION ------------------ #
def generate_mom(transcript: str) -> Dict[str, Any]:
    """Generate structured MoM from transcript."""
    try:
        response_text = mom_chain.invoke({"transcript": transcript})
        if isinstance(response_text, str):
            # Extract JSON
            match = re.search(r"\{.*\}", response_text, re.DOTALL)
            if match:
                return json.loads(match.group())
        elif isinstance(response_text, dict):
            return response_text
    except Exception as e:
        print("MoM parsing error:", e)

    # Fallback
    return {
        "summary": {"overview": transcript[:100], "detailed": transcript},
        "action_items": [],
        "decisions": []
    }

# ------------------ PIPELINE (OFFLINE FULL FILE) ------------------ #
def run_agent(file_path: str) -> Dict[str, Any]:
    """Full pipeline: Transcribe audio and generate MoM."""
    transcription = transcribe_audio(file_path)["transcript"]
    mom = generate_mom(transcription)
    return {"transcript": transcription, "mom": mom}

# ------------------ PIPELINE (LIVE) ------------------ #
def run_live_agent(audio_chunks: List[np.ndarray], sample_rate: int = 16000) -> Dict[str, Any]:
    """
    Live pipeline: Process multiple audio chunks and generate final MoM.
    """
    transcripts = []
    for chunk in audio_chunks:
        text = transcribe_chunk(chunk, sample_rate)
        if text:
            transcripts.append(text)

    full_transcript = " ".join(transcripts)
    # 👉 Clean once at the end (faster, cheaper)
    cleaned = clean_transcript(full_transcript)
    mom = generate_mom(cleaned)

    return {"transcript": cleaned, "mom": mom}
