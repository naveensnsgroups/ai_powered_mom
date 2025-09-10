
# tools.py
import tempfile
from pydub import AudioSegment
from agents.speech_to_txt_agent.core.agent import transcribe_audio, generate_mom
from typing import Dict, Any
from fpdf import FPDF
from docx import Document
import os

# ---------------- Helper Functions ---------------- #

def save_temp_file(file_bytes: bytes, suffix: str = ".wav") -> str:
    """
    Save uploaded file temporarily and return the file path.
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        return tmp.name

def validate_audio(file_bytes: bytes, min_size: int = 2000) -> bool:
    """
    Validate audio file size (or duration if needed).
    """
    return len(file_bytes) >= min_size

def convert_to_wav(file_path: str) -> str:
    """
    Convert audio to WAV format if not already WAV.
    """
    if file_path.endswith(".wav"):
        return file_path
    audio = AudioSegment.from_file(file_path)
    wav_path = file_path.rsplit(".", 1)[0] + ".wav"
    audio.export(wav_path, format="wav")
    return wav_path

# ---------------- LangChain Tools ---------------- #

def transcribe_tool(file_path: str) -> Dict[str, str]:
    """
    Tool wrapper for agent executor: transcribes audio to text.
    """
    try:
        result = transcribe_audio(file_path)
        return {"transcript": result.get("transcript", "")}
    except Exception as e:
        return {"error": f"Error during transcription: {str(e)}"}

def generate_mom_tool(transcript: str) -> Dict[str, Any]:
    """
    Tool wrapper for agent executor: generates structured MoM.
    Returns structured JSON with multi-level summaries and participant info.
    """
    try:
        result = generate_mom(transcript)
        # Ensure all keys exist for downstream usage
        mom = {
            "summary": result.get("summary", {"overview": "", "detailed": ""}),
            "action_items": result.get("action_items", []),
            "decisions": result.get("decisions", [])
        }
        return {"mom": mom}
    except Exception as e:
        return {"error": f"Error generating MoM: {str(e)}"}

# ---------------- Export Functions ---------------- #

def export_mom_pdf(mom: Dict[str, Any], output_path: str = "MoM.pdf") -> str:
    """
    Export structured MoM as PDF.
    """
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", 'B', 16)
    pdf.cell(0, 10, "Minutes of Meeting", ln=True, align="C")
    pdf.set_font("Arial", '', 12)

    # Summary
    pdf.ln(5)
    pdf.set_font("Arial", 'B', 14)
    pdf.cell(0, 10, "Summary", ln=True)
    pdf.set_font("Arial", '', 12)
    pdf.multi_cell(0, 8, f"Overview: {mom['summary'].get('overview', '')}")
    pdf.multi_cell(0, 8, f"Detailed: {mom['summary'].get('detailed', '')}")

    # Action Items
    pdf.ln(5)
    pdf.set_font("Arial", 'B', 14)
    pdf.cell(0, 10, "Action Items", ln=True)
    pdf.set_font("Arial", '', 12)
    for idx, item in enumerate(mom.get("action_items", []), 1):
        pdf.multi_cell(0, 8, f"{idx}. Task: {item.get('task', '')} | Assigned to: {item.get('assigned_to', '')} | Deadline: {item.get('deadline', 'N/A')}")

    # Decisions
    pdf.ln(5)
    pdf.set_font("Arial", 'B', 14)
    pdf.cell(0, 10, "Decisions", ln=True)
    pdf.set_font("Arial", '', 12)
    for idx, item in enumerate(mom.get("decisions", []), 1):
        pdf.multi_cell(0, 8, f"{idx}. Decision: {item.get('decision', '')} | Participant: {item.get('participant', '')}")

    pdf.output(output_path)
    return os.path.abspath(output_path)

def export_mom_docx(mom: Dict[str, Any], output_path: str = "MoM.docx") -> str:
    """
    Export structured MoM as DOCX.
    """
    doc = Document()
    doc.add_heading("Minutes of Meeting", 0)

    # Summary
    doc.add_heading("Summary", level=1)
    doc.add_paragraph(f"Overview: {mom['summary'].get('overview', '')}")
    doc.add_paragraph(f"Detailed: {mom['summary'].get('detailed', '')}")

    # Action Items
    doc.add_heading("Action Items", level=1)
    for idx, item in enumerate(mom.get("action_items", []), 1):
        doc.add_paragraph(f"{idx}. Task: {item.get('task', '')} | Assigned to: {item.get('assigned_to', '')} | Deadline: {item.get('deadline', 'N/A')}")

    # Decisions
    doc.add_heading("Decisions", level=1)
    for idx, item in enumerate(mom.get("decisions", []), 1):
        doc.add_paragraph(f"{idx}. Decision: {item.get('decision', '')} | Participant: {item.get('participant', '')}")

    doc.save(output_path)
    return os.path.abspath(output_path)
