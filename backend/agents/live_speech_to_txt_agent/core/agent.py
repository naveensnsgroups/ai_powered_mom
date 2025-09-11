
import os
import numpy as np
import soundfile as sf
import noisereduce as nr
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
import json
import re
import tempfile
import logging
from groq import Groq
from datetime import datetime

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain_core.runnables import RunnableSequence

# Setup logging
logger = logging.getLogger(__name__)

# ------------------ LOAD ENV VARIABLES ------------------ #
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GEMINI_API_KEY or not GROQ_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY or GROQ_API_KEY in environment variables")

# ------------------ INITIALIZE GROQ CLIENT ------------------ #
groq_client = Groq(api_key=GROQ_API_KEY)

# ------------------ LLM ------------------ #
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.2,
    verbose=True,
    api_key=GEMINI_API_KEY
)

# ------------------ ENHANCED PROMPT TEMPLATE ------------------ #
enhanced_mom_prompt = PromptTemplate(
    input_variables=["transcript"],
    template="""
You are an AI assistant that converts meeting transcripts into comprehensive structured JSON Minutes of Meeting.

Carefully analyze the transcript to extract:
1. Meeting participants and their roles
2. Key discussion points and decisions made
3. Action items with clear ownership and deadlines
4. Team decisions and consensus points
5. Follow-up tasks and responsibilities

Return JSON ONLY in this exact format:
{
  "meeting_info": {
    "date": "YYYY-MM-DD",
    "time": "estimated meeting time or duration",
    "meeting_type": "team meeting/project review/standup/other"
  },
  "attendance": {
    "participants": [
      {
        "name": "participant name",
        "role": "job title/role if mentioned",
        "attendance_status": "present/mentioned"
      }
    ],
    "total_participants": 0
  },
  "summary": {
    "overview": "brief 2-3 sentence summary",
    "detailed": "comprehensive meeting notes with key discussion points",
    "key_topics": ["topic1", "topic2", "topic3"]
  },
  "action_items": [
    {
      "id": 1,
      "task": "clear task description",
      "assigned_to": "participant name or team",
      "deadline": "YYYY-MM-DD or specific timeframe",
      "priority": "high/medium/low",
      "status": "assigned",
      "category": "development/design/testing/meeting/other"
    }
  ],
  "decisions": [
    {
      "id": 1,
      "decision": "clear decision statement",
      "rationale": "reasoning behind the decision",
      "impact": "what this affects",
      "responsible_party": "person/team responsible for implementation",
      "timeline": "when this takes effect"
    }
  ],
  "follow_up": {
    "next_meeting": "date/timeframe if mentioned",
    "pending_items": ["item1", "item2"],
    "required_approvals": ["approval1", "approval2"]
  },
  "risks_and_blockers": [
    {
      "issue": "description of risk/blocker",
      "severity": "high/medium/low",
      "owner": "person responsible for resolution"
    }
  ]
}

Instructions:
- If specific information isn't available, use appropriate defaults (e.g., "Not specified", "TBD")
- Extract participant names from the conversation context
- Identify clear action items even if not explicitly stated as such
- Look for decision points in discussions
- Infer meeting type from content (standup, project review, planning, etc.)
- Assign priority levels based on urgency indicators in speech
- Today's date is {current_date} - use this for date context

Transcript:
{transcript}
"""
)

# Update the mom_chain to use enhanced prompt
mom_chain = RunnableSequence(enhanced_mom_prompt | llm)

# ------------------ EXISTING FUNCTIONS (unchanged) ------------------ #
def transcribe_audio(file_path: str) -> Dict[str, str]:
    """Transcribe audio file using Groq Whisper."""
    try:
        with open(file_path, "rb") as audio_file:
            result = groq_client.audio.transcriptions.create(
                model="whisper-large-v3",
                file=audio_file
            )
        raw_text = result.text.strip()
        return {"transcript": clean_transcript(raw_text)}
    except Exception as e:
        logger.error(f"Transcription failed for {file_path}: {str(e)}")
        return {"transcript": "Transcription failed"}

