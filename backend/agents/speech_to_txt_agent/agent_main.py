


from fastapi import APIRouter, UploadFile, File, HTTPException
from agents.speech_to_txt_agent.core.agent import run_agent
from agents.speech_to_txt_agent.core.tools import (
    save_temp_file,
    validate_audio,
    convert_to_wav,
    export_mom_pdf,
    export_mom_docx
)
import os
import logging
import tempfile
from typing import List, Dict, Any

router = APIRouter()
logger = logging.getLogger(__name__)

# Track exported files for cleanup
EXPORTED_FILES: List[str] = []

# Default MoM structure to ensure all fields exist
DEFAULT_MOM: Dict[str, Any] = {
    "title": "Meeting Minutes",
    "summary": {"overview": "", "detailed": ""},
    "overview": "",
    "attendees": [],
    "tasks": [],
    "action_items": [],
    "decisions": [],
    "risks": [],
    "data_points": []
}

@router.post("/transcribe")
async def transcribe_audio_api(file: UploadFile = File(...), export_format: str = "none"):
    """
    Transcribe audio and generate Minutes of Meeting (MoM).
    export_format: "pdf", "docx", or "none"
    """
    temp_path = None
    wav_path = None
    output_file_path = None

    try:
        # Read uploaded file
        file_bytes = await file.read()

        # Validate audio
        if not validate_audio(file_bytes):
            raise HTTPException(status_code=400, detail="Audio too short to transcribe.")

        # Save uploaded file temporarily
        temp_path = save_temp_file(file_bytes, suffix=".mp3")
        logger.info(f"Saved temporary audio file: {temp_path}")

        # Convert to WAV if needed
        wav_path = convert_to_wav(temp_path)
        logger.info(f"Converted to WAV: {wav_path}")

        # Run agent pipeline
        result = run_agent(wav_path)
        transcript = result.get("transcript", "")
        raw_mom = result.get("mom", {})
        logger.info(f"Raw MoM from run_agent: {raw_mom}")  # Debug log

        # Use raw_mom if valid, otherwise fall back to DEFAULT_MOM
        mom = raw_mom if raw_mom and isinstance(raw_mom, dict) and len(raw_mom) > 0 else DEFAULT_MOM.copy()
        
        # Ensure all fields exist, filling missing ones with defaults
        for key in DEFAULT_MOM:
            if key not in mom or mom[key] is None:
                logger.warning(f"Missing or null MoM field '{key}', using default value.")
                mom[key] = DEFAULT_MOM[key]

        # Handle export if requested
        export_format = export_format.lower().strip()
        if export_format == "pdf":
            temp_pdf = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            output_file_path = export_mom_pdf(mom, output_path=temp_pdf.name)
            if not os.path.exists(output_file_path):
                raise HTTPException(status_code=500, detail="Failed to create PDF file")
            EXPORTED_FILES.append(output_file_path)
            logger.info(f"Exported PDF: {output_file_path}")

        elif export_format == "docx":
            temp_docx = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
            output_file_path = export_mom_docx(mom, output_path=temp_docx.name)
            if not os.path.exists(output_file_path):
                raise HTTPException(status_code=500, detail="Failed to create DOCX file")
            EXPORTED_FILES.append(output_file_path)
            logger.info(f"Exported DOCX: {output_file_path}")

        response = {
            "transcript": transcript,
            "mom": mom,
            "export_file": output_file_path if output_file_path else None
        }
        logger.info(f"Response sent to frontend: {response}")  # Debug log
        return response

    except HTTPException as http_exc:
        raise http_exc

    except Exception as e:
        logger.exception("Error processing audio")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

    finally:
        # Cleanup audio files
        for path in [temp_path, wav_path]:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                    logger.info(f"Deleted temporary file: {path}")
                except Exception as cleanup_error:
                    logger.warning(f"Failed to delete temp file {path}: {cleanup_error}")

@router.post("/cleanup")
async def cleanup_exported_file(file_path: str):
    """
    Cleanup exported file after download.
    """
    # Validate file path to prevent path traversal
    if not file_path.startswith(tempfile.gettempdir()):
        logger.error(f"Invalid file path: {file_path}")
        raise HTTPException(status_code=400, detail="Invalid file path.")

    if file_path in EXPORTED_FILES:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                EXPORTED_FILES.remove(file_path)
                logger.info(f"Cleaned up exported file: {file_path}")
                return {"status": "success", "message": f"File {file_path} deleted"}
            else:
                logger.warning(f"File not found for cleanup: {file_path}")
                return {"status": "success", "message": f"File {file_path} already deleted"}
        except Exception as e:
            logger.error(f"Failed to cleanup file {file_path}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to cleanup file: {str(e)}")
    else:
        logger.warning(f"File not tracked for cleanup: {file_path}")
        return {"status": "success", "message": f"File {file_path} not in tracked files"}