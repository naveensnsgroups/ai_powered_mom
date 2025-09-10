# agent.py
import whisper
import google.generativeai as genai
import os

# Configure Gemini (optional)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Load Whisper model once globally for efficiency
whisper_model = whisper.load_model("base")  # options: tiny, base, small, medium, large

async def transcribe_audio(file_path: str, use_gemini: bool = False):
    """
    Transcribe audio locally using Whisper.
    Optionally refine transcript using Gemini AI.
    """
    try:
        result = whisper_model.transcribe(file_path)
        text = result.get("text", "")
    except Exception as e:
        return {"error": f"Whisper error: {str(e)}"}

    if use_gemini:
        try:
            model = genai.GenerativeModel("gemini-2.0-flash")
            response = model.generate_content(
                f"Clean up and format this meeting transcript for readability:\n\n{text}"
            )
            text = response.text
        except Exception as e:
            return {"error": f"Gemini error: {str(e)}"}

    return {"transcript": text}
