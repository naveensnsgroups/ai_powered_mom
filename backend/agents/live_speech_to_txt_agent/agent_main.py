

from fastapi import APIRouter, UploadFile, File, HTTPException
from agents.live_speech_to_txt_agent.core.agent import run_live_agent
from agents.live_speech_to_txt_agent.core.tools import save_temp_file, validate_audio
import os, logging, tempfile
import numpy as np
import soundfile as sf
from pydub import AudioSegment

router = APIRouter()  # ✅ no prefix here
logger = logging.getLogger(__name__)

@router.post("/live-chunks")
async def live_transcribe_api(files: list[UploadFile] = File(...)):
    temp_paths = []
    try:
        if not files:
            raise HTTPException(status_code=400, detail="No audio chunks provided.")

        audio_chunks, sr = [], 16000

        for file in files:
            file_bytes = await file.read()
            if not validate_audio(file_bytes):
                raise HTTPException(status_code=400, detail=f"File {file.filename} invalid or too short.")

            # Save original
            temp_path_original = save_temp_file(file_bytes, suffix=os.path.splitext(file.filename)[1] or ".webm")
            temp_paths.append(temp_path_original)

            # Convert to wav
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
                audio = AudioSegment.from_file(temp_path_original)
                audio = audio.set_channels(1).set_frame_rate(16000)
                audio.export(tmp_wav.name, format="wav")
                temp_path_wav = tmp_wav.name
                temp_paths.append(temp_path_wav)

            # Read wav into numpy
            data, sr = sf.read(temp_path_wav, dtype="float32")
            audio_chunks.append(np.array(data, dtype=np.float32))

        result = run_live_agent(audio_chunks, sample_rate=sr or 16000)
        return {
            "transcript": result.get("transcript", ""),
            "mom": result.get("mom", {"summary": {}, "action_items": [], "decisions": []})
        }

    except Exception as e:
        logger.exception("Error in /live-chunks")
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")
    finally:
        for path in temp_paths:
            if path and os.path.exists(path):
                try: os.remove(path)
                except Exception: pass

