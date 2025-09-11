
import tempfile
import numpy as np
import soundfile as sf
import noisereduce as nr
from typing import Dict, List
from agents.live_speech_to_txt_agent.core.agent import transcribe_chunk, run_live_agent
from pydub import AudioSegment
import io
import os


# ---------------- Helper Functions ---------------- #

def save_temp_file(file_bytes: bytes, suffix: str = ".wav") -> str:
    """Save uploaded audio temporarily and return the file path."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        return tmp.name


def validate_audio(file_bytes: bytes, min_size: int = 2000) -> bool:
    """Validate audio file size (basic check)."""
    return len(file_bytes) >= min_size


def reduce_noise_and_save(audio_bytes: bytes, sample_rate: int = 16000) -> str:
    """
    Convert raw audio bytes (WebM/MP3/WAV) to mono WAV @ 16kHz,
    apply noise reduction, and save as final WAV.
    Returns the final file path.
    """
    try:
        # Load audio bytes
        audio_seg = AudioSegment.from_file(io.BytesIO(audio_bytes))

        # Force mono + 16kHz
        audio_seg = audio_seg.set_channels(1).set_frame_rate(sample_rate)

        # Export to temp WAV
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
            audio_seg.export(tmp_wav.name, format="wav")
            temp_path = tmp_wav.name

        # Load WAV for noise reduction
        data, sr = sf.read(temp_path, dtype="float32")

        if data.ndim > 1:  # convert stereo → mono
            data = np.mean(data, axis=1)

        reduced = nr.reduce_noise(y=data, sr=sr)

        # Save final reduced file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_final:
            sf.write(tmp_final.name, reduced, sr)
            final_path = tmp_final.name

        # Cleanup intermediate WAV
        if os.path.exists(temp_path):
            os.remove(temp_path)

        return final_path

    except Exception as e:
        raise RuntimeError(f"Audio preprocessing failed: {str(e)}")


# ---------------- LangChain Tools ---------------- #

def live_transcribe_tool(audio_chunk: np.ndarray, sample_rate: int = 16000) -> Dict[str, str]:
    """
    Tool wrapper: live transcribes a single audio chunk.
    Returns transcript or error.
    """
    try:
        result = transcribe_chunk(audio_chunk, sample_rate)
        return {"transcript": result, "error": ""}
    except Exception as e:
        return {"transcript": "", "error": f"Error during live transcription: {str(e)}"}


def live_mom_tool(audio_chunks: List[np.ndarray], sample_rate: int = 16000) -> Dict[str, str]:
    """
    Tool wrapper: processes all chunks and generates MoM.
    Returns MoM dict or error.
    """
    try:
        result = run_live_agent(audio_chunks, sample_rate)
        return {"mom": result, "error": ""}
    except Exception as e:
        return {"mom": {}, "error": f"Error generating live MoM: {str(e)}"}
