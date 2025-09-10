
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import logging
import tempfile
from agents.speech_to_txt_agent.core.tools import export_mom_pdf, export_mom_docx

# Import routers
from agents.speech_to_txt_agent.agent_main import router as speech_router

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="AI Powered MoM (Minutes of Meeting)")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------- CORS Setup ---------------- #
origins = [os.getenv("FRONTEND_URL", "http://localhost:3000")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Register Routers ---------------- #
app.include_router(
    speech_router,
    prefix="/speech-to-text",
    tags=["Speech-to-Text Agent"]
)

# ---------------- Health Check ---------------- #
@app.get("/health")
async def health_check():
    """
    Basic health check for the backend service.
    """
    return {"status": "ok", "message": "Backend is running 🚀"}

# ---------------- MoM File Download ---------------- #
@app.get("/download")
async def download_file(file_path: str):
    """
    Endpoint to download exported MoM PDF/DOCX files.
    """
    # Validate file path to prevent path traversal
    if not file_path.startswith(tempfile.gettempdir()):
        logger.error(f"Invalid file path: {file_path}")
        raise HTTPException(status_code=400, detail="Invalid file path.")

    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        raise HTTPException(status_code=404, detail="File not found.")

    # Determine media type based on file extension
    extension = os.path.splitext(file_path)[1].lower()
    media_type = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }.get(extension, "application/octet-stream")

    # Set Content-Disposition header for download
    filename = os.path.basename(file_path)
    headers = {"Content-Disposition": f"attachment; filename={filename}"}

    logger.info(f"Serving file: {file_path} as {filename} with media type {media_type}")

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type,
        headers=headers
    )

# ---------------- Export Edited MoM ---------------- #
class EditedMoM(BaseModel):
    mom: dict
    export_format: str

@app.post("/speech-to-text/export-edited")
async def export_edited_mom(data: EditedMoM):
    """
    Export edited MoM as PDF or DOCX.
    """
    try:
        export_format = data.export_format.lower()
        output_file_path = None

        if export_format == "pdf":
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
            output_file_path = export_mom_pdf(data.mom, output_path=temp_file.name)
        elif export_format == "docx":
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
            output_file_path = export_mom_docx(data.mom, output_path=temp_file.name)
        else:
            raise HTTPException(status_code=400, detail="Invalid export format. Use 'pdf' or 'docx'.")

        if not os.path.exists(output_file_path):
            logger.error(f"Failed to create file: {output_file_path}")
            raise HTTPException(status_code=500, detail="Failed to create file.")

        logger.info(f"Exported edited MoM: {output_file_path}")
        return {"export_file": output_file_path}

    except Exception as e:
        logger.error(f"Error exporting edited MoM: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to export edited MoM: {str(e)}")