from fastapi import APIRouter, UploadFile, File, HTTPException
from agents.live_speech_to_txt_agent.core.agent import run_agent
from agents.live_speech_to_txt_agent.core.tools import (
    save_temp_file, validate_audio, live_mom_tool
)
import os
import logging
import numpy as np
import soundfile as sf

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/live-chunks")
async def live_transcribe_api(files: list[UploadFile] = File(...)):
    """
    Accept multiple audio chunks (WAV/MP3) and generate final transcript + MoM.
    """
    temp_paths = []

    try:
        audio_chunks = []

        for file in files:
            file_bytes = await file.read()

            if not validate_audio(file_bytes):
                raise HTTPException(status_code=400, detail="One of the chunks is too short.")

            temp_path = save_temp_file(file_bytes, suffix=".wav")
            temp_paths.append(temp_path)

            data, sr = sf.read(temp_path, dtype="float32")
            audio_chunks.append(np.array(data, dtype=np.float32))

        # Run pipeline
        result = live_mom_tool(audio_chunks, sample_rate=sr or 16000)

        return {
            "transcript": result.get("transcript", ""),
            "mom": result.get("mom", {"summary": {}, "action_items": [], "decisions": []})
        }

    except HTTPException as http_exc:
        raise http_exc

    except Exception as e:
        logger.exception("Error processing live chunks")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

    finally:
        # Cleanup temp files
        for path in temp_paths:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as cleanup_error:
                    logger.warning(f"Failed to delete temp file {path}: {cleanup_error}")
