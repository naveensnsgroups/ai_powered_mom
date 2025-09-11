
# main.py
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os
import logging
import tempfile
import time
from contextlib import asynccontextmanager
from agents.speech_to_txt_agent.core.tools import export_mom_pdf, export_mom_docx

# Import routers
from agents.speech_to_txt_agent.agent_main import router as speech_router
from agents.live_speech_to_txt_agent.agent_main import router as live_speech_router

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # Startup
    logger.info("Starting AI Powered MoM application...")
    
    # Verify environment variables
    required_env_vars = ["GEMINI_API_KEY", "GROQ_API_KEY"]
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"Missing required environment variables: {missing_vars}")
        raise RuntimeError(f"Missing environment variables: {missing_vars}")
    
    # Test API connections
    try:
        from agents.live_speech_to_txt_agent.core.agent import groq_client, llm
        
        # Test Groq connection (with a minimal request)
        logger.info("Testing API connections...")
        
        # Test Gemini connection
        try:
            _ = llm.predict("test")
            logger.info("Gemini API connection successful")
        except Exception as e:
            logger.warning(f"Gemini API test failed: {str(e)}")
        
        logger.info("Application startup complete")
        
    except Exception as e:
        logger.error(f"Failed to initialize APIs: {str(e)}")
        # Continue anyway - errors will be handled per request
    
    yield
    
    # Shutdown
    logger.info("Shutting down application...")

# Initialize FastAPI app
app = FastAPI(
    title="AI Powered MoM (Minutes of Meeting)",
    description="Convert audio meetings to structured Minutes of Meeting using AI",
    version="2.0.0",
    lifespan=lifespan
)

# ---------------- Middleware Setup ---------------- #

# CORS Configuration
origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://localhost:3000",
    # Add your production URLs here
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    max_age=3600,
)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["localhost", "127.0.0.1", "*.localhost"]
)

# Custom middleware for request logging and error handling
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log request
    logger.info(f"Request: {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        
        # Log response
        logger.info(f"Response: {response.status_code} in {process_time:.3f}s")
        return response
        
    except Exception as e:
        process_time = time.time() - start_time
        logger.error(f"Request failed: {str(e)} in {process_time:.3f}s")
        
        # Return a proper error response
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "error": str(e)[:100],  # Limit error message length
                "timestamp": time.time()
            }
        )

# ---------------- Register Routers ---------------- #
app.include_router(
    speech_router,
    prefix="/speech-to-text",
    tags=["Speech-to-Text Agent"]
)

app.include_router(
    live_speech_router,
    prefix="/live-speech-to-text",
    tags=["Live Speech-to-Text Agent"]
)

# ---------------- Health Check Endpoints ---------------- #
@app.get("/health")
async def health_check():
    """
    Comprehensive health check for the backend service.
    """
    try:
        health_status = {
            "status": "healthy",
            "message": "Backend is running",
            "timestamp": time.time(),
            "services": {}
        }
        
        # Check environment variables
        env_vars = ["GEMINI_API_KEY", "GROQ_API_KEY"]
        health_status["services"]["environment"] = {
            "status": "ok" if all(os.getenv(var) for var in env_vars) else "warning",
            "variables": {var: "present" if os.getenv(var) else "missing" for var in env_vars}
        }
        
        # Check disk space for temp files
        try:
            temp_dir = tempfile.gettempdir()
            stat = os.statvfs(temp_dir)
            free_space_gb = (stat.f_bavail * stat.f_frsize) / (1024**3)
            
            health_status["services"]["storage"] = {
                "status": "ok" if free_space_gb > 1 else "warning",
                "temp_dir": temp_dir,
                "free_space_gb": round(free_space_gb, 2)
            }
        except Exception:
            health_status["services"]["storage"] = {"status": "unknown"}
        
        # Overall status
        service_statuses = [svc.get("status") for svc in health_status["services"].values()]
        if "error" in service_statuses:
            health_status["status"] = "unhealthy"
        elif "warning" in service_statuses:
            health_status["status"] = "degraded"
        
        return health_status
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "message": f"Health check failed: {str(e)}",
                "timestamp": time.time()
            }
        )

