# tools.py
import tempfile
from pydub import AudioSegment

def save_temp_file(file_bytes, suffix=".wav"):
    """Save uploaded file temporarily and return path."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        return tmp.name

def validate_audio(file_bytes, min_size=2000):
    """
    Validate audio file by size (placeholder).
    Replace with duration check using pydub if needed.
    """
    return len(file_bytes) >= min_size

def convert_to_wav(file_path: str):
    """Convert audio to WAV format for Whisper (if not WAV)."""
    if file_path.endswith(".wav"):
        return file_path

    audio = AudioSegment.from_file(file_path)
    wav_path = file_path.rsplit(".", 1)[0] + ".wav"
    audio.export(wav_path, format="wav")
    return wav_path
