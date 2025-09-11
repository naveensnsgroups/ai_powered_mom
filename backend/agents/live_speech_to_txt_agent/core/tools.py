

# tools.py
import tempfile
import numpy as np
import soundfile as sf
import noisereduce as nr
from typing import Dict, List, Optional, Tuple
from agents.live_speech_to_txt_agent.core.agent import transcribe_chunk, run_live_agent
from pydub import AudioSegment
import io
import os
import logging
import subprocess
import wave
import struct

logger = logging.getLogger(__name__)

# ---------------- Helper Functions ---------------- #

def save_temp_file(file_bytes: bytes, suffix: str = ".wav") -> str:
    """Save uploaded audio temporarily and return the file path."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        return tmp.name

def validate_audio(file_bytes: bytes, min_size: int = 100) -> bool:
    """Validate audio file size (more lenient for chunks)."""
    return len(file_bytes) >= min_size

def is_valid_webm(file_bytes: bytes) -> bool:
    """Check if bytes contain a valid WebM file header."""
    if len(file_bytes) < 4:
        return False
    
    # WebM files start with EBML header (0x1A45DFA3)
    webm_signature = b'\x1a\x45\xdf\xa3'
    return file_bytes[:4] == webm_signature

def convert_raw_audio_to_wav(audio_bytes: bytes, sample_rate: int = 16000) -> Optional[str]:
    """
    Convert raw audio bytes to WAV format using multiple fallback methods.
    Returns WAV file path or None if conversion fails.
    """
    temp_paths_to_cleanup = []
    
    try:
        # Method 1: Try direct WAV creation if it's raw PCM data
        if len(audio_bytes) % 2 == 0:  # Assume 16-bit samples
            try:
                # Convert bytes to numpy array (assuming 16-bit PCM)
                audio_data = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
                
                # Create WAV file
                wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
                sf.write(wav_path, audio_data, sample_rate)
                
                # Verify the file was created successfully
                if os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:  # WAV header is 44 bytes
                    logger.info(f"Successfully converted raw PCM to WAV: {wav_path}")
                    return wav_path
                else:
                    os.remove(wav_path) if os.path.exists(wav_path) else None
            except Exception as e:
                logger.debug(f"Raw PCM conversion failed: {str(e)}")
        
        # Method 2: Save as temporary file and try pydub
        temp_input = save_temp_file(audio_bytes, suffix=".webm")
        temp_paths_to_cleanup.append(temp_input)
        
        try:
            audio_seg = AudioSegment.from_file(temp_input)
            audio_seg = audio_seg.set_channels(1).set_frame_rate(sample_rate)
            
            wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
            audio_seg.export(wav_path, format="wav")
            
            if os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:
                logger.info(f"Successfully converted using pydub: {wav_path}")
                return wav_path
            else:
                os.remove(wav_path) if os.path.exists(wav_path) else None
                
        except Exception as e:
            logger.debug(f"pydub conversion failed: {str(e)}")
        
        # Method 3: Try FFmpeg with various input formats
        ffmpeg_formats = [
            ("webm", ["-f", "webm"]),
            ("ogg", ["-f", "ogg"]),
            ("raw", ["-f", "s16le", "-ar", str(sample_rate), "-ac", "1"]),
            ("auto", [])  # Let FFmpeg auto-detect
        ]
        
        for fmt_name, extra_args in ffmpeg_formats:
            try:
                wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
                
                cmd = ["ffmpeg", "-y"] + extra_args + [
                    "-i", temp_input,
                    "-ar", str(sample_rate),
                    "-ac", "1",
                    "-acodec", "pcm_s16le",
                    wav_path
                ]
                
                result = subprocess.run(
                    cmd, 
                    capture_output=True, 
                    text=True, 
                    timeout=30
                )
                
                if result.returncode == 0 and os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:
                    logger.info(f"Successfully converted using FFmpeg ({fmt_name} format): {wav_path}")
                    return wav_path
                else:
                    os.remove(wav_path) if os.path.exists(wav_path) else None
                    logger.debug(f"FFmpeg {fmt_name} conversion failed: {result.stderr}")
                    
            except subprocess.TimeoutExpired:
                logger.warning(f"FFmpeg {fmt_name} conversion timed out")
                os.remove(wav_path) if os.path.exists(wav_path) else None
            except Exception as e:
                logger.debug(f"FFmpeg {fmt_name} conversion error: {str(e)}")
                if 'wav_path' in locals():
                    os.remove(wav_path) if os.path.exists(wav_path) else None
        
        # Method 4: Create silence if all else fails (for testing/debugging)
        logger.warning("All conversion methods failed, creating silence as fallback")
        return create_silence_wav(duration_ms=1000, sample_rate=sample_rate)
        
    except Exception as e:
        logger.error(f"Audio conversion completely failed: {str(e)}")
        return None
        
    finally:
        # Cleanup temporary files
        for path in temp_paths_to_cleanup:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as ex:
                    logger.warning(f"Failed to cleanup {path}: {str(ex)}")

def create_silence_wav(duration_ms: int = 1000, sample_rate: int = 16000) -> str:
    """Create a silent WAV file for fallback purposes."""
    samples = int(sample_rate * duration_ms / 1000)
    silence = np.zeros(samples, dtype=np.float32)
    
    wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
    sf.write(wav_path, silence, sample_rate)
    
    logger.info(f"Created silence WAV: {wav_path}")
    return wav_path

def reduce_noise_and_save(audio_bytes: bytes, sample_rate: int = 16000) -> str:
    """
    Convert audio bytes to clean WAV with noise reduction.
    Uses multiple fallback methods to handle various audio formats.
    """
    try:
        logger.debug(f"Processing audio chunk: {len(audio_bytes)} bytes")
        
        # Validate input
        if not validate_audio(audio_bytes, min_size=50):
            logger.warning(f"Audio chunk too small: {len(audio_bytes)} bytes")
            return create_silence_wav(duration_ms=500, sample_rate=sample_rate)
        
        # Convert to WAV
        wav_path = convert_raw_audio_to_wav(audio_bytes, sample_rate)
        if not wav_path:
            logger.warning("Audio conversion failed, using silence")
            return create_silence_wav(duration_ms=500, sample_rate=sample_rate)
        
        try:
            # Load and process audio
            data, sr = sf.read(wav_path, dtype="float32")
            
            # Handle stereo to mono conversion
            if data.ndim > 1:
                data = np.mean(data, axis=1)
            
            # Skip noise reduction if audio is too short
            if len(data) < sample_rate * 0.1:  # Less than 100ms
                logger.debug("Audio too short for noise reduction, skipping")
                reduced = data
            else:
                # Apply noise reduction with conservative settings
                try:
                    reduced = nr.reduce_noise(
                        y=data,
                        sr=sr,
                        stationary=False,  # Better for speech
                        prop_decrease=0.5,  # Conservative noise reduction
                        n_std_thresh_stationary=2.0  # Less aggressive
                    )
                except Exception as e:
                    logger.warning(f"Noise reduction failed: {str(e)}, using original audio")
                    reduced = data
            
            # Save final processed audio
            final_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
            sf.write(final_path, reduced, sr)
            
            # Cleanup intermediate file
            if os.path.exists(wav_path):
                os.remove(wav_path)
            
            logger.debug(f"Successfully processed audio: {final_path}")
            return final_path
            
        except Exception as e:
            logger.error(f"Audio processing failed: {str(e)}")
            # Cleanup and return original if processing fails
            if os.path.exists(wav_path):
                return wav_path  # Return original WAV
            else:
                return create_silence_wav(duration_ms=500, sample_rate=sample_rate)
                
    except Exception as e:
        logger.error(f"Audio preprocessing completely failed: {str(e)}")
        return create_silence_wav(duration_ms=500, sample_rate=sample_rate)

def load_audio_safe(file_path: str) -> Tuple[np.ndarray, int]:
    """
    Safely load audio file with multiple fallback methods.
    Returns (audio_data, sample_rate)
    """
    try:
        data, sr = sf.read(file_path, dtype="float32")
        
        # Convert stereo to mono if needed
        if data.ndim > 1:
            data = np.mean(data, axis=1)
            
        return data.astype(np.float32), int(sr)
        
    except Exception as e:
        logger.error(f"Failed to load audio {file_path}: {str(e)}")
        # Return silence as fallback
        return np.zeros(8000, dtype=np.float32), 16000

# ---------------- LangChain Tools ---------------- #

def live_transcribe_tool(audio_chunk: np.ndarray, sample_rate: int = 16000) -> Dict[str, str]:
    """
    Tool wrapper: live transcribes a single audio chunk.
    Returns transcript or error.
    """
    try:
        if len(audio_chunk) == 0:
            return {"transcript": "", "error": "Empty audio chunk"}
            
        result = transcribe_chunk(audio_chunk, sample_rate)
        return {"transcript": result or "", "error": ""}
    except Exception as e:
        logger.error(f"Error during live transcription: {str(e)}")
        return {"transcript": "", "error": f"Error during live transcription: {str(e)}"}

def live_mom_tool(audio_chunks: List[np.ndarray], sample_rate: int = 16000) -> Dict[str, str]:
    """
    Tool wrapper: processes all chunks and generates MoM.
    Returns MoM dict or error.
    """
    try:
        # Filter out empty chunks
        valid_chunks = [chunk for chunk in audio_chunks if len(chunk) > 0]
        
        if not valid_chunks:
            return {
                "mom": {
                    "summary": {"overview": "", "detailed": "No valid audio chunks received"},
                    "action_items": [],
                    "decisions": []
                }, 
                "error": ""
            }
            
        result = run_live_agent(valid_chunks, sample_rate)
        return {"mom": result, "error": ""}
    except Exception as e:
        logger.error(f"Error generating live MoM: {str(e)}")
        return {
            "mom": {
                "summary": {"overview": "", "detailed": f"Error: {str(e)}"},
                "action_items": [],
                "decisions": []
            }, 
            "error": f"Error generating live MoM: {str(e)}"
        }