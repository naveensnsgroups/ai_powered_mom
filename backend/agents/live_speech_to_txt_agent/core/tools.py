# tools.py
import tempfile
import numpy as np
import soundfile as sf
import noisereduce as nr
from typing import Dict
from agents.live_speech_to_txt_agent.core.agent import transcribe_chunk, run_live_agent


# ---------------- Helper Functions ---------------- #

def save_temp_file(file_bytes: bytes, suffix: str = ".wav") -> str:
    """
    Save uploaded audio temporarily and return the file path.
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        return tmp.name


def validate_audio(file_bytes: bytes, min_size: int = 2000) -> bool:
    """
    Validate audio file size (basic check).
    """
    return len(file_bytes) >= min_size


def reduce_noise_and_save(audio_bytes: bytes, sample_rate: int = 16000) -> str:
    """
    Apply noise reduction to raw audio bytes and save as WAV.
    """
    # Convert bytes → numpy array
    audio_data, sr = sf.read(tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name, dtype="float32")
    reduced = nr.reduce_noise(y=audio_data, sr=sr or sample_rate)

    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
    sf.write(temp_file, reduced, sr or sample_rate)
    return temp_file


# ---------------- LangChain Tools ---------------- #

def live_transcribe_tool(audio_chunk: np.ndarray, sample_rate: int = 16000) -> Dict[str, str]:
    """
    Tool wrapper for agent executor: live transcribes audio chunks.
    """
    try:
        result = transcribe_chunk(audio_chunk, sample_rate)
        return {"transcript": result}
    except Exception as e:
        return {"error": f"Error during live transcription: {str(e)}"}


def live_mom_tool(audio_chunks: list, sample_rate: int = 16000) -> Dict[str, str]:
    """
    Tool wrapper: processes all chunks and generates MoM.
    """
    try:
        result = run_live_agent(audio_chunks, sample_rate)
        return result
    except Exception as e:
        return {"error": f"Error generating live MoM: {str(e)}"}