@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": "AI Powered Minutes of Meeting API",
        "version": "2.0.0",
        "endpoints": {
            "health": "/health",
            "speech_to_text": "/speech-to-text/",
            "live_speech_to_text": "/live-speech-to-text/",
            "docs": "/docs"
        },
        "features": [
            "Audio file transcription",
            "Live audio chunk processing",
            "Noise reduction",
            "Minutes of Meeting generation",
            "PDF/DOCX export"
        ]
    }

# ---------------- File Download Endpoint ---------------- #
@app.get("/download")
async def download_file(file_path: str):
    """
    Endpoint to download exported MoM PDF/DOCX files.
    Enhanced with better security and error handling.
    """
    try:
        # Security: Validate file path to prevent path traversal
        temp_dir = tempfile.gettempdir()
        normalized_path = os.path.normpath(file_path)
        
        if not normalized_path.startswith(temp_dir):
            logger.error(f"Invalid file path (security): {file_path}")
            raise HTTPException(
                status_code=400, 
                detail="Invalid file path"
            )

        if not os.path.exists(normalized_path):
            logger.error(f"File not found: {normalized_path}")
            raise HTTPException(
                status_code=404, 
                detail="File not found"
            )
        
        # Check file age (delete files older than 1 hour)
        file_age = time.time() - os.path.getctime(normalized_path)
        if file_age > 3600:  # 1 hour
            try:
                os.remove(normalized_path)
                logger.info(f"Removed expired file: {normalized_path}")
            except Exception:
                pass
            raise HTTPException(
                status_code=404,
                detail="File has expired"
            )

        # Determine media type and filename
        extension = os.path.splitext(normalized_path)[1].lower()
        media_type_map = {
            ".pdf": "application/pdf",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }
        
        media_type = media_type_map.get(extension, "application/octet-stream")
        filename = f"meeting_minutes_{int(time.time())}{extension}"

        logger.info(f"Serving file: {filename} ({media_type})")

        return FileResponse(
            path=normalized_path,
            filename=filename,
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Cache-Control": "no-cache, no-store, must-revalidate"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Download failed: {str(e)}"
        )

# ---------------- Export Edited MoM Endpoint ---------------- #
class EditedMoM(BaseModel):
    mom: dict
    export_format: str

@app.post("/speech-to-text/export-edited")
async def export_edited_mom(data: EditedMoM):
    """
    Export edited MoM as PDF or DOCX with enhanced error handling.
    """
    try:
        export_format = data.export_format.lower().strip()
        
        if export_format not in ["pdf", "docx"]:
            raise HTTPException(
                status_code=400, 
                detail="Invalid export format. Use 'pdf' or 'docx'"
            )
        
        # Validate MoM structure
        if not isinstance(data.mom, dict):
            raise HTTPException(
                status_code=400,
                detail="Invalid MoM format"
            )
        
        # Create temporary file
        suffix = f".{export_format}"
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp_file.close()
        
        try:
            if export_format == "pdf":
                output_file_path = export_mom_pdf(data.mom, output_path=temp_file.name)
            else:  # docx
                output_file_path = export_mom_docx(data.mom, output_path=temp_file.name)
            
            # Verify file was created
            if not os.path.exists(output_file_path) or os.path.getsize(output_file_path) == 0:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to create {export_format.upper()} file"
                )
            
            logger.info(f"Exported edited MoM as {export_format.upper()}: {output_file_path}")
            
            return {
                "export_file": output_file_path,
                "format": export_format,
                "file_size": os.path.getsize(output_file_path),
                "created_at": time.time()
            }
            
        except Exception as e:
            # Cleanup on failure
            if os.path.exists(temp_file.name):
                try:
                    os.remove(temp_file.name)
                except Exception:
                    pass
            raise e

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Export failed: {str(e)}"
        )

# ---------------- Error Handlers ---------------- #
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "detail": "Endpoint not found",
            "path": str(request.url.path),
            "available_endpoints": ["/health", "/docs", "/speech-to-text/", "/live-speech-to-text/"]
        }
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    logger.error(f"Internal server error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "timestamp": time.time()
        }
    )

if __name__ == "__main__":
    import uvicorn
    
    # Development server configuration
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
        access_log=True
    )