def transcribe_chunk(audio_chunk: np.ndarray, sample_rate: int = 16000) -> str:
    """Transcribe a small audio chunk with enhanced filtering for Whisper artifacts."""
    try:
        if len(audio_chunk) == 0:
            logger.warning("Empty audio chunk received")
            return ""
        
        duration = len(audio_chunk) / sample_rate
        if duration < 0.5:
            logger.debug(f"Audio chunk too short ({duration:.2f}s), skipping transcription")
            return ""
        
        max_amplitude = np.max(np.abs(audio_chunk))
        rms_amplitude = np.sqrt(np.mean(audio_chunk ** 2))
        
        if max_amplitude < 0.01:
            logger.debug(f"Audio chunk too quiet (max: {max_amplitude:.4f}), skipping transcription")
            return ""
            
        if rms_amplitude < 0.005:
            logger.debug(f"Audio chunk appears silent (RMS: {rms_amplitude:.4f}), skipping transcription")
            return ""
        
        if max_amplitude < 0.1:
            audio_chunk = audio_chunk * (0.1 / max_amplitude)
            logger.debug(f"Normalized quiet audio (original max: {max_amplitude:.4f})")
        
        try:
            if duration > 1.0:
                reduced = nr.reduce_noise(
                    y=audio_chunk,
                    sr=sample_rate,
                    stationary=False,
                    prop_decrease=0.2,
                    n_std_thresh_stationary=3.0
                )
            else:
                reduced = audio_chunk
        except Exception as e:
            logger.warning(f"Noise reduction failed: {str(e)}, using original audio")
            reduced = audio_chunk

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
            sf.write(tmp_wav.name, reduced, sample_rate, subtype='PCM_16')
            temp_path = tmp_wav.name

        try:
            with open(temp_path, "rb") as audio_file:
                result = groq_client.audio.transcriptions.create(
                    model="whisper-large-v3",
                    file=audio_file,
                    response_format="text",
                    language="en",
                    prompt="This is a business meeting discussion with multiple participants talking about projects, deadlines, action items, and team decisions. Include participant names when mentioned."
                )
            
            text = result.strip() if isinstance(result, str) else result.text.strip()
            
            # Enhanced artifact filtering
            whisper_artifacts = [
                "Thank you.", "Thanks for watching.", "Bye.", "Goodbye.",
                "Please subscribe.", "Like and subscribe.", "[MUSIC]", 
                "[BLANK_AUDIO]", "[SILENCE]", "...", ". . .",
                "Thank you for watching.", "Thank you for listening.",
                "Thanks for watching", "Thank you watching", 
                "you", "You", "Uh", "Um", "Hmm", "Mm-hmm",
                "Subscribe to our channel", "Hit the bell icon",
                "Don't forget to like", "See you next time"
            ]
            
            words = text.split()
            if len(words) > 3:
                word_counts = {}
                for word in words:
                    word_counts[word] = word_counts.get(word, 0) + 1
                
                most_common_count = max(word_counts.values()) if word_counts else 0
                if most_common_count > len(words) * 0.7:
                    logger.warning(f"Detected repetitive text artifact: '{text}'")
                    return ""
            
            if text in whisper_artifacts or len(text.strip()) < 3:
                logger.debug(f"Filtered out artifact/short text: '{text}'")
                return ""
            
            for artifact in whisper_artifacts:
                if artifact.lower() in text.lower() and len(text.split()) <= 6:
                    logger.debug(f"Filtered out likely artifact: '{text}'")
                    return ""
            
            logger.info(f"Successfully transcribed: '{text}' (duration: {duration:.2f}s, max_amp: {max_amplitude:.4f})")
            return text
            
        except Exception as e:
            logger.error(f"Transcription failed: {str(e)}")
            return ""
            
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception as ex:
                    logger.warning(f"Failed to cleanup temp file {temp_path}: {str(ex)}")
                    
    except Exception as e:
        logger.error(f"Chunk transcription failed: {str(e)}")
        return ""

def clean_transcript(raw_text: str) -> str:
    """Use Gemini to fix grammar & punctuation while preserving participant names."""
    if not raw_text or len(raw_text.strip()) < 5:
        return raw_text
        
    try:
        prompt = f"""
        Fix grammar, punctuation, and unclear words in this transcript.
        IMPORTANT: Preserve participant names and speaking patterns.
        Keep the meaning faithful and don't add new information.
        If speaker transitions are unclear, maintain them as is.

        Transcript:
        {raw_text}
        """
        
        cleaned = llm.predict(prompt).strip()
        
        if not cleaned or len(cleaned) < len(raw_text) * 0.5:
            logger.warning("Transcript cleaning produced poor results, using original")
            return raw_text
            
        return cleaned
        
    except Exception as e:
        logger.warning(f"Transcript cleaning failed: {str(e)}, using original")
        return raw_text

