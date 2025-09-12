
import os
import json
import re
import ast  # Added for parsing Python literal structures
from typing import Dict, Any
from dotenv import load_dotenv
import whisper
from langchain.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import LLMChain
from langchain.agents import initialize_agent, Tool

# ------------------ LOAD ENV ------------------ #
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in environment variables")

# ------------------ MODELS ------------------ #
# Whisper for transcription
whisper_model = whisper.load_model("base")  # tiny, base, small, medium, large

# Gemini for analysis
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.2,
    verbose=True,
    api_key=GEMINI_API_KEY
)

# ------------------ PROMPT ------------------ #
mom_prompt = PromptTemplate(
    input_variables=["transcript"],
    template="""
You are an AI meeting assistant.  
Analyze the transcript and return structured JSON with these fields:

{{
  "title": "Auto-generated meeting title",
  "summary": "Concise overview of discussion",
  "overview": "Context and agenda points",
  "attendees": ["list of attendees with roles if available"],
  "tasks": [
    {{
      "task": "description of the task",
      "assigned_to": "participant name",
      "deadline": "YYYY-MM-DD or N/A"
    }}
  ],
  "action_items": ["list of clear next steps"],
  "decisions": [
    {{
      "decision": "key decision made",
      "participant": "responsible/deciding person"
    }}
  ],
  "risks": ["list of risks, blockers, or challenges"],
  "data_points": ["list of metrics, numbers, or facts mentioned"]
}}

Transcript:
{transcript}
"""
)

# ------------------ CHAINS ------------------ #
mom_chain = LLMChain(
    llm=llm,
    prompt=mom_prompt,
    verbose=True
)

# ------------------ TOOLS ------------------ #
def transcribe_audio(file_path: str) -> Dict[str, str]:
    """Transcribe audio file to text using Whisper."""
    result = whisper_model.transcribe(file_path)
    return {"transcript": result.get("text", "")}

def extract_mom(transcript: str) -> Dict[str, Any]:
    """Extract structured MoM JSON from transcript using Gemini."""
    response_text = mom_chain.run(transcript=transcript)

    # Parse JSON safely
    try:
        match = re.search(r"\{.*\}", response_text, re.DOTALL)
        if match:
            # Use ast.literal_eval to parse Python-like dict with single quotes
            return ast.literal_eval(match.group())
    except Exception as e:
        return {"error": f"Failed to parse response: {str(e)}", "raw": response_text}

    return {"error": "Unexpected format", "raw": response_text}

tools = [
    Tool(
        name="MoMExtractor",
        func=extract_mom,
        description="Extracts structured Minutes of Meeting JSON from transcript"
    )
]

# ------------------ AGENT ------------------ #
agent = initialize_agent(
    tools=tools,
    llm=llm,
    agent="zero-shot-react-description",
    verbose=True,
    max_iterations=3
)

def run_agent(file_path: str) -> Dict[str, Any]:
    """
    Full pipeline:
    1. Transcribe audio file
    2. Extract structured MoM JSON
    """
    # Step 1: Transcribe
    transcript = transcribe_audio(file_path)["transcript"]

    # Step 2: Run agent with MoM extraction
    result = agent.run(
        f"Extract structured meeting minutes JSON from this transcript: {transcript}"
    )

    # Step 3: Ensure JSON return
    try:
        match = re.search(r"\{.*\}", result, re.DOTALL)
        if match:
            # Use ast.literal_eval to parse the extracted string as Python dict
            mom_json = ast.literal_eval(match.group())
        else:
            mom_json = {"error": "Parsing failed", "raw": result}
    except Exception as e:
        mom_json = {"error": f"Parsing exception: {str(e)}", "raw": result}

    return {"transcript": transcript, "mom": mom_json}