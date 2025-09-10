
from fastapi import APIRouter, UploadFile, File, HTTPException
from agents.speech_to_txt_agent.core.agent import save_temp_file, validate_audio, convert_to_wav, run_agent
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/transcribe")
async def transcribe_audio_api(file: UploadFile = File(...)):
    temp_path = None
    wav_path = None

    try:
        file_bytes = await file.read()

        if not validate_audio(file_bytes):
            raise HTTPException(status_code=400, detail="Audio too short to transcribe.")

        temp_path = save_temp_file(file_bytes, suffix=".mp3")
        wav_path = convert_to_wav(temp_path)

        result = run_agent(wav_path)

        return {
            "status": "success",
            "data": result
        }

    except HTTPException as http_exc:
        raise http_exc

    except Exception as e:
        logger.exception("Error processing audio")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

    finally:
        for path in [temp_path, wav_path]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                except Exception as cleanup_error:
                    logger.warning(f"Failed to delete temp file {path}: {cleanup_error}")