# ------------------ ENHANCED MOM GENERATION ------------------ #
def generate_enhanced_mom(transcript: str) -> Dict[str, Any]:
    """Generate comprehensive structured MoM from transcript."""
    try:
        if not transcript or len(transcript.strip()) < 10:
            logger.warning("Transcript too short for MoM generation")
            return create_fallback_mom(transcript)
        
        # Add current date to prompt context
        current_date = datetime.now().strftime("%Y-%m-%d")
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response_text = mom_chain.invoke({
                    "transcript": transcript,
                    "current_date": current_date
                })
                
                if isinstance(response_text, str):
                    # Extract JSON from response
                    match = re.search(r"\{.*\}", response_text, re.DOTALL)
                    if match:
                        mom_data = json.loads(match.group())
                        
                        if validate_enhanced_mom_structure(mom_data):
                            # Post-process the data
                            mom_data = post_process_mom_data(mom_data)
                            return mom_data
                        else:
                            logger.warning(f"Invalid enhanced MoM structure (attempt {attempt + 1})")
                            
                elif isinstance(response_text, dict):
                    if validate_enhanced_mom_structure(response_text):
                        return post_process_mom_data(response_text)
                        
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parsing failed (attempt {attempt + 1}): {str(e)}")
            except Exception as e:
                logger.warning(f"Enhanced MoM generation attempt {attempt + 1} failed: {str(e)}")
        
        logger.warning("All enhanced MoM generation attempts failed, using fallback")
        return create_enhanced_fallback_mom(transcript)
        
    except Exception as e:
        logger.error(f"Enhanced MoM generation completely failed: {str(e)}")
        return create_enhanced_fallback_mom(transcript)

def validate_enhanced_mom_structure(mom_data: Dict[str, Any]) -> bool:
    """Validate enhanced MoM structure."""
    try:
        required_keys = ["meeting_info", "attendance", "summary", "action_items", "decisions", "follow_up"]
        if not all(key in mom_data for key in required_keys):
            logger.warning(f"Missing required keys. Expected: {required_keys}, Got: {list(mom_data.keys())}")
            return False
            
        # Validate meeting_info
        meeting_info = mom_data.get("meeting_info", {})
        if not isinstance(meeting_info, dict):
            return False
            
        # Validate attendance
        attendance = mom_data.get("attendance", {})
        if not isinstance(attendance, dict) or "participants" not in attendance:
            return False
            
        # Validate summary
        summary = mom_data.get("summary", {})
        if not isinstance(summary, dict) or "overview" not in summary:
            return False
            
        # Validate lists
        for list_key in ["action_items", "decisions"]:
            if not isinstance(mom_data.get(list_key), list):
                return False
                
        return True
        
    except Exception as e:
        logger.error(f"MoM structure validation failed: {str(e)}")
        return False

def post_process_mom_data(mom_data: Dict[str, Any]) -> Dict[str, Any]:
    """Post-process MoM data to ensure quality and consistency."""
    try:
        # Ensure participant count is accurate
        if "attendance" in mom_data and "participants" in mom_data["attendance"]:
            participant_count = len(mom_data["attendance"]["participants"])
            mom_data["attendance"]["total_participants"] = participant_count
        
        # Add IDs to action items if missing
        for i, item in enumerate(mom_data.get("action_items", []), 1):
            if "id" not in item:
                item["id"] = i
            if "status" not in item:
                item["status"] = "assigned"
            if "priority" not in item:
                item["priority"] = "medium"
        
        # Add IDs to decisions if missing
        for i, decision in enumerate(mom_data.get("decisions", []), 1):
            if "id" not in decision:
                decision["id"] = i
        
        # Ensure meeting info has current date if not specified
        if "meeting_info" in mom_data and "date" in mom_data["meeting_info"]:
            if not mom_data["meeting_info"]["date"] or mom_data["meeting_info"]["date"] == "Not specified":
                mom_data["meeting_info"]["date"] = datetime.now().strftime("%Y-%m-%d")
        
        return mom_data
        
    except Exception as e:
        logger.error(f"MoM post-processing failed: {str(e)}")
        return mom_data

def create_enhanced_fallback_mom(transcript: str) -> Dict[str, Any]:
    """Create enhanced fallback MoM structure when generation fails."""
    return {
        "meeting_info": {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "time": "Not specified",
            "meeting_type": "general meeting"
        },
        "attendance": {
            "participants": [],
            "total_participants": 0
        },
        "summary": {
            "overview": "Meeting transcript processed" if transcript else "No content available",
            "detailed": transcript[:500] + ("..." if len(transcript) > 500 else "") if transcript else "No transcript available",
            "key_topics": []
        },
        "action_items": [],
        "decisions": [],
        "follow_up": {
            "next_meeting": "TBD",
            "pending_items": [],
            "required_approvals": []
        },
        "risks_and_blockers": []
    }

# Update existing function names for backward compatibility
def generate_mom(transcript: str) -> Dict[str, Any]:
    """Legacy function - redirects to enhanced version."""
    return generate_enhanced_mom(transcript)

def create_fallback_mom(transcript: str) -> Dict[str, Any]:
    """Legacy function - redirects to enhanced version."""
    return create_enhanced_fallback_mom(transcript)

# ------------------ PIPELINE FUNCTIONS (updated) ------------------ #
def run_agent(file_path: str) -> Dict[str, Any]:
    """Full pipeline: Transcribe audio and generate enhanced MoM."""
    try:
        transcription_result = transcribe_audio(file_path)
        transcript = transcription_result["transcript"]
        mom = generate_enhanced_mom(transcript)
        return {"transcript": transcript, "mom": mom}
    except Exception as e:
        logger.error(f"Agent pipeline failed: {str(e)}")
        return {
            "transcript": "Pipeline failed",
            "mom": create_enhanced_fallback_mom("Pipeline failed")
        }

def run_live_agent(audio_chunks: List[np.ndarray], sample_rate: int = 16000) -> Dict[str, Any]:
    """Live pipeline with enhanced MoM generation."""
    try:
        logger.info(f"Processing {len(audio_chunks)} audio chunks")
        
        valid_chunks = []
        for i, chunk in enumerate(audio_chunks):
            if len(chunk) > 0 and np.max(np.abs(chunk)) > 0.001:
                valid_chunks.append(chunk)
            else:
                logger.debug(f"Skipping invalid chunk {i}")
        
        if not valid_chunks:
            logger.warning("No valid audio chunks found")
            return {
                "transcript": "",
                "mom": create_enhanced_fallback_mom("No valid audio content")
            }
        
        logger.info(f"Processing {len(valid_chunks)} valid chunks")
        
        transcripts = []
        successful_transcriptions = 0
        
        for i, chunk in enumerate(valid_chunks):
            try:
                text = transcribe_chunk(chunk, sample_rate)
                if text and len(text.strip()) > 2:
                    transcripts.append(text.strip())
                    successful_transcriptions += 1
                    logger.debug(f"Chunk {i+1}/{len(valid_chunks)} transcribed successfully")
                else:
                    logger.debug(f"Chunk {i+1}/{len(valid_chunks)} produced no meaningful text")
            except Exception as e:
                logger.warning(f"Chunk {i+1}/{len(valid_chunks)} transcription failed: {str(e)}")
        
        logger.info(f"Successfully transcribed {successful_transcriptions}/{len(valid_chunks)} chunks")
        
        if not transcripts:
            logger.warning("No successful transcriptions")
            return {
                "transcript": "",
                "mom": create_enhanced_fallback_mom("No transcribable audio content")
            }
        
        full_transcript = " ".join(transcripts)
        cleaned_transcript = clean_transcript(full_transcript)
        
        # Generate enhanced MoM
        mom = generate_enhanced_mom(cleaned_transcript)
        
        return {
            "transcript": cleaned_transcript,
            "mom": mom
        }
        
    except Exception as e:
        logger.error(f"Live agent pipeline failed: {str(e)}")
        return {
            "transcript": "Live processing failed",
            "mom": create_enhanced_fallback_mom(f"Live processing failed: {str(e)}")
        }