import os
import whisper
import numpy as np
import soundfile as sf
import noisereduce as nr
from typing import Dict, Any
from dotenv import load_dotenv
import json
import re

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate

# ------------------ LOAD ENV VARIABLES ------------------ #
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in environment variables")

# ------------------ LOAD WHISPER ------------------ #
whisper_model = whisper.load_model("base")  # tiny, base, small, medium, large

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

Requirements:
1. Generate multi-level summaries:
   - High-level overview (brief)
   - Detailed notes (comprehensive)
2. Identify action items with participant tagging and deadlines.
3. Identify decisions with participant context.
4. Return JSON ONLY in this format:
{{
  "summary": {{
    "overview": "brief summary",
    "detailed": "detailed notes"
  }},
  "action_items": [
    {{
      "task": "task description",
      "assigned_to": "participant name",
      "deadline": "YYYY-MM-DD or N/A"
    }}
  ],
  "decisions": [
    {{
      "decision": "decision description",
      "participant": "person who decided or responsible"
    }}
  ]
}}

Transcript:
{transcript}
"""
)

# ------------------ LLM CHAIN ------------------ #
mom_chain = LLMChain(
    llm=llm,
    prompt=mom_prompt,
    verbose=True
)

# ------------------ OFFLINE TRANSCRIPTION ------------------ #
def transcribe_audio(file_path: str) -> Dict[str, str]:
    """Transcribe audio file using Whisper."""
    result = whisper_model.transcribe(file_path)
    return {"transcript": result.get("text", "")}

# ------------------ LIVE TRANSCRIPTION ------------------ #
def transcribe_chunk(audio_chunk: np.ndarray, sample_rate: int = 16000) -> str:
    """
    Transcribe a small audio chunk with noise reduction.
    - audio_chunk: numpy array of audio samples
    - sample_rate: Hz (default 16k for Whisper)
    """
    # Apply noise reduction
    reduced = nr.reduce_noise(y=audio_chunk, sr=sample_rate)

    # Save chunk temporarily
    temp_file = "temp_chunk.wav"
    sf.write(temp_file, reduced, sample_rate)

    # Run Whisper
    result = whisper_model.transcribe(temp_file)
    return result.get("text", "").strip()

# ------------------ MOM GENERATION ------------------ #
def generate_mom(transcript: str) -> Dict[str, Any]:
    """Generate structured MoM from transcript."""
    response_text = mom_chain.run(transcript=transcript)

    # Extract JSON from LLM response
    try:
        match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except Exception:
        pass

    # Fallback if parsing fails
    return {
        "summary": {"overview": response_text, "detailed": ""},
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
def run_live_agent(audio_chunks: list, sample_rate: int = 16000) -> Dict[str, Any]:
    """
    Live pipeline: Process multiple audio chunks and generate final MoM.
    - audio_chunks: list of numpy arrays of audio segments
    - sample_rate: sample rate of chunks
    """
    transcripts = []
    for chunk in audio_chunks:
        text = transcribe_chunk(chunk, sample_rate)
        if text:
            transcripts.append(text)

    full_transcript = " ".join(transcripts)
    mom = generate_mom(full_transcript)

    return {"transcript": full_transcript, "mom": mom}
