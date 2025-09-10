
# tools.py
import tempfile
from pydub import AudioSegment
from agents.speech_to_txt_agent.core.agent import transcribe_tool as transcribe_audio_tool
from agents.speech_to_txt_agent.core.agent import generate_mom_tool as generate_mom_llm
from typing import Dict

# ---------------- Helper Functions ---------------- #

def save_temp_file(file_bytes: bytes, suffix: str = ".wav") -> str:
    """
    Save uploaded file temporarily and return the file path.
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        return tmp.name

def validate_audio(file_bytes: bytes, min_size: int = 2000) -> bool:
    """
    Validate audio file size (or duration if needed).
    """
    return len(file_bytes) >= min_size

def convert_to_wav(file_path: str) -> str:
    """
    Convert audio to WAV format if not already WAV.
    """
    if file_path.endswith(".wav"):
        return file_path
    audio = AudioSegment.from_file(file_path)
    wav_path = file_path.rsplit(".", 1)[0] + ".wav"
    audio.export(wav_path, format="wav")
    return wav_path

# ---------------- LangChain Tools ---------------- #

def transcribe_tool(file_path: str) -> Dict[str, str]:
    """
    Tool wrapper for agent executor: transcribes audio to text.
    """
    try:
        result = transcribe_audio_tool(file_path)
        return {"transcript": result.get("transcript", "")}
    except Exception as e:
        return {"error": f"Error during transcription: {str(e)}"}

def generate_mom_tool(transcript: str) -> Dict[str, str]:
    """
    Tool wrapper for agent executor: generates structured MoM.
    """
    try:
        result = generate_mom_llm(transcript)
        return {"mom": result.get("mom", "")}
    except Exception as e:
        return {"error": f"Error generating MoM: {str(e)}"}
