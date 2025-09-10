
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv
import os
import logging

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

    # Return the file for download
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type,
        headers=headers
    )