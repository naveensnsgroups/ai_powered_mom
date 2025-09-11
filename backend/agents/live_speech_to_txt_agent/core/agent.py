
# agent.py
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

# ------------------ Runnable Chain ------------------ #
mom_chain = RunnableSequence(mom_prompt | llm)

# ------------------ OFFLINE TRANSCRIPTION (GROQ) ------------------ #
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

# ------------------ LIVE TRANSCRIPTION (GROQ) ------------------ #
# Updated transcribe_chunk function in agent.py
def transcribe_chunk(audio_chunk: np.ndarray, sample_rate: int = 16000) -> str:
    """
    Transcribe a small audio chunk with enhanced filtering for Whisper artifacts.
    """
    try:
        # Validate input
        if len(audio_chunk) == 0:
            logger.warning("Empty audio chunk received")
            return ""
        
        # Check duration - require at least 0.5 seconds
        duration = len(audio_chunk) / sample_rate
        if duration < 0.5:
            logger.debug(f"Audio chunk too short ({duration:.2f}s), skipping transcription")
            return ""
        
        # Check audio amplitude - detect if audio is too quiet
        max_amplitude = np.max(np.abs(audio_chunk))
        rms_amplitude = np.sqrt(np.mean(audio_chunk ** 2))
        
        if max_amplitude < 0.01:  # Very quiet audio
            logger.debug(f"Audio chunk too quiet (max: {max_amplitude:.4f}), skipping transcription")
            return ""
            
        if rms_amplitude < 0.005:  # Low RMS indicates mostly silence
            logger.debug(f"Audio chunk appears silent (RMS: {rms_amplitude:.4f}), skipping transcription")
            return ""
        
        # Normalize audio if it's too quiet but not silent
        if max_amplitude < 0.1:
            audio_chunk = audio_chunk * (0.1 / max_amplitude)
            logger.debug(f"Normalized quiet audio (original max: {max_amplitude:.4f})")
        
        # Apply minimal noise reduction only for longer chunks
        try:
            if duration > 1.0:  # Only for chunks > 1 second
                reduced = nr.reduce_noise(
                    y=audio_chunk,
                    sr=sample_rate,
                    stationary=False,
                    prop_decrease=0.2,  # Very conservative
                    n_std_thresh_stationary=3.0  # Less aggressive
                )
            else:
                reduced = audio_chunk
        except Exception as e:
            logger.warning(f"Noise reduction failed: {str(e)}, using original audio")
            reduced = audio_chunk

        # Save to temporary WAV with proper headers
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
            sf.write(tmp_wav.name, reduced, sample_rate, subtype='PCM_16')
            temp_path = tmp_wav.name

        try:
            # Groq Whisper transcription with enhanced parameters
            with open(temp_path, "rb") as audio_file:
                result = groq_client.audio.transcriptions.create(
                    model="whisper-large-v3",
                    file=audio_file,
                    response_format="text",
                    language="en",  # Specify language
                    prompt="This is a business meeting discussion with multiple participants talking about projects, deadlines, and action items."  # Context prompt
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
                # Add more common artifacts
                "Subscribe to our channel", "Hit the bell icon",
                "Don't forget to like", "See you next time"
            ]
            
            # Check for repeated artifacts (common Whisper issue)
            words = text.split()
            if len(words) > 3:
                # Check if more than 70% of words are the same
                word_counts = {}
                for word in words:
                    word_counts[word] = word_counts.get(word, 0) + 1
                
                most_common_count = max(word_counts.values()) if word_counts else 0
                if most_common_count > len(words) * 0.7:
                    logger.warning(f"Detected repetitive text artifact: '{text}'")
                    return ""
            
            # Filter out exact artifact matches
            if text in whisper_artifacts or len(text.strip()) < 3:
                logger.debug(f"Filtered out artifact/short text: '{text}'")
                return ""
            
            # Check for phrases that are likely artifacts
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
            # Cleanup temporary file
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception as ex:
                    logger.warning(f"Failed to cleanup temp file {temp_path}: {str(ex)}")
                    
    except Exception as e:
        logger.error(f"Chunk transcription failed: {str(e)}")
        return ""

# ------------------ TRANSCRIPT CLEANUP ------------------ #
def clean_transcript(raw_text: str) -> str:
    """
    Use Gemini to fix grammar & punctuation.
    """
    if not raw_text or len(raw_text.strip()) < 5:
        return raw_text
        
    try:
        prompt = f"""
        Fix grammar, punctuation, and unclear words in this transcript.
        Keep the meaning faithful and don't add new information.
        If the text is too short or unclear, return it as is.

        Transcript:
        {raw_text}
        """
        
        cleaned = llm.predict(prompt).strip()
        
        # Fallback to original if cleaning failed
        if not cleaned or len(cleaned) < len(raw_text) * 0.5:
            logger.warning("Transcript cleaning produced poor results, using original")
            return raw_text
            
        return cleaned
        
    except Exception as e:
        logger.warning(f"Transcript cleaning failed: {str(e)}, using original")
        return raw_text

# ------------------ MOM GENERATION ------------------ #
def generate_mom(transcript: str) -> Dict[str, Any]:
    """Generate structured MoM from transcript."""
    try:
        if not transcript or len(transcript.strip()) < 10:
            logger.warning("Transcript too short for MoM generation")
            return {
                "summary": {
                    "overview": "Insufficient audio content for meaningful analysis",
                    "detailed": transcript or "No transcript available"
                },
                "action_items": [],
                "decisions": []
            }
        
        # Generate MoM with retry
        max_retries = 2
        for attempt in range(max_retries):
            try:
                response_text = mom_chain.invoke({"transcript": transcript})
                
                if isinstance(response_text, str):
                    # Extract JSON from response
                    match = re.search(r"\{.*\}", response_text, re.DOTALL)
                    if match:
                        mom_data = json.loads(match.group())
                        
                        # Validate structure
                        if validate_mom_structure(mom_data):
                            return mom_data
                        else:
                            logger.warning(f"Invalid MoM structure (attempt {attempt + 1})")
                            
                elif isinstance(response_text, dict):
                    if validate_mom_structure(response_text):
                        return response_text
                        
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parsing failed (attempt {attempt + 1}): {str(e)}")
            except Exception as e:
                logger.warning(f"MoM generation attempt {attempt + 1} failed: {str(e)}")
        
        # Fallback MoM
        logger.warning("All MoM generation attempts failed, using fallback")
        return create_fallback_mom(transcript)
        
    except Exception as e:
        logger.error(f"MoM generation completely failed: {str(e)}")
        return create_fallback_mom(transcript)

def validate_mom_structure(mom_data: Dict[str, Any]) -> bool:
    """Validate that MoM has the required structure."""
    try:
        required_keys = ["summary", "action_items", "decisions"]
        if not all(key in mom_data for key in required_keys):
            return False
            
        summary = mom_data.get("summary", {})
        if not isinstance(summary, dict) or "overview" not in summary or "detailed" not in summary:
            return False
            
        if not isinstance(mom_data.get("action_items"), list):
            return False
            
        if not isinstance(mom_data.get("decisions"), list):
            return False
            
        return True
        
    except Exception:
        return False

def create_fallback_mom(transcript: str) -> Dict[str, Any]:
    """Create a basic MoM structure when generation fails."""
    return {
        "summary": {
            "overview": "Meeting transcript processed" if transcript else "No content available",
            "detailed": transcript[:500] + ("..." if len(transcript) > 500 else "") if transcript else "No transcript available"
        },
        "action_items": [],
        "decisions": []
    }

# ------------------ PIPELINE (OFFLINE FULL FILE) ------------------ #
def run_agent(file_path: str) -> Dict[str, Any]:
    """Full pipeline: Transcribe audio and generate MoM."""
    try:
        transcription_result = transcribe_audio(file_path)
        transcript = transcription_result["transcript"]
        mom = generate_mom(transcript)
        return {"transcript": transcript, "mom": mom}
    except Exception as e:
        logger.error(f"Agent pipeline failed: {str(e)}")
        return {
            "transcript": "Pipeline failed",
            "mom": create_fallback_mom("Pipeline failed")
        }

# ------------------ PIPELINE (LIVE) ------------------ #
def run_live_agent(audio_chunks: List[np.ndarray], sample_rate: int = 16000) -> Dict[str, Any]:
    """
    Live pipeline: Process multiple audio chunks and generate final MoM.
    """
    try:
        logger.info(f"Processing {len(audio_chunks)} audio chunks")
        
        # Filter out empty or invalid chunks
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
                "mom": create_fallback_mom("No valid audio content")
            }
        
        logger.info(f"Processing {len(valid_chunks)} valid chunks")
        
        # Transcribe chunks with progress tracking
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
                "mom": create_fallback_mom("No transcribable audio content")
            }
        
        # Combine and clean transcripts
        full_transcript = " ".join(transcripts)
        cleaned_transcript = clean_transcript(full_transcript)
        
        # Generate MoM
        mom = generate_mom(cleaned_transcript)
        
        return {
            "transcript": cleaned_transcript,
            "mom": mom
        }
        
    except Exception as e:
        logger.error(f"Live agent pipeline failed: {str(e)}")
        return {
            "transcript": "Live processing failed",
            "mom": create_fallback_mom(f"Live processing failed: {str(e)}")
        }