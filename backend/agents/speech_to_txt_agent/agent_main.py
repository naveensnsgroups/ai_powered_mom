# agent_main.py
from fastapi import APIRouter, UploadFile, File
from agents.speech_to_txt_agent.core.tools import save_temp_file, validate_audio, convert_to_wav
from agents.speech_to_txt_agent.core.agent import transcribe_audio

router = APIRouter()

@router.post("/transcribe")
async def transcribe_audio_api(file: UploadFile = File(...), use_gemini: bool = False):
    # Read uploaded file
    file_bytes = await file.read()

    # Validate short audio
    if not validate_audio(file_bytes):
        return {"error": "Audio too short to transcribe."}

    # Save temporarily
    temp_path = save_temp_file(file_bytes, suffix=".mp3")

    # Convert to WAV for Whisper
    wav_path = convert_to_wav(temp_path)

    # Run transcription
    result = await transcribe_audio(wav_path, use_gemini=use_gemini)
    return result
