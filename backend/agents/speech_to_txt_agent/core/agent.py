
import os
import whisper
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from typing import Dict, Any
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

# ------------------ TOOLS ------------------ #
def transcribe_audio(file_path: str) -> Dict[str, str]:
    """Transcribe audio file using Whisper."""
    result = whisper_model.transcribe(file_path)
    return {"transcript": result.get("text", "")}

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

# ------------------ RUN AGENT ------------------ #
def run_agent(file_path: str) -> Dict[str, Any]:
    """Full pipeline: Transcribe audio and generate MoM."""
    transcription = transcribe_audio(file_path)["transcript"]
    mom = generate_mom(transcription)
    return {"transcript": transcription, "mom": mom